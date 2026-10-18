-- Locked, append-only weekly plan revisions. No workout, balance or snapshot rewrite.
begin;
set local lock_timeout='5s';set local statement_timeout='60s';
alter table public.training_accounts add column legacy_schedule_before date;
-- Preserve the old implicit calendar only before this cutover for existing accounts.
update public.training_accounts set legacy_schedule_before=(clock_timestamp() at time zone time_zone)::date+1;
alter table public.training_plans
 add column replaces_revision integer,
 add column starts_immediately boolean not null default false,
 add foreign key(user_id,replaces_revision) references public.training_plans(user_id,revision);
-- Accounts with historical workouts but no explicit plan keep their existing seven-day
-- calendar. This compatibility anchor is never created for a new/untrained account.
with anchors as (insert into public.training_plans(user_id,revision,effective_on,training_days)
 select a.user_id,a.revision+1,a.started_on,array[1,2,3,4,5,6,7] from public.training_accounts a
 where not exists(select 1 from public.training_plans p where p.user_id=a.user_id)
 and exists(select 1 from public.workout_days w where w.user_id=a.user_id) returning user_id,revision)
update public.training_accounts a set revision=p.revision from anchors p where p.user_id=a.user_id;
create function public.training_has_plan(p_user uuid,p_day date) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from training_plans where user_id=p_user and effective_on<=p_day)
 or exists(select 1 from training_accounts a where a.user_id=p_user and p_day<a.legacy_schedule_before
  and exists(select 1 from training_plans p where p.user_id=p_user));
$$;


create or replace function public.training_schedule_kind(p_user uuid,p_day date,
 p_plan_cutoff timestamptz default 'infinity',p_swap_cutoff timestamptz default 'infinity')
returns text language sql stable security definer set search_path=public,pg_temp as $$
 select case
 when exists(select 1 from training_reschedules where user_id=p_user and original_day=p_day and created_at<p_swap_cutoff) then 'rescheduled-rest'
 when exists(select 1 from training_reschedules where user_id=p_user and target_day=p_day and created_at<p_swap_cutoff) then 'training'
 when extract(isodow from p_day)::integer=any(coalesce((select training_days from training_plans
  where user_id=p_user and effective_on<=p_day and (created_at<=p_plan_cutoff or starts_immediately) order by effective_on desc,revision desc limit 1),case when p_day<(select legacy_schedule_before from training_accounts where user_id=p_user) then array[1,2,3,4,5,6,7] else '{}'::integer[] end)) then 'training'
 when exists(select 1 from training_plans where user_id=p_user and effective_on<=p_day and (created_at<=p_plan_cutoff or starts_immediately)) then 'scheduled-rest'
 else 'unplanned' end;
$$;

create or replace function public.training_state(p_user uuid) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('revision',a.revision,'timezone',a.time_zone,'today',(now() at time zone a.time_zone)::date,
 'startedOn',a.started_on,'legacyScheduleBefore',a.legacy_schedule_before,'planRequired',not training_has_plan(a.user_id,(now() at time zone a.time_zone)::date),'weeklyExtraLimit',training_extra_rest_limit(),'weeklyRescheduleLimit',training_reschedule_limit(),
 'plans',coalesce((select jsonb_agg(jsonb_build_object('revision',p.revision,'effectiveFrom',p.effective_on,'trainingDays',p.training_days,'replacesRevision',p.replaces_revision) order by p.revision) from training_plans p where p.user_id=a.user_id),'[]'::jsonb),
 'extraRests',coalesce((select jsonb_agg(r.day order by r.day) from training_extra_rests r where r.user_id=a.user_id),'[]'::jsonb),
 'medicalRests',coalesce((select jsonb_agg(k.used_on order by k.used_on) from medical_kits k where k.user_id=a.user_id and k.used_on is not null),'[]'::jsonb),
 'reschedules',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'originalDay',r.original_day,'targetDay',r.target_day,'weekStart',r.week_start,'createdAt',r.created_at,'revision',r.revision) order by r.original_day) from training_reschedules r where r.user_id=a.user_id),'[]'::jsonb))
 from training_accounts a where a.user_id=p_user;
$$;

