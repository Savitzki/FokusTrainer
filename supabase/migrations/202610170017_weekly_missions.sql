-- Stage 1. Apply after 016, only with explicit production authorization.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
create table public.gf_rules (
 singleton boolean primary key default true check(singleton),
 simple_reward integer not null default 10 check(simple_reward between 0 and 100),
 medium_reward integer not null default 20 check(medium_reward between 0 and 100),
 hard_reward integer not null default 30 check(hard_reward between 0 and 100),
 all_reward integer not null default 50 check(all_reward between 0 and 100),
 challenge_participation integer not null default 2 check(challenge_participation between 0 and 20),
 challenge_winner integer not null default 5 check(challenge_winner between 0 and 20),
 rewarded_challenges_per_month integer not null default 3 check(rewarded_challenges_per_month between 0 and 10)
);
insert into public.gf_rules(singleton) values(true);
create table public.gf_accounts (
 user_id uuid primary key references public.training_accounts(user_id) on delete cascade,
 enrolled_at timestamptz not null default clock_timestamp()
);
-- Derived closed-day snapshots. Original records, schedules and group snapshots stay intact.
create table public.gf_days (
 user_id uuid not null references public.training_accounts(user_id) on delete cascade,
 day date not null, kind text not null, completed boolean not null, minutes integer not null,
 primary key(user_id,day)
);
create table public.gf_cycles (
 user_id uuid not null references public.gf_accounts(user_id) on delete cascade,
 week_start date not null, starts_on date not null, planned_days date[] not null,
 rewards jsonb not null, finalized boolean not null default false, primary key(user_id,week_start),
 check(extract(isodow from week_start)=1 and starts_on between week_start and week_start+6)
);
create table public.gf_missions (
 user_id uuid not null, week_start date not null, key text not null,
 target integer not null check(target>0), progress integer not null default 0 check(progress>=0),
 reward integer not null check(reward between 0 and 100), claimed_at timestamptz,
 primary key(user_id,week_start,key),
 foreign key(user_id,week_start) references public.gf_cycles(user_id,week_start) on delete cascade
);
alter table public.coin_movements drop constraint coin_movements_kind_check;
alter table public.coin_movements drop constraint coin_movements_check;
alter table public.coin_movements add constraint coin_movements_kind_check
 check(kind in('workout','weight','kit-purchase','mission','weekly-bonus','challenge','cosmetic-purchase'));
alter table public.coin_movements add constraint coin_movements_check
 check((kind in('kit-purchase','cosmetic-purchase') and amount<0) or
 (kind not in('kit-purchase','cosmetic-purchase') and amount>0));

create function public.gf_day(p_user uuid,p_day date)
returns table(day date,kind text,completed boolean,minutes integer)
language plpgsql security definer set search_path=public,pg_temp as $$
declare tz text; today_value date; k text; done boolean; duration integer;
begin
 select time_zone into strict tz from training_accounts where user_id=p_user;
 today_value:=(now() at time zone tz)::date;
 if p_day<today_value and exists(select 1 from gf_days g where g.user_id=p_user and g.day=p_day) then
  return query select g.day,g.kind,g.completed,g.minutes from gf_days g where g.user_id=p_user and g.day=p_day; return;
 end if;
 k:=training_day_kind(p_user,p_day,p_day::timestamp at time zone tz,(p_day+1)::timestamp at time zone tz);
 if k='training' and exists(select 1 from training_reschedules r where r.user_id=p_user and r.target_day=p_day and r.created_at<((p_day+1)::timestamp at time zone tz)) then k:='compensatory'; end if;
 select true,w.minutes into done,duration from workout_days w where w.user_id=p_user and w.day=p_day
  and w.confirmed_at<least(clock_timestamp()+interval '1 second',(p_day+1)::timestamp at time zone tz);
 done:=coalesce(done,false); duration:=coalesce(duration,0);
 if p_day<today_value then
  insert into gf_days(user_id,day,kind,completed,minutes) values(p_user,p_day,k,done,duration) on conflict do nothing;
  return query select g.day,g.kind,g.completed,g.minutes from gf_days g where g.user_id=p_user and g.day=p_day;
 else return query select p_day,k,done,duration; end if;
