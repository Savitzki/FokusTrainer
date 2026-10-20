-- Close future account days on the server. Never backfill pre-activation days.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

alter table public.economy_rules add column medical_auto_started_at timestamptz not null default clock_timestamp();
alter table public.economy_rules alter column kit_price set default 350;
update public.economy_rules set kit_price=350,monthly_free_kits=2 where singleton;
alter table public.training_accounts add column medical_checked_through date;
alter table public.medical_kits add column automatic boolean not null default false;
alter table public.medical_kits add column day_closed_at timestamptz;
alter table public.medical_kits add column notice_seen_at timestamptz;
alter table public.medical_kits add constraint medical_automatic_origin check(
 (not automatic and day_closed_at is null and notice_seen_at is null) or
 (automatic and used_on is not null and day_closed_at is not null and used_at>=day_closed_at));
create index medical_automatic_notices on public.medical_kits(user_id,used_on) where automatic and notice_seen_at is null;

create or replace function public.training_day_kind(p_user uuid,p_day date,
 p_plan_cutoff timestamptz default 'infinity',p_rest_cutoff timestamptz default 'infinity')
returns text language sql stable security definer set search_path=public,pg_temp as $$
 select case
 when exists(select 1 from medical_kits k where k.user_id=p_user and k.used_on=p_day and
   ((not k.automatic and k.used_at<p_rest_cutoff) or (k.automatic and k.day_closed_at<=p_rest_cutoff))) then 'medical-kit'
 when exists(select 1 from training_extra_rests where user_id=p_user and day=p_day and authorized_at<p_rest_cutoff) then 'extra-rest'
 else training_schedule_kind(p_user,p_day,p_plan_cutoff,p_rest_cutoff) end;
$$;

-- Account -> wallet. SKIP LOCKED avoids acquiring another participant's account
-- while they hold it and are refreshing the same group. No device supplies time.
create function public.medical_auto_close_account(p_user uuid) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
declare a training_accounts; activation timestamptz; d date; last_day date; batch_end date; closed_at timestamptz; k medical_kits;
begin
 select * into a from training_accounts where user_id=p_user;
 if not found then return true;end if;
 select medical_auto_started_at into activation from economy_rules where singleton;
 last_day:=(clock_timestamp() at time zone a.time_zone)::date-1;
 d:=greatest(a.started_on,(activation at time zone a.time_zone)::date,coalesce(a.medical_checked_through+1,a.started_on));
 if d>last_day then return true;end if;
 select * into a from training_accounts where user_id=p_user for update skip locked;
 if not found then return false;end if;
 -- Recheck after the account lock; another device/cron may have closed the day.
 d:=greatest(a.started_on,(activation at time zone a.time_zone)::date,coalesce(a.medical_checked_through+1,a.started_on));
 batch_end:=least(last_day,d+61);
 while d<=batch_end loop
  closed_at:=(d+1)::timestamp at time zone a.time_zone;
  if training_day_kind(p_user,d,d::timestamp at time zone a.time_zone,closed_at)='training'
    and not exists(select 1 from workout_days where user_id=p_user and day=d)
    and not exists(select 1 from gf_days where user_id=p_user and day=d) then
   perform economy_grant_monthly_kits(p_user,d);
   select * into k from economy_available_kits(p_user,d)
    where purchase_id is null or acquired_at<closed_at
    order by (purchase_id is not null),acquired_at,id limit 1;
   if found then
    update medical_kits set used_on=d,used_at=clock_timestamp(),automatic=true,day_closed_at=closed_at where id=k.id and used_on is null;
    update coin_wallets set revision=revision+1 where user_id=p_user;
    update training_accounts set revision=revision+1 where user_id=p_user;
   end if;
  end if;
  d:=d+1;
 end loop;
 update training_accounts set medical_checked_through=greatest(coalesce(medical_checked_through,batch_end),batch_end) where user_id=p_user;
 return batch_end>=last_day;
end $$;

create function public.process_medical_kit_rollovers() returns integer
language plpgsql security definer set search_path=public,pg_temp as $$
declare item record; processed integer:=0;
begin
 if not pg_try_advisory_xact_lock(hashtextextended('capibora:medical-rollover',0)) then return 0;end if;
 for item in select a.user_id from training_accounts a cross join economy_rules r
  where coalesce(a.medical_checked_through,greatest(a.started_on,(r.medical_auto_started_at at time zone a.time_zone)::date)-1)
   <(clock_timestamp() at time zone a.time_zone)::date-1
  order by a.medical_checked_through nulls first,a.user_id limit 500 loop
  if medical_auto_close_account(item.user_id) then processed:=processed+1;end if;
 end loop;
 return processed;
end $$;

