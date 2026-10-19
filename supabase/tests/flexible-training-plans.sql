\ir gamification-fixture.sql
create function pg_temp.rejects(command text,expected text) returns void language plpgsql as $$begin
 begin execute command;exception when others then if sqlerrm not like '%'||expected||'%' then raise exception 'Unexpected rejection: %',sqlerrm;end if;return;end;
 raise exception 'FAIL accepted forbidden operation: %',command;
end $$;
create function pg_temp.calendar_day(payload jsonb,d date) returns jsonb language sql as $$select x from jsonb_array_elements(payload->'days') x where x->>'day'=d::text;$$;
-- Every supported frequency uses real authenticated APIs; no clock changes.
do $$ declare n integer;u uuid;state jsonb;days integer[];c jsonb;begin
 for n in 1..7 loop
  u:=('f9000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid;
  insert into auth.users(id) values(u);insert into profiles(id,nickname) values(u,'flexible.'||n);
  perform set_config('request.jwt.claim.sub',u::text,true);
  state:=get_training_state('UTC');
  perform pg_temp.check_ok((state->>'planRequired')::boolean,'first plan required');
  select array_agg(x order by x) into days from (select x from generate_series(1,7)x order by (x=extract(isodow from current_date)::integer) desc,x limit n) z;
  state:=save_training_plan(days,0,'UTC',false);
  perform pg_temp.check_ok(jsonb_array_length(state#>'{plans,0,trainingDays}')=n,'frequency 1–7 persisted');
  perform pg_temp.check_ok((state#>>'{plans,0,effectiveFrom}')::date=current_date,'first plan immediate');
  perform get_gamification_state('UTC');
  perform pg_temp.check_ok(not exists(select 1 from gf_missions where user_id=u and key='workouts' and target>n),'missions within personal obligations');
  perform confirm_manual_workout(gen_random_uuid(),current_date,'Caminhada',35,'{"version":1,"questionIds":["real","honest"],"answers":[true,true,true]}','UTC');
  perform pg_temp.check_ok((gf_streak(u)->>'current')::integer=1,'mandatory workout scores for each frequency');
  perform pg_temp.check_ok((select count(*)=1 and sum(amount)=10 from coin_movements where user_id=u and kind='workout'),'one standard workout reward');
  perform pg_temp.rejects(format('select confirm_manual_workout(gen_random_uuid(),current_date,''Caminhada'',35,''{"version":1,"questionIds":["real","honest"],"answers":[true,true,true]}'',''UTC'')'),'já foi confirmado');
  c:=get_training_calendar(current_date,'Pacific/Kiritimati');
  perform pg_temp.check_ok(c->>'timezone'='UTC' and (c->>'today')::date=current_date,'calendar uses pinned timezone');
  perform pg_temp.check_ok((pg_temp.calendar_day(c,current_date)->>'active')::boolean,'confirmed mandatory day active');
 end loop;
end $$;
set local request.jwt.claim.sub='f9000000-0000-4000-8000-000000000005';
select pg_temp.rejects($q$select save_training_plan('{}',1,'UTC',true)$q$,'1 a 7');
select pg_temp.rejects($q$select save_training_plan(array[0,2],1,'UTC',true)$q$,'1 a 7');
select pg_temp.rejects($q$select save_training_plan(array[1,1],1,'UTC',true)$q$,'1 a 7');
select pg_temp.rejects($q$select save_training_plan(array[1,2,3,4,5,6,7,8],1,'UTC',true)$q$,'1 a 7');
create temp table flexible_before as select
 (select jsonb_agg(to_jsonb(w)) from workout_days w where user_id=auth.uid()) workouts,
 (select jsonb_agg(to_jsonb(m) order by key) from gf_missions m where user_id=auth.uid()) missions,
 (select jsonb_agg(to_jsonb(m) order by id) from coin_movements m where user_id=auth.uid()) coins;
select save_training_plan(array[1,3,5],1,'Pacific/Kiritimati',true);
select pg_temp.check_ok((select effective_on=current_date+1 and cardinality(training_days)=3 from training_plans where user_id=auth.uid() and revision=2),'replacement starts tomorrow');
select pg_temp.check_ok((select cardinality(training_days)=5 from training_plans where user_id=auth.uid() and revision=1),'old five-day plan unchanged');
select pg_temp.check_ok((select workouts=(select jsonb_agg(to_jsonb(w)) from workout_days w where user_id=auth.uid()) and coins=(select jsonb_agg(to_jsonb(m) order by id) from coin_movements m where user_id=auth.uid()) and missions=(select jsonb_agg(to_jsonb(m) order by key) from gf_missions m where user_id=auth.uid()) from flexible_before),'replacement writes no rewards, workouts or mission targets');
select save_training_plan(array[1,2],2,'UTC',true);
select pg_temp.check_ok((select count(*)=3 from training_plans where user_id=auth.uid()) and (training_state(auth.uid())#>>'{plans,2,effectiveFrom}')::date=current_date+1,'pending replacement appends one revision on same effective date');
select pg_temp.rejects($q$select save_training_plan(array[2,4],2,'UTC',true)$q$,'outro aparelho');
-- Accepted challenges retain their criteria: block future permanent reclassification.
insert into friendships(requester,recipient,status) values(auth.uid(),'f9000000-0000-4000-8000-000000000002','accepted');
select create_friend_challenge('Preserve criteria','frequency',7,array['f9000000-0000-4000-8000-000000000002'::uuid],1,'UTC') as challenge_id \gset
create temp table challenge_before as select to_jsonb(c) value from gf_challenges c where id=:'challenge_id';
select pg_temp.rejects($q$select save_training_plan(array[7],3,'UTC',true)$q$,'desafio aceito');
select pg_temp.check_ok((select b.value=to_jsonb(c) from gf_challenges c cross join challenge_before b where c.id=:'challenge_id'),'challenge targets and dates unchanged');
-- A single mandatory Monday may move to Tuesday without manufacturing a second obligation.
insert into auth.users(id) values('f9000000-0000-4000-8000-000000000030');
insert into profiles(id,nickname) values('f9000000-0000-4000-8000-000000000030','flexible.swap');
set local request.jwt.claim.sub='f9000000-0000-4000-8000-000000000030';
select save_training_plan(array[1],0,'UTC',false);
select reschedule_training(date_trunc('week',now())::date+7,date_trunc('week',now())::date+8,1,'UTC');
select pg_temp.check_ok(training_day_kind(auth.uid(),date_trunc('week',now())::date+7)='rescheduled-rest' and training_day_kind(auth.uid(),date_trunc('week',now())::date+8)='training','one-day plan supports existing swap rules');
select pg_temp.rejects($q$select save_training_plan(array[2],2,'UTC',true)$q$,'reagendamentos');
-- A valid swap is an exception, never a changed permanent plan in a challenge.
insert into gf_challenges(id,owner_id,name,kind,starts_on,ends_on,invite_until,target,rewards) values('f9000000-0000-4000-8000-000000000031',auth.uid(),'Keep exception','frequency',date_trunc('week',now())::date+7,date_trunc('week',now())::date+13,date_trunc('week',now())+interval '7 days',1,'{"participation":0,"winner":0}');
insert into gf_challenge_members(challenge_id,user_id,nickname,status,timezone,quota,accepted_at) values('f9000000-0000-4000-8000-000000000031',auth.uid(),'flexible.swap','accepted','UTC',1,now());
select save_training_plan(array[1],2,'UTC',true);
select pg_temp.check_ok(training_day_kind(auth.uid(),date_trunc('week',now())::date+7)='rescheduled-rest' and training_day_kind(auth.uid(),date_trunc('week',now())::date+8)='training','unchanged plan preserves accepted challenge and swap');
-- Historical streak across a month boundary: rest preserves only an existing run.
insert into auth.users(id) values('f9000000-0000-4000-8000-000000000020');
insert into profiles(id,nickname) values('f9000000-0000-4000-8000-000000000020','flexible.history');
set local request.jwt.claim.sub='f9000000-0000-4000-8000-000000000020';
-- Use a fully closed month, independent of CI day/time.
select (date_trunc('month',now())-interval '1 month')::date as first \gset
insert into training_accounts(user_id,time_zone,started_on,revision) values(auth.uid(),'UTC',:'first'::date-3,2);
insert into training_plans(user_id,revision,effective_on,training_days,created_at) values(auth.uid(),1,:'first'::date-3,array[1,2,3,4,5,6,7],(:'first'::date-4)::timestamp);
insert into training_plans(user_id,revision,effective_on,training_days,created_at)
values(auth.uid(),2,:'first'::date-2,array(select n from generate_series(1,7)n where n<>extract(isodow from :'first'::date-2)::integer),(:'first'::date-3)::timestamp);
insert into workout_days(user_id,day,activity,minutes,confirmed_at)
select auth.uid(),d,'Corrida',35,d::timestamp+interval '12 hours' from unnest(array[:'first'::date-3,:'first'::date+1]) d;
insert into coin_wallets(user_id) values(auth.uid()) on conflict do nothing;
insert into medical_kits(user_id,grant_month,grant_slot,used_on,used_at) values(auth.uid(),date_trunc('month',:'first'::date-1)::date,1,:'first'::date-1,(:'first'::date-1)::timestamp+interval '12 hours');
insert into training_extra_rests(user_id,day,authorized_at) values(auth.uid(),:'first'::date+2,(:'first'::date+2)::timestamp+interval '10 hours');
insert into training_reschedules(user_id,original_day,target_day,week_start,created_at,revision) values(auth.uid(),:'first'::date+4,:'first'::date+5,date_trunc('week',:'first'::date+4)::date,(:'first'::date+4)::timestamp+interval '10 hours',3);
update training_accounts set revision=3 where user_id=auth.uid();
insert into workout_days(user_id,day,activity,minutes,confirmed_at) values(auth.uid(),:'first'::date+5,'Compensatório',35,(:'first'::date+5)::timestamp+interval '12 hours');
create temp table calendar_before as select get_training_calendar(:'first'::date-1,'UTC') prior,get_training_calendar(:'first'::date,'UTC') current;
select pg_temp.check_ok((pg_temp.calendar_day(prior,:'first'::date-2)->>'active')::boolean,'scheduled rest preserves an existing streak across month') from calendar_before;

select pg_temp.check_ok((pg_temp.calendar_day(prior,:'first'::date-1)->>'active')::boolean and pg_temp.calendar_day(prior,:'first'::date-1)->>'kind'='medical-kit','medical protection preserves historical run') from calendar_before;
select pg_temp.check_ok(not(pg_temp.calendar_day(prior,:'first'::date-4)->>'active')::boolean,'pretracking days are neutral') from calendar_before;
select pg_temp.check_ok(not(pg_temp.calendar_day(current,:'first'::date)->>'active')::boolean,'unprotected missed mandatory day breaks streak') from calendar_before;
select pg_temp.check_ok((pg_temp.calendar_day(current,:'first'::date+2)->>'active')::boolean,'extra rest preserves resumed run') from calendar_before;
select pg_temp.check_ok(not(pg_temp.calendar_day(current,:'first'::date+4)->>'active')::boolean,'rescheduled rest cannot invent a streak') from calendar_before;
select pg_temp.check_ok((pg_temp.calendar_day(current,:'first'::date+5)->>'active')::boolean and pg_temp.calendar_day(current,:'first'::date+5)->>'kind'='compensatory','compensatory confirmed day counts') from calendar_before;
select save_training_plan(array[2,4,6],3,'UTC',true);
select pg_temp.check_ok((get_training_calendar(:'first'::date-1,'Pacific/Kiritimati')->'days')=prior->'days' and (get_training_calendar(:'first'::date,'UTC')->'days')=current->'days','new plan never repaints consolidated historical days') from calendar_before;
select pg_temp.check_ok(not exists(select 1 from jsonb_array_elements(get_training_calendar((current_date+interval '1 month')::date,'UTC')->'days') x where (x->>'active')::boolean),'future dates are never predicted active');
-- Frozen goals cannot be fulfilled merely by removing mandatory days.
insert into auth.users(id) values('f9000000-0000-4000-8000-000000000040');
insert into profiles(id,nickname) values('f9000000-0000-4000-8000-000000000040','flexible.goals');
set local request.jwt.claim.sub='f9000000-0000-4000-8000-000000000040';
insert into training_accounts(user_id,time_zone,started_on,revision) values(auth.uid(),'UTC',date_trunc('week',now())::date-7,1);
insert into training_plans(user_id,revision,effective_on,training_days,created_at) values(auth.uid(),1,date_trunc('week',now())::date-7,array[1],date_trunc('week',now())-interval '8 days');
insert into workout_days(user_id,day,activity,minutes,confirmed_at) values(auth.uid(),date_trunc('week',now())::date-7,'Caminhada',35,date_trunc('week',now())-interval '6 days 12 hours');
insert into gf_accounts(user_id) values(auth.uid());
insert into gf_cycles(user_id,week_start,starts_on,planned_days,rewards) values(auth.uid(),date_trunc('week',now())::date-7,date_trunc('week',now())::date-7,array(select date_trunc('week',now())::date-7+x from generate_series(0,4)x),'{"bonus":50,"policy":2,"planningPolicy":2}');
insert into gf_missions(user_id,week_start,key,target,reward) values(auth.uid(),date_trunc('week',now())::date-7,'schedule',5,20);
select get_gamification_state('UTC');
select pg_temp.check_ok((select target=5 and progress=1 and claimed_at is null from gf_missions where user_id=auth.uid() and week_start=date_trunc('week',now())::date-7 and key='schedule'),'reduction does not lower or automatically finish issued target');
select pg_temp.check_ok(not exists(select 1 from coin_movements where user_id=auth.uid() and kind in('mission','weekly-bonus')),'no reward from a schedule change');
-- Public clients cannot inspect snapshots or request another account's calendar.
set local role authenticated;
select pg_temp.check_ok((get_training_calendar(current_date,'UTC')->>'timezone')='UTC','authenticated own calendar available');
select pg_temp.rejects('select * from gf_days','permission denied');
reset role;
set local role anon;
select pg_temp.rejects('select get_training_calendar(current_date,''UTC'')','permission denied');
reset role;
select 'PASS flexible plans: 1–7, immediate/future revisions, frozen goals/challenges, standard confirmation/rewards, one-day reschedule, historical streak across months, rests/kits, RLS and timezone';
rollback;