end $$;
create function public.gf_days_between(p_user uuid,p_from date,p_to date)
returns table(day date,kind text,completed boolean,minutes integer)
language sql security definer set search_path=public,pg_temp as $$
 select x.* from generate_series(p_from::timestamp,p_to::timestamp,interval '1 day') d
 cross join lateral gf_day(p_user,d::date) x;
$$;

create function public.gf_sync_missions(p_user uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare a training_accounts; d date; monday date; c gf_cycles; m gf_missions; dates date[];
 r gf_rules; first_day date; n integer; value integer; misses integer; done integer; weights integer; closed boolean; result jsonb;
begin
 select * into strict a from training_accounts where user_id=p_user for update;
 d:=(now() at time zone a.time_zone)::date; monday:=date_trunc('week',d)::date;
 insert into gf_accounts(user_id) values(p_user) on conflict do nothing;
 if not exists(select 1 from gf_cycles where user_id=p_user and week_start=monday) then
  select * into strict r from gf_rules where singleton;
  first_day:=greatest(monday,a.started_on);
  select coalesce(array_agg(x::date order by x),'{}'::date[]) into dates
   from generate_series(first_day::timestamp,(monday+6)::timestamp,interval '1 day') x
   where training_schedule_kind(p_user,x::date)='training';
  insert into gf_cycles(user_id,week_start,starts_on,planned_days,rewards)
   values(p_user,monday,first_day,dates,jsonb_build_object('bonus',r.all_reward));
  n:=cardinality(dates);
  if n>0 then
   insert into gf_missions(user_id,week_start,key,target,reward) values
   (p_user,monday,'workouts',least(3,n),r.simple_reward),
   (p_user,monday,'weight',least(2,monday+7-first_day),r.simple_reward),
   (p_user,monday,'schedule',n,r.medium_reward),
   (p_user,monday,'consistency',monday+7-first_day,r.hard_reward);
  end if;
 end if;
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
  'missions',coalesce(jsonb_agg(jsonb_build_object('key',key,'target',target,'progress',progress,'reward',reward,'claimedAt',claimed_at) order by key),'[]'))
 into result from gf_missions where user_id=p_user and week_start=monday;
 return result;
end $$;
create function public.get_gamification_state(p_timezone text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); result jsonb; extra jsonb;
begin
 perform get_training_state(p_timezone);
 result:=jsonb_build_object('weekly',gf_sync_missions(u),'economyRevision',(select revision from coin_wallets where user_id=u),
  'features',jsonb_build_object('reports',to_regprocedure('public.get_progress_report(text,date,text)') is not null,'challenges',to_regprocedure('public.get_friend_challenges()') is not null));
 -- Subsequent stages add private extensions, so each migration is deployable independently.
 if to_regprocedure('public.gf_badges_state(uuid)') is not null then
  execute 'select public.gf_badges_state($1)' into extra using u; result:=result||jsonb_build_object('achievements',extra);
 end if;
 if to_regprocedure('public.gf_cosmetics_state(uuid)') is not null then
  execute 'select public.gf_cosmetics_state($1)' into extra using u; result:=result||jsonb_build_object('cosmetics',extra);
 end if;
 return result;
end $$;
do $$ declare t text; f regprocedure; begin
 foreach t in array array['gf_rules','gf_accounts','gf_days','gf_cycles','gf_missions'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
 end loop;
 for f in select oid::regprocedure from pg_proc where pronamespace='public'::regnamespace and left(proname,3)='gf_' loop execute format('revoke all on function %s from public,anon,authenticated',f); end loop;
end $$;
revoke all on function public.get_gamification_state(text) from public,anon,authenticated;
grant execute on function public.get_gamification_state(text) to authenticated;
notify pgrst,'reload schema';
commit;