create or replace function public.get_training_state(p_timezone text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid();
begin
 if u is null then raise exception 'Entre na conta para configurar sua semana.';end if;
 if not exists(select 1 from pg_timezone_names where name=p_timezone) then raise exception 'Fuso inválido.';end if;
 insert into training_accounts(user_id,time_zone,started_on) values(u,p_timezone,(clock_timestamp() at time zone p_timezone)::date) on conflict do nothing;
 perform 1 from training_accounts where user_id=u for update;
 perform medical_auto_close_account(u);
 return training_state(u);
end $$;

-- Preserve the wallet response and add only unread, server-confirmed notices.
alter function public.economy_state(uuid) rename to medical_base_economy_state;
create function public.economy_state(p_user uuid) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
 select medical_base_economy_state(p_user)||jsonb_build_object('automaticNotices',coalesce((
  select jsonb_agg(jsonb_build_object('id',id,'day',used_on,'usedAt',used_at) order by used_on)
  from (select id,used_on,used_at from medical_kits where user_id=p_user and automatic and notice_seen_at is null order by used_on limit 100) x),'[]'::jsonb));
$$;

create function public.acknowledge_medical_kit_notice(p_ids uuid[],p_timezone text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=social_require_profile(); n integer;
begin
 if p_ids is null or cardinality(p_ids) not between 1 and 100 then raise exception 'Aviso inválido.';end if;
 perform get_economy_state(p_timezone);
 perform 1 from coin_wallets where user_id=u for update;
 update medical_kits set notice_seen_at=clock_timestamp() where user_id=u and id=any(p_ids) and automatic and notice_seen_at is null;
 get diagnostics n=row_count;
 if n>0 then update coin_wallets set revision=revision+1 where user_id=u;end if;
 return economy_state(u);
end $$;

-- Settle an account before creating its immutable mission/report/challenge day.
create or replace function public.gf_day(p_user uuid,p_day date)
returns table(day date,kind text,completed boolean,minutes integer)
language plpgsql security definer set search_path=public,pg_temp as $$
declare tz text; today_value date; k text; done boolean; duration integer;
begin
 select time_zone into strict tz from training_accounts where user_id=p_user;
 today_value:=(now() at time zone tz)::date;
 if p_day<today_value and exists(select 1 from gf_days g where g.user_id=p_user and g.day=p_day) then
  return query select g.day,g.kind,g.completed,g.minutes from gf_days g where g.user_id=p_user and g.day=p_day;return;
 end if;
 if not medical_auto_close_account(p_user) then raise exception using errcode='40001',message='O fechamento do dia está em andamento. Tente atualizar novamente.';end if;
 k:=training_day_kind(p_user,p_day,p_day::timestamp at time zone tz,(p_day+1)::timestamp at time zone tz);
 if k='training' and exists(select 1 from training_reschedules r where r.user_id=p_user and r.target_day=p_day and r.created_at<((p_day+1)::timestamp at time zone tz)) then k:='compensatory';end if;
 select true,w.minutes into done,duration from workout_days w where w.user_id=p_user and w.day=p_day
  and w.confirmed_at<least(clock_timestamp()+interval '1 second',(p_day+1)::timestamp at time zone tz);
 done:=coalesce(done,false);duration:=coalesce(duration,0);
 if p_day<today_value then
  insert into gf_days(user_id,day,kind,completed,minutes) values(p_user,p_day,k,done,duration) on conflict do nothing;
  return query select g.day,g.kind,g.completed,g.minutes from gf_days g where g.user_id=p_user and g.day=p_day;
 else return query select p_day,k,done,duration;end if;
end $$;

-- Account closure comes before the group lock. No consolidated group is rewritten.
create or replace function public.social_refresh_day(p_group uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare g streak_groups; d date; today_value date; n integer; complete boolean; scored boolean; participant record;
begin
 for participant in select user_id from group_members where group_id=p_group and status='accepted' order by user_id loop
  if not medical_auto_close_account(participant.user_id) then return;end if;
 end loop;
 select * into g from streak_groups where id=p_group for update;
 if not found or g.status<>'active' or g.started_on is null then return;end if;
 today_value:=(now() at time zone g.time_zone)::date;
 d:=coalesce(g.training_checked_through+1,g.started_on);
 while d<=today_value loop
  if not exists(select 1 from group_days where group_id=g.id and day=d) then
   select count(*),bool_and(m.status='accepted' and m.kind<>'unplanned' and (m.kind<>'training' or m.trained)),bool_or(m.kind='training')
    into n,complete,scored from (
     select gm.status,training_day_kind(gm.user_id,d,d::timestamp at time zone g.time_zone,(d+1)::timestamp at time zone g.time_zone) kind,
      exists(select 1 from workout_days w where w.user_id=gm.user_id and (w.confirmed_at at time zone g.time_zone)::date=d) trained
     from group_members gm where gm.group_id=g.id
    ) m;
   if n>=2 and complete then
    insert into group_days(group_id,day,members_count,counts_for_streak) values(g.id,d,n,scored) on conflict do nothing;
   end if;
  end if;
  d:=d+1;
 end loop;
 update streak_groups set training_checked_through=today_value-1 where id=g.id;
end $$;

revoke all on function public.medical_auto_close_account(uuid),public.medical_base_economy_state(uuid),public.economy_state(uuid),public.process_medical_kit_rollovers() from public,anon,authenticated;
grant execute on function public.process_medical_kit_rollovers() to service_role;
revoke all on function public.acknowledge_medical_kit_notice(uuid[],text) from public,anon,authenticated;
grant execute on function public.acknowledge_medical_kit_notice(uuid[],text) to authenticated;
-- Existing helper/RPC privileges are preserved by CREATE OR REPLACE above.
do $$ begin
 if to_regprocedure('cron.schedule(text,text,text)') is not null then
  perform cron.schedule('capibora-medical-kits-midnight','* * * * *','select public.process_medical_kit_rollovers();');
 end if;
end $$;
notify pgrst,'reload schema';
commit;
