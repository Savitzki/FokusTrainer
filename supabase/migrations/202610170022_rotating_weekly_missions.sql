-- At most three attainable rotating missions for new cycles. Issued cycles stay intact.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

create function public.gf_mission_variant(p_monday date) returns integer
language sql immutable set search_path=public,pg_temp as $$
 select (((p_monday-date '2026-10-12')/7%4)+4)%4;
$$;

-- Private issuance helper. The caller supplies the account's server date, never a client date.
create function public.gf_create_mission_cycle(p_user uuid,p_day date) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare a training_accounts; monday date; first_day date; dates date[]; n integer; variant integer; r gf_rules;
begin
 select * into strict a from training_accounts where user_id=p_user for update;
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
  'bonus',(select rewards->'bonus' from gf_cycles where user_id=p_user and week_start=monday),
  'startsOn',(select starts_on from gf_cycles where user_id=p_user and week_start=monday),
  'policy',(select coalesce((rewards->>'policy')::integer,1) from gf_cycles where user_id=p_user and week_start=monday),
  'missions',coalesce(jsonb_agg(jsonb_build_object('key',key,'target',target,'progress',progress,'reward',reward,'claimedAt',claimed_at) order by key),'[]'))
 into result from gf_missions where user_id=p_user and week_start=monday;
 return result;
end $$;

revoke all on function public.gf_mission_variant(date),public.gf_create_mission_cycle(uuid,date),public.gf_sync_missions(uuid) from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
