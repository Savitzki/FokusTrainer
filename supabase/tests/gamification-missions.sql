\ir gamification-fixture.sql
insert into workout_days(user_id,day,activity,minutes,confirmed_at)
 select auth.uid(),date_trunc('week',now())::date-7+x,'Caminhada',30,(date_trunc('week',now())::date-7+x)::timestamp+interval '12 hours' from unnest(array[0,2,3,4,5]) x;
insert into training_reschedules(user_id,original_day,target_day,week_start,created_at,revision) values(auth.uid(),date_trunc('week',now())::date-6,date_trunc('week',now())::date-2,date_trunc('week',now())::date-7,date_trunc('week',now())-interval '6 days',2);
insert into weight_entries(user_id,id,day,kg,recorded_at,confirmed_at)
 select auth.uid(),gen_random_uuid(),date_trunc('week',now())::date-7+x,75,(date_trunc('week',now())::date-7+x)::timestamp+interval '10 hours',(date_trunc('week',now())::date-7+x)::timestamp+interval '10 hours' from generate_series(0,1) x;
do $$ begin perform get_gamification_state('UTC'); end $$;
select pg_temp.check_ok((select count(*)=4 and min(target)>0 from gf_missions where user_id=auth.uid()),'generate four missions');
select pg_temp.check_ok((select target=3 from gf_missions where user_id=auth.uid() and key='workouts'),'adapt three workouts to plan');
select pg_temp.check_ok((select cardinality(planned_days)=5 from gf_cycles where user_id=auth.uid()),'freeze five planned dates');
-- Explicitly issued past cycle simulates the next Monday; no clock mocking or production writes.
insert into gf_cycles(user_id,week_start,starts_on,planned_days,rewards)
select auth.uid(),date_trunc('week',now())::date-7,date_trunc('week',now())::date-7,
 array(select date_trunc('week',now())::date-7+x from generate_series(0,4) x),'{"bonus":50}';
insert into gf_missions(user_id,week_start,key,target,reward) select auth.uid(),date_trunc('week',now())::date-7,key,target,reward from gf_missions where user_id=auth.uid();
do $$ begin perform get_gamification_state('Pacific/Kiritimati'); end $$;
do $$ begin perform get_gamification_state('UTC'); end $$;
select pg_temp.check_ok((select count(*)=4 from gf_missions where user_id=auth.uid() and claimed_at is not null),'complete missions on closed week');
select pg_temp.check_ok((select count(*)=5 and sum(amount)=120 from coin_movements where user_id=auth.uid() and kind in('mission','weekly-bonus')),'unique rewards 10+10+20+30+50');
select pg_temp.check_ok((select time_zone='UTC' from training_accounts where user_id=auth.uid()),'device timezone cannot reset week');
select save_training_plan(array[2,3,4,5,6],(select revision from training_accounts where user_id=auth.uid()),'UTC');
select pg_temp.check_ok((select target=5 from gf_missions where user_id=auth.uid() and week_start=date_trunc('week',now())::date and key='schedule'),'schedule edits never reduce issued target');
select pg_temp.check_ok(not has_table_privilege('authenticated','gf_missions','UPDATE') and not has_function_privilege('authenticated','gf_sync_missions(uuid)','EXECUTE'),'server owns mission rewards');
select 'PASS missions: generation, frozen targets, Monday rollover, no duplicate coins, fixed timezone, permissions';
rollback;
