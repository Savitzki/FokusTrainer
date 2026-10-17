-- Versioned schedules never rewrite past individual or collective streaks.
begin;
set local lock_timeout='5s';
set local statement_timeout='45s';
create table if not exists public.training_accounts (
 user_id uuid primary key references auth.users(id) on delete cascade,
 time_zone text not null,
 revision integer not null default 0 check(revision>=0),
 started_on date not null
);
create table if not exists public.training_plans (
 user_id uuid not null references public.training_accounts(user_id) on delete cascade,
 revision integer not null check(revision>0),
 effective_on date not null,
 training_days integer[] not null check(cardinality(training_days) between 1 and 7),
 created_at timestamptz not null default clock_timestamp(),
 primary key(user_id,revision)
);
create index if not exists training_plans_by_day on public.training_plans(user_id,effective_on desc,revision desc);
create table if not exists public.training_extra_rests (
 user_id uuid not null references public.training_accounts(user_id) on delete cascade,
 day date not null,
 authorized_at timestamptz not null default clock_timestamp(),
 primary key(user_id,day)
);
alter table public.training_accounts enable row level security;
alter table public.training_plans enable row level security;
alter table public.training_extra_rests enable row level security;
revoke all on public.training_accounts,public.training_plans,public.training_extra_rests from public,anon,authenticated;

-- Authoritative configurable weekly allowance. The client reads this value.
create or replace function public.training_extra_rest_limit() returns integer
language sql immutable set search_path=public,pg_temp as $$ select 2; $$;

create or replace function public.training_day_kind(p_user uuid,p_day date,
 p_plan_cutoff timestamptz default 'infinity',p_rest_cutoff timestamptz default 'infinity')
returns text language sql stable security definer set search_path=public,pg_temp as $$
 select case
 when exists(select 1 from training_extra_rests where user_id=p_user and day=p_day and authorized_at<p_rest_cutoff) then 'extra-rest'
 when extract(isodow from p_day)::integer=any(coalesce((
   select training_days from training_plans where user_id=p_user and effective_on<=p_day and created_at<=p_plan_cutoff
   order by effective_on desc,revision desc limit 1),array[1,2,3,4,5,6,7])) then 'training'
 else 'scheduled-rest' end;
$$;
create or replace function public.training_state(p_user uuid) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('revision',a.revision,'timezone',a.time_zone,'today',(now() at time zone a.time_zone)::date,
 'startedOn',a.started_on,'weeklyExtraLimit',training_extra_rest_limit(),
 'plans',coalesce((select jsonb_agg(jsonb_build_object('revision',p.revision,'effectiveFrom',p.effective_on,'trainingDays',p.training_days) order by p.revision)
  from training_plans p where p.user_id=a.user_id),'[]'::jsonb),
 'extraRests',coalesce((select jsonb_agg(r.day order by r.day) from training_extra_rests r where r.user_id=a.user_id),'[]'::jsonb))
 from training_accounts a where a.user_id=p_user;
