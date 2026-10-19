-- Flexible locked plans, authenticated historical streak calendar and safe goals.
-- Existing plan revisions, workouts, wallets and consolidated results are untouched.
begin;
set local lock_timeout='5s';set local statement_timeout='60s';
create or replace function public.save_training_plan(p_training_days integer[],p_revision integer,p_timezone text,p_replace boolean) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid();a training_accounts;d date;effective date;previous integer;conflicts text;g streak_groups;
begin
 perform get_training_state(p_timezone);
 select * into strict a from training_accounts where user_id=u for update;
 if p_revision is distinct from a.revision then raise exception 'Sua programação mudou em outro aparelho. Atualize e tente novamente.';end if;
 if p_training_days is null or cardinality(p_training_days) not between 1 and 7 or
  (select count(distinct x) from unnest(p_training_days) x where x between 1 and 7)<>cardinality(p_training_days)
 then raise exception 'Escolha de 1 a 7 dias de treino, sem repetições.';end if;
 select revision into previous from training_plans where user_id=u order by effective_on desc,revision desc limit 1;
 if p_replace is null or p_replace is distinct from (previous is not null) then raise exception 'Crie seu primeiro plano ou confirme Substituir plano.';end if;
 d:=(clock_timestamp() at time zone a.time_zone)::date;
 effective:=case when previous is null then d else d+1 end;
 -- Accepted open challenges retain their existing criteria. A permanent plan
 -- change may not reclassify any obligation inside their remaining period.
 select string_agg(to_char(x.day,'DD/MM/YYYY'),', ' order by x.day) into conflicts from (
  select distinct z::date as day from gf_challenge_members m
   join gf_challenges c on c.id=m.challenge_id
   cross join lateral generate_series(greatest(effective,c.starts_on)::timestamp,c.ends_on::timestamp,interval '1 day') z
  where m.user_id=u and m.status='accepted' and c.settled_at is null and not c.cancelled
   and not exists(select 1 from training_reschedules r where r.user_id=u and z::date in(r.original_day,r.target_day))
   and (training_schedule_kind(u,z::date)='training') is distinct from (extract(isodow from z)::integer=any(p_training_days))) x;
 if conflicts is not null then raise exception 'Um desafio aceito depende das datas %. Preserve esses dias até o encerramento do desafio.',conflicts;end if;
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
 update gf_cycles set rewards=jsonb_set(rewards,'{planningPolicy}','2'::jsonb)
 where user_id=u and week_start=date_trunc('week',effective)::date and not finalized;
 if previous is null then
  for g in select s.* from streak_groups s join group_members m on m.group_id=s.id
   where m.user_id=u and m.status='accepted' and s.status='active' order by s.id loop perform social_refresh_day(g.id);end loop;
 end if;
 return training_state(u);
end $$;

-- Frozen mission targets cannot be completed merely by removing future obligations.
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
  values(p_user,monday,first_day,dates,jsonb_build_object('bonus',r.all_reward,'policy',2,'planningPolicy',2));
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
     (case when coalesce((c.rewards->>'planningPolicy')::integer,1)=2 then (select count(*) from unnest(c.planned_days) original(day)
       cross join lateral gf_day(p_user,coalesce((select target_day from training_reschedules
         where user_id=p_user and original_day=original.day),original.day)) x
       where x.day<=least(d,c.week_start+6) and
        ((x.kind in('training','compensatory') and x.completed) or x.kind in('extra-rest','medical-kit'))) else (select count(*) from gf_days_between(p_user,c.starts_on,least(d,c.week_start+6)) x
       where x.day=any(c.planned_days) and (x.kind not in('training','compensatory') or x.completed)) end) else 0 end
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

-- Read a single month using the same fixed timezone and immutable day snapshots
-- as achievements/reports. No invented rest streak, future streak or client clock.
create function public.get_training_calendar(p_month date,p_timezone text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=social_require_profile();a training_accounts;first_day date;last_day date;
 d date;r record;run integer:=0;result jsonb:='[]';today_value date;month_start date;
begin
 if p_month is null or p_month<date '2000-01-01' or p_month>=date '9999-01-01' then raise exception 'Mês inválido.';end if;
 perform get_training_state(p_timezone);
 select * into strict a from training_accounts where user_id=u for update;
 today_value:=(now() at time zone a.time_zone)::date;
 month_start:=date_trunc('month',p_month)::date;
 last_day:=(month_start+interval '1 month')::date-1;
 first_day:=gf_tracking_start(u);
 if month_start<=today_value then
  for r in select * from gf_days_between(u,first_day,least(last_day,today_value)) order by day loop
   if r.kind in('training','compensatory') then
    if r.completed then run:=run+1;elsif r.day<today_value then run:=0;end if;
   end if;
   if r.day>=month_start then
    result:=result||jsonb_build_array(jsonb_build_object('day',r.day,'kind',r.kind,
     'completed',r.completed,'active',run>0 and r.kind<>'unplanned','streak',run));
   end if;
  end loop;
 end if;
 -- Dates before tracking and in the future stay neutral, never predicted active.
 for d in select x::date from generate_series(month_start::timestamp,last_day::timestamp,interval '1 day') x
  where x::date<first_day or x::date>today_value loop
  result:=result||jsonb_build_array(jsonb_build_object('day',d,
   'kind',case when d<first_day then 'unplanned' else training_day_kind(u,d) end,
   'completed',false,'active',false,'streak',0));
 end loop;
 return jsonb_build_object('month',to_char(month_start,'YYYY-MM'),'today',today_value,'timezone',a.time_zone,
  'revision',a.revision,'days',(select coalesce(jsonb_agg(x order by x->>'day'),'[]') from jsonb_array_elements(result) x));
end $$;
revoke all on function public.get_training_calendar(date,text) from public,anon,authenticated;
grant execute on function public.get_training_calendar(date,text) to authenticated;

notify pgrst,'reload schema';
commit;