create or replace function public.get_training_state(p_timezone text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid();
begin
 if u is null then raise exception 'Entre na conta para configurar sua semana.';end if;
 if not exists(select 1 from pg_timezone_names where name=p_timezone) then raise exception 'Fuso inválido.';end if;
 insert into training_accounts(user_id,time_zone,started_on) values(u,p_timezone,(clock_timestamp() at time zone p_timezone)::date) on conflict do nothing;
 return training_state(u);
end $$;
drop function public.save_training_plan(integer[],integer,text);
create function public.save_training_plan(p_training_days integer[],p_revision integer,p_timezone text,p_replace boolean) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid();a training_accounts;d date;effective date;previous integer;conflicts text;g streak_groups;
begin
 perform get_training_state(p_timezone);
 select * into strict a from training_accounts where user_id=u for update;
 if p_revision is distinct from a.revision then raise exception 'Sua programação mudou em outro aparelho. Atualize e tente novamente.';end if;
 if p_training_days is null or cardinality(p_training_days)<>5 or
  (select count(distinct x) from unnest(p_training_days) x where x between 1 and 7)<>5
 then raise exception 'Escolha exatamente 5 dias de treino e 2 de descanso.';end if;
 select revision into previous from training_plans where user_id=u order by effective_on desc,revision desc limit 1;
 if p_replace is null or p_replace is distinct from (previous is not null) then raise exception 'Crie seu primeiro plano ou confirme Substituir plano.';end if;
 d:=(clock_timestamp() at time zone a.time_zone)::date;
 effective:=case when previous is null then d else d+1 end;
 -- Future swaps keep their original mandatory day and originally available rest.
 select string_agg(to_char(x.day,'DD/MM/YYYY'),', ' order by x.day) into conflicts from (
  select original_day as day from training_reschedules where user_id=u and original_day>=effective and not extract(isodow from original_day)::integer=any(p_training_days)
  union select target_day from training_reschedules where user_id=u and target_day>=effective and extract(isodow from target_day)::integer=any(p_training_days)) x;
 if conflicts is not null then raise exception 'O plano conflita com reagendamentos nas datas %. Preserve esses dias ao substituir.',conflicts;end if;
 -- A group in another timezone may already have consolidated an account-future day.
 for g in select s.* from streak_groups s join group_members m on m.group_id=s.id
  where m.user_id=u and m.status='accepted' and s.status='active' order by s.id for update of s loop
  select string_agg(to_char(x.day,'DD/MM/YYYY'),', ' order by x.day) into conflicts from (
   select z::date as day from generate_series(effective::timestamp,greatest(g.training_checked_through,(clock_timestamp() at time zone g.time_zone)::date)::timestamp,interval '1 day') z
   where (z::date<=g.training_checked_through or exists(select 1 from group_days where group_id=g.id and day=z::date))
    and not exists(select 1 from training_reschedules where user_id=u and z::date in(original_day,target_day))
    and not exists(select 1 from training_extra_rests where user_id=u and day=z::date)
    and not exists(select 1 from medical_kits where user_id=u and used_on=z::date)
    and (training_schedule_kind(u,z::date)='training') is distinct from (extract(isodow from z)::integer=any(p_training_days))) x;
  if conflicts is not null then raise exception 'A Arena já consolidou as datas %. Preserve esses dias no novo plano.',conflicts;end if;
 end loop;
 insert into training_plans(user_id,revision,effective_on,training_days,replaces_revision,starts_immediately)
 values(u,a.revision+1,effective,array(select x from unnest(p_training_days) x order by x),previous,previous is null);
 update training_accounts set revision=revision+1 where user_id=u;
 if previous is null then
  for g in select s.* from streak_groups s join group_members m on m.group_id=s.id
   where m.user_id=u and m.status='accepted' and s.status='active' order by s.id loop perform social_refresh_day(g.id);end loop;
 end if;
 return training_state(u);
end $$;

create or replace function public.reschedule_training(p_original_day date,p_target_day date,p_revision integer,p_timezone text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); a training_accounts; today_value date; monday date; g streak_groups; d date;
begin
 perform get_training_state(p_timezone);
 select * into a from training_accounts where user_id=u for update;
 -- Repeating the identical successful request is safe after a lost response.
 if exists(select 1 from training_reschedules where user_id=u and original_day=p_original_day and target_day=p_target_day) then return training_state(u); end if;
 if p_revision is distinct from a.revision then raise exception 'Sua programação mudou em outro aparelho. Atualize e tente novamente.'; end if;
 today_value:=(clock_timestamp() at time zone a.time_zone)::date;
 monday:=p_original_day-(extract(isodow from p_original_day)::integer-1);
 if p_original_day is null or p_target_day is null or p_original_day<today_value or p_target_day<=p_original_day or p_target_day>=monday+7
 then raise exception 'Escolha um descanso posterior ao treino, na mesma semana, antes de encerrar o dia original.'; end if;
 if (select count(*) from training_reschedules where user_id=u and week_start=monday)>=training_reschedule_limit()
 then raise exception 'Você já usou os 2 reagendamentos desta semana.'; end if;
 if exists(select 1 from training_reschedules where user_id=u and (original_day in(p_original_day,p_target_day) or target_day in(p_original_day,p_target_day)))
 then raise exception 'Uma dessas datas já participa de um reagendamento.'; end if;
 if not training_has_plan(u,p_original_day) or not training_has_plan(u,p_target_day) then raise exception 'Crie seu plano antes de reagendar.';end if;
 if training_day_kind(u,p_original_day)<>'training' or training_day_kind(u,p_target_day)<>'scheduled-rest'
 then raise exception 'Troque um treino obrigatório por um descanso programado disponível.'; end if;
 if exists(select 1 from workout_days where user_id=u and day in(p_original_day,p_target_day))
 then raise exception 'Uma dessas datas já tem treino confirmado.'; end if;
 -- Lock groups in the same order as confirmation/rest RPCs. Freeze completed,
 -- checked and closed dates, including groups whose timezone has already advanced.
 for g in select s.* from streak_groups s join group_members m on m.group_id=s.id
  where m.user_id=u and m.status='accepted' and s.status='active' order by s.id for update of s loop
  foreach d in array array[p_original_day,p_target_day] loop
   if exists(select 1 from group_days where group_id=g.id and day=d)
    or d<=g.training_checked_through
    or clock_timestamp()>=((d+1)::timestamp at time zone g.time_zone)
    or exists(select 1 from workout_days w where w.user_id=u and (w.confirmed_at at time zone g.time_zone)::date=d)
   then raise exception 'Uma dessas datas já encerrou ou foi consolidada na Arena. O resultado do grupo será preservado.'; end if;
  end loop;
 end loop;
 insert into training_reschedules(user_id,original_day,target_day,week_start,revision)
  values(u,p_original_day,p_target_day,monday,a.revision+1);
 update training_accounts set revision=revision+1 where user_id=u;
 for g in select s.* from streak_groups s join group_members m on m.group_id=s.id
  where m.user_id=u and m.status='accepted' and s.status='active' order by s.id loop perform social_refresh_day(g.id); end loop;
 return training_state(u);
end $$;

create or replace function public.workout_confirm(p_user uuid,p_day date,p_activity text,p_minutes integer,
 p_method text,p_review jsonb,p_request uuid,p_confirmed timestamptz) returns public.workout_days
language plpgsql security definer set search_path=public,pg_temp as $$
declare w workout_days; g record;
begin
 if not training_has_plan(p_user,p_day) then raise exception 'Crie seu plano semanal antes de registrar o treino.';end if;
 if p_day is distinct from (now() at time zone (select time_zone from training_accounts where user_id=p_user))::date then
  raise exception 'O dia mudou durante a confirmação. Atualize e tente novamente.';end if;
 if exists(select 1 from workout_days where user_id=p_user and day=p_day) then
  raise exception 'O treino de hoje já foi confirmado e não pode ser alterado.';end if;
 insert into workout_days(user_id,day,activity,minutes,recording_method,review,request_id,confirmed_at,manual_confirmed)
 values(p_user,p_day,trim(p_activity),p_minutes,p_method,p_review,p_request,p_confirmed,p_method='manual' and p_review is null) returning * into w;
 for g in select group_id from group_members where user_id=p_user order by group_id loop
  perform social_refresh_day(g.group_id);
 end loop;
 return w;
end $$;

create or replace function public.start_workout_session(p_request_id uuid,p_activity text,p_timezone text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=social_require_profile(); a training_accounts; s workout_sessions; r workout_recording_rules; t timestamptz;
begin
 perform get_training_state(p_timezone);
 select * into strict a from training_accounts where user_id=u for update;
 if not training_has_plan(u,(clock_timestamp() at time zone a.time_zone)::date) then raise exception 'Crie seu plano semanal antes de iniciar o treino.';end if;
 perform workout_expire_sessions(u);
 if p_request_id is null or p_activity is null or length(trim(p_activity)) not between 1 and 80 then
  raise exception 'Escolha uma atividade válida.';end if;
 select * into s from workout_sessions where user_id=u and request_id=p_request_id;
 if found then return workout_recording_state(u,s.id);end if;
 select * into s from workout_sessions where user_id=u and status='active';
 if found then return workout_recording_state(u,s.id);end if;
 t:=clock_timestamp();
 if exists(select 1 from workout_days where user_id=u and day=(t at time zone a.time_zone)::date) then
  raise exception 'O treino de hoje já foi confirmado.';end if;
 select * into strict r from workout_recording_rules where singleton;
 insert into workout_sessions(user_id,request_id,activity,time_zone,started_at,minimum_seconds,maximum_seconds)
 values(u,p_request_id,trim(p_activity),a.time_zone,t,r.minimum_minutes*60,r.maximum_session_minutes*60) returning * into s;
 return workout_recording_state(u,s.id);
end $$;

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

create or replace function public.gf_create_mission_cycle(p_user uuid,p_day date) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare a training_accounts; monday date; first_day date; dates date[]; n integer; variant integer; r gf_rules;
begin
 select * into strict a from training_accounts where user_id=p_user for update;
 if not training_has_plan(p_user,p_day) then return;end if;
 monday:=date_trunc('week',p_day)::date;
 if exists(select 1 from gf_cycles where user_id=p_user and week_start=monday) then return;end if;
 first_day:=greatest(p_day,a.started_on);
 select * into strict r from gf_rules where singleton;
 select coalesce(array_agg(x::date order by x),'{}'::date[]) into dates
  from generate_series(first_day::timestamp,(monday+6)::timestamp,interval '1 day') x
  where training_day_kind(p_user,x::date)='training';
 insert into gf_accounts(user_id) values(p_user) on conflict do nothing;
 insert into gf_cycles(user_id,week_start,starts_on,planned_days,rewards)
  values(p_user,monday,first_day,dates,jsonb_build_object('bonus',r.all_reward,'policy',2));
 n:=cardinality(dates); variant:=gf_mission_variant(monday);
 -- Weight is feasible even when only rest days remain. Distinct dates still count once.
 insert into gf_missions(user_id,week_start,key,target,reward)
  values(p_user,monday,'weight',least(1+variant/2,monday+7-first_day),r.simple_reward);
 if n>0 then
  insert into gf_missions(user_id,week_start,key,target,reward) values
   (p_user,monday,'workouts',least(2+variant%2,n),r.simple_reward),
   (p_user,monday,case when variant%2=0 then 'schedule' else 'consistency' end,
    case when variant%2=0 then n else monday+7-first_day end,
    case when variant%2=0 then r.medium_reward else r.hard_reward end);
 end if;
end $$;

create or replace function public.gf_sync_missions(p_user uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare a training_accounts; d date; monday date; c gf_cycles; m gf_missions; dates date[];
 value integer; misses integer; done integer; weights integer; closed boolean; result jsonb;
begin
 select * into strict a from training_accounts where user_id=p_user for update;
 d:=(now() at time zone a.time_zone)::date; monday:=date_trunc('week',d)::date;
 insert into gf_accounts(user_id) values(p_user) on conflict do nothing;
 perform gf_create_mission_cycle(p_user,d);
 -- Only cycles actually issued to this account are eligible, never invented old cycles.
 for c in select * from gf_cycles where user_id=p_user and week_start<=monday and not finalized order by week_start loop
  closed:=d>=c.week_start+7;
  select count(*) filter(where kind in('training','compensatory') and completed),
   count(*) filter(where kind in('training','compensatory') and not completed and day<d)
   into done,misses from gf_days_between(p_user,c.starts_on,least(d,c.week_start+6));
  select count(distinct e.day) into weights from weight_entries e where e.user_id=p_user
   and e.legacy_day is null and e.day between c.starts_on and least(d,c.week_start+6)
   and e.confirmed_at<((e.day+1)::timestamp at time zone a.time_zone);
  for m in select * from gf_missions where user_id=p_user and week_start=c.week_start loop
   if m.claimed_at is not null then continue; end if;
   value:=case m.key when 'workouts' then done when 'weight' then weights
    when 'schedule' then case when misses=0 then
     (select count(*) from gf_days_between(p_user,c.starts_on,least(d,c.week_start+6)) x
       where x.day=any(c.planned_days) and (x.kind not in('training','compensatory') or x.completed)) else 0 end
    when 'consistency' then case when misses=0 then least(d,c.week_start+7)-c.starts_on else 0 end else 0 end;
   value:=least(m.target,value);
   update gf_missions set progress=value where user_id=p_user and week_start=c.week_start and key=m.key;
   if value=m.target and (m.key in('workouts','weight') or (closed and done>0)) then
    perform economy_post(p_user,'mission:'||c.week_start||':'||m.key,'mission','Missão semanal concluída',m.reward,d);
    update gf_missions set claimed_at=clock_timestamp() where user_id=p_user and week_start=c.week_start and key=m.key;
   end if;
  end loop;
  if exists(select 1 from gf_missions where user_id=p_user and week_start=c.week_start)
    and not exists(select 1 from gf_missions where user_id=p_user and week_start=c.week_start and claimed_at is null) then
   perform economy_post(p_user,'weekly-bonus:'||c.week_start,'weekly-bonus','Todas as missões da semana', (c.rewards->>'bonus')::integer,d);
  end if;
  if closed then update gf_cycles set finalized=true where user_id=p_user and week_start=c.week_start; end if;
 end loop;
 select jsonb_build_object('weekStart',monday,'timezone',a.time_zone,'endsAt',(monday+7)::timestamp at time zone a.time_zone,
  'bonus',coalesce((select rewards->'bonus' from gf_cycles where user_id=p_user and week_start=monday),'0'::jsonb),
  'startsOn',coalesce((select starts_on from gf_cycles where user_id=p_user and week_start=monday),d),
  'policy',coalesce((select coalesce((rewards->>'policy')::integer,1) from gf_cycles where user_id=p_user and week_start=monday),2),
  'missions',coalesce(jsonb_agg(jsonb_build_object('key',key,'target',target,'progress',progress,'reward',reward,'claimedAt',claimed_at) order by key),'[]'))
 into result from gf_missions where user_id=p_user and week_start=monday;
 return result;
end $$;

-- A missing plan is pending setup in the Arena, never an authorized rest.
create or replace function public.get_social_state() returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=social_require_profile(); payload jsonb; groups_value jsonb:='[]'; item jsonb; g streak_groups; d date; members_value jsonb;
begin
 payload:=workout_base_social_state();
 for item in select value from jsonb_array_elements(payload->'groups') loop
  select * into strict g from streak_groups where id=(item->>'id')::uuid;
  d:=(now() at time zone g.time_zone)::date;
  select coalesce(jsonb_agg(m||case when (m->>'accepted')::boolean and training_day_kind((m->>'id')::uuid,d,d::timestamp at time zone g.time_zone,(d+1)::timestamp at time zone g.time_zone)='unplanned'
   then jsonb_build_object('resting',false,'needsPlan',true) else jsonb_build_object('needsPlan',false) end),'[]'::jsonb)
   into members_value from jsonb_array_elements(item->'members') m;
  groups_value:=groups_value||jsonb_build_array(item||jsonb_build_object('members',members_value));
 end loop;
 payload:=jsonb_set(payload,'{groups}',groups_value);
 return jsonb_set(payload,'{workouts}',coalesce((select jsonb_agg(workout_record_json(w) order by w.day) from workout_days w where user_id=u),'[]'::jsonb));
end $$;

revoke all on function public.training_has_plan(uuid,date),public.save_training_plan(integer[],integer,text,boolean) from public,anon,authenticated;
grant execute on function public.save_training_plan(integer[],integer,text,boolean) to authenticated;
-- Replaced helpers retain their private ACLs. Existing plans, rewards and frozen
-- mission/group/day/week/challenge snapshots are never removed or recalculated.
notify pgrst,'reload schema';
commit;
