\ir gamification-fixture.sql
-- Four consecutive Mondays rotate gently, without exceeding five planned workouts.
do $$ declare i integer; w date; target_value integer; n integer; v integer; before_value jsonb; after_value jsonb; begin
 for i in 0..3 loop
  w:=date_trunc('week',now())::date+7*i;
  perform gf_create_mission_cycle(auth.uid(),w);
  select cardinality(planned_days) into n from gf_cycles where user_id=auth.uid() and week_start=w;
  perform pg_temp.check_ok(n=5,'keep five effective training dates');
  perform pg_temp.check_ok((select count(*)=3 and min(target)>0 from gf_missions where user_id=auth.uid() and week_start=w),'at most three positive targets');
  v:=gf_mission_variant(w);
  perform pg_temp.check_ok((select target=least(2+v%2,n) from gf_missions where user_id=auth.uid() and week_start=w and key='workouts'),'two or three workouts within plan');
  perform pg_temp.check_ok((select target=1+v/2 from gf_missions where user_id=auth.uid() and week_start=w and key='weight'),'one or two distinct weight days');
  perform pg_temp.check_ok(exists(select 1 from gf_missions where user_id=auth.uid() and week_start=w and key=case when v%2=0 then 'schedule' else 'consistency' end),'rotate plan and consistency');
  select jsonb_agg(to_jsonb(m) order by key) into before_value from gf_missions m where user_id=auth.uid() and week_start=w;
  perform gf_create_mission_cycle(auth.uid(),w+2);
  select jsonb_agg(to_jsonb(m) order by key) into after_value from gf_missions m where user_id=auth.uid() and week_start=w;
  perform pg_temp.check_ok(before_value=after_value,'refresh cannot reroll or lower targets');
 end loop;
 perform pg_temp.check_ok((select count(distinct gf_mission_variant(date_trunc('week',now())::date+7*x))=4 from generate_series(0,3) x),'four-week variety');
end $$;

-- First visit on a rest-only Sunday never asks for an extra workout or a lost weekday.
select gf_create_mission_cycle('a0000000-0000-4000-8000-000000000002',date_trunc('week',now())::date-1);
select pg_temp.check_ok((select count(*)=1 and min(key)='weight' and min(target)=1 from gf_missions where user_id='a0000000-0000-4000-8000-000000000002' and week_start=date_trunc('week',now())::date-7),'Sunday rest has one attainable weight mission');
insert into weight_entries(user_id,id,day,kg,recorded_at,confirmed_at) values
 ('a0000000-0000-4000-8000-000000000002',gen_random_uuid(),date_trunc('week',now())::date-1,75,(date_trunc('week',now())::date-1)::timestamp+interval '10 hours',(date_trunc('week',now())::date-1)::timestamp+interval '10 hours');
set request.jwt.claim.sub='a0000000-0000-4000-8000-000000000002';
do $$ begin perform get_gamification_state('UTC');perform get_gamification_state('Pacific/Kiritimati');end $$;
select pg_temp.check_ok((select count(*)=1 from coin_movements where user_id=auth.uid() and kind='mission'),'one mission reward across repeated syncs');
select pg_temp.check_ok((select count(*)=1 from coin_movements where user_id=auth.uid() and kind='weekly-bonus'),'one bonus for the actual issued set');
select pg_temp.check_ok((select time_zone='UTC' from training_accounts where user_id=auth.uid()),'device timezone cannot reroll missions');

-- Friday late entry, with rescheduling and protection already authorized.
set request.jwt.claim.sub='a0000000-0000-4000-8000-000000000003';
insert into training_extra_rests(user_id,day) values(auth.uid(),date_trunc('week',now())::date+4);
select gf_create_mission_cycle(auth.uid(),date_trunc('week',now())::date+4);
select pg_temp.check_ok((select count(*)=1 and min(key)='weight' and max(target)<=3 from gf_missions where user_id=auth.uid()),'protected Friday and weekend need no impossible workout');
insert into training_reschedules(user_id,original_day,target_day,week_start,created_at,revision) values
 (auth.uid(),date_trunc('week',now())::date+7,date_trunc('week',now())::date+12,date_trunc('week',now())::date+7,clock_timestamp(),2);
select gf_create_mission_cycle(auth.uid(),date_trunc('week',now())::date+7);
select pg_temp.check_ok((select not(date_trunc('week',now())::date+7=any(planned_days)) and date_trunc('week',now())::date+12=any(planned_days) and cardinality(planned_days)=5 from gf_cycles where user_id=auth.uid() and week_start=date_trunc('week',now())::date+7),'snapshot follows the rescheduled target');

select pg_temp.check_ok(not has_function_privilege('authenticated','gf_create_mission_cycle(uuid,date)','EXECUTE') and not has_function_privilege('anon','gf_mission_variant(date)','EXECUTE'),'issuance and clock inputs stay private');
select 'PASS rotating missions: three maximum, four-week variation, partial weeks, rests, reschedules, fixed targets, unique rewards and timezone isolation';
rollback;