$$;
create or replace function public.get_training_state(p_timezone text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid();
begin
 if u is null then raise exception 'Entre na conta para configurar sua semana.'; end if;
 if not exists(select 1 from pg_timezone_names where name=p_timezone) then raise exception 'Fuso inválido.'; end if;
 insert into training_accounts(user_id,time_zone,started_on) values(u,p_timezone,(now() at time zone p_timezone)::date) on conflict do nothing;
 return training_state(u);
end $$;
create or replace function public.save_training_plan(p_training_days integer[],p_revision integer,p_timezone text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); a training_accounts;
begin
 perform get_training_state(p_timezone);
 select * into a from training_accounts where user_id=u for update;
 if p_revision is distinct from a.revision then raise exception 'Sua programação mudou em outro aparelho. Atualize e tente novamente.'; end if;
 if p_training_days is null or cardinality(p_training_days) not between 1 and 7 or
   (select count(distinct d) from unnest(p_training_days) d where d between 1 and 7)<>cardinality(p_training_days)
 then raise exception 'Escolha pelo menos um dia de treino, sem repetir os dias.'; end if;
 insert into training_plans(user_id,revision,effective_on,training_days)
 values(u,a.revision+1,(now() at time zone a.time_zone)::date+1,array(select d from unnest(p_training_days) d order by d));
 update training_accounts set revision=revision+1 where user_id=u;
 return training_state(u);
end $$;
create or replace function public.authorize_extra_rest(p_timezone text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); a training_accounts; d date; monday date; g record;
begin
 perform get_training_state(p_timezone);
 select * into a from training_accounts where user_id=u for update;
 d:=(now() at time zone a.time_zone)::date; monday:=d-(extract(isodow from d)::integer-1);
 if exists(select 1 from training_extra_rests where user_id=u and day=d) then return training_state(u); end if;
 if training_day_kind(u,d)<>'training' then raise exception 'Hoje já é um descanso programado.'; end if;
 if exists(select 1 from workout_days where user_id=u and day=d) then raise exception 'O treino de hoje já foi registrado. Não é possível trocá-lo por descanso.'; end if;
 if (select count(*) from training_extra_rests where user_id=u and day>=monday and day<monday+7)>=training_extra_rest_limit()
 then raise exception 'Você já usou os descansos extras desta semana.'; end if;
 insert into training_extra_rests(user_id,day) values(u,d);
 update training_accounts set revision=revision+1 where user_id=u;
 for g in select group_id from group_members where user_id=u order by group_id loop perform social_refresh_day(g.group_id); end loop;
 return training_state(u);
end $$;

alter table public.group_days add column if not exists counts_for_streak boolean not null default true;
alter table public.streak_groups add column if not exists training_checked_through date;
create or replace function public.social_refresh_day(p_group uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare g streak_groups; d date; today_value date; n integer; complete boolean; scored boolean;
begin
 select * into g from streak_groups where id=p_group for update;
 if not found or g.status<>'active' or g.started_on is null then return; end if;
 today_value:=(now() at time zone g.time_zone)::date;
 d:=coalesce(g.training_checked_through+1,g.started_on);
 while d<=today_value loop
  -- Existing collective days are immutable, including their score.
  if not exists(select 1 from group_days where group_id=g.id and day=d) then
   select count(*),bool_and(m.status='accepted' and (m.kind<>'training' or m.trained)),bool_or(m.kind='training')
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
create or replace function public.social_streak(p_group uuid,p_today date,p_best boolean default false) returns integer
language sql stable security definer set search_path=public,pg_temp as $$
 with numbered as (
  select day,counts_for_streak,day-(row_number() over(order by day))::integer island from group_days where group_id=p_group and day<=p_today
 ), runs as (select sum(case when counts_for_streak then 1 else 0 end)::integer n,max(day) last_day from numbered group by island)
 select coalesce(max(n),0) from runs where p_best or last_day>=p_today-1;
$$;

-- Serialize rest authorizations and confirmations using the same account lock.
-- The first account timezone is retained, preventing travel/device changes from
-- granting another weekly rest allowance or another "today".
create or replace function public.confirm_daily_workout(p_day date,p_activity text,p_minutes integer,p_timezone text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=social_require_profile(); a training_accounts; g record;
begin
 perform get_training_state(p_timezone);
 select * into a from training_accounts where user_id=u for update;
 if p_day is distinct from (now() at time zone a.time_zone)::date then raise exception 'Só o treino de hoje pode sincronizar.'; end if;
 insert into workout_days(user_id,day,activity,minutes) values(u,p_day,trim(p_activity),p_minutes) on conflict(user_id,day) do nothing;
 for g in select group_id from group_members where user_id=u order by group_id loop perform social_refresh_day(g.group_id); end loop;
end $$;

-- Preserve the existing social response and extend it; safe to reapply.
do $$ begin
 if to_regprocedure('public.training_base_social_state()') is null then
  alter function public.get_social_state() rename to training_base_social_state;
 end if;
end $$;
create or replace function public.get_social_state() returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=social_require_profile(); payload jsonb; result_groups jsonb:='[]'; item jsonb; g streak_groups; d date; members_value jsonb;
begin
 for g in select s.* from streak_groups s join group_members m on m.group_id=s.id where m.user_id=u and s.status='active' order by s.id loop
  perform social_refresh_day(g.id);
 end loop;
 payload:=training_base_social_state();
 for item in select value from jsonb_array_elements(payload->'groups') loop
  select * into g from streak_groups where id=(item->>'id')::uuid;
  d:=(now() at time zone g.time_zone)::date;
  select coalesce(jsonb_agg(m || jsonb_build_object('resting',case when g.status='active' and (m->>'accepted')::boolean
    then training_day_kind((m->>'id')::uuid,d,d::timestamp at time zone g.time_zone,(d+1)::timestamp at time zone g.time_zone)<>'training' else false end)),'[]'::jsonb)
   into members_value from jsonb_array_elements(item->'members') m;
  result_groups:=result_groups || jsonb_build_array(item || jsonb_build_object('members',members_value,'resting',
    exists(select 1 from group_days where group_id=g.id and day=d and not counts_for_streak)));
 end loop;
 return jsonb_set(payload,'{groups}',result_groups);
end $$;

-- Scheduled reminders must not charge someone on a valid rest day.
create or replace function public.push_job_allowed(p_id uuid,p_lease uuid) returns boolean
language sql security definer set search_path=public,pg_temp as $$
 select exists(select 1 from push_jobs j join push_devices d on d.id=j.device_id
  where j.id=p_id and j.lease=p_lease and j.state='sending' and d.enabled
  and j.day=(now() at time zone d.time_zone)::date
  and extract(hour from now() at time zone d.time_zone) between d.reminder_hour and 21
  and (j.slot='last_call' or extract(hour from now() at time zone d.time_zone)<21)
  and training_day_kind(d.user_id,(now() at time zone coalesce((select a.time_zone from training_accounts a where a.user_id=d.user_id),d.time_zone))::date)='training'
  and not exists(select 1 from workout_days w where w.user_id=d.user_id and (w.confirmed_at at time zone d.time_zone)::date=j.day));
$$;
revoke all on function public.push_job_allowed(uuid,uuid) from public,anon,authenticated;
grant execute on function public.push_job_allowed(uuid,uuid) to service_role;
revoke all on function public.training_extra_rest_limit(),public.training_day_kind(uuid,date,timestamptz,timestamptz),public.training_state(uuid),public.training_base_social_state() from public,anon,authenticated;
revoke all on function public.get_training_state(text),public.save_training_plan(integer[],integer,text),public.authorize_extra_rest(text),public.get_social_state(),public.confirm_daily_workout(date,text,integer,text),public.social_refresh_day(uuid),public.social_streak(uuid,date,boolean) from public,anon,authenticated;
grant execute on function public.get_training_state(text),public.save_training_plan(integer[],integer,text),public.authorize_extra_rest(text),public.get_social_state(),public.confirm_daily_workout(date,text,integer,text) to authenticated;
notify pgrst, 'reload schema';
commit;
