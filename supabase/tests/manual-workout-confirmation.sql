\ir gamification-fixture.sql
create function pg_temp.rejects(command text, expected text) returns void language plpgsql as $$
begin
 begin execute command;exception when others then
  if sqlerrm not like '%'||expected||'%' then raise exception 'Unexpected rejection: %',sqlerrm;end if;return;
 end;
 raise exception 'FAIL accepted forbidden operation: %',command;
end $$;
-- Today must be mandatory in these synthetic accounts, regardless of CI weekday.
update training_plans set training_days=array(select n from generate_series(1,7) n
 where n<>((extract(isodow from current_date)::integer)%7)+1 and n<>((extract(isodow from current_date)::integer+1)%7)+1);
create temp table manual_capture(payload jsonb);

-- Shared contract matches the frontend. Null, absent, false and ambiguous answers fail.
do $$ declare bad jsonb;begin
 foreach bad in array array[
  null::jsonb,'null','{}','[]','true',
  '{"version":1,"questionIds":[],"answers":[true,true,true]}',
  '{"version":1,"questionIds":["real","real"],"answers":[true,true,true]}',
  '{"version":1,"questionIds":["real","invented"],"answers":[true,true,true]}',
  '{"version":1,"questionIds":["real","honest"],"answers":[false,true,true]}',
  '{"version":1,"questionIds":["real","honest"],"answers":[true,false,true]}',
  '{"version":1,"questionIds":["real","honest"],"answers":[true,true,false]}',
  '{"version":1,"questionIds":["real","honest"],"answers":[true,true]}',
  '{"version":1,"questionIds":["real","honest"],"answers":["true",true,true]}',
  '{"version":2,"questionIds":["real","honest"],"answers":[true,true,true]}',
  '{"version":1,"questionIds":["real","honest"],"answers":[true,true,true],"extra":true}',
  '{"intensity":3,"feeling":"normal","completion":"full"}'
 ]::jsonb[] loop
  perform pg_temp.check_ok(not workout_valid_manual_confirmation(bad),'invalid declaration rejected');
  perform pg_temp.rejects(format('select confirm_manual_workout(gen_random_uuid(),current_date,''Yoga'',35,%L,''UTC'')',bad),'três perguntas');
 end loop;
end $$;
select pg_temp.check_ok(not exists(select 1 from workout_days where user_id=auth.uid()),'invalid declarations do not create workouts');
select pg_temp.check_ok(not exists(select 1 from coin_movements where user_id=auth.uid() and source_key='workout:'||current_date),'invalid declarations do not reward');
select pg_temp.check_ok(not exists(select 1 from training_extra_rests where user_id=auth.uid()),'invalid declarations do not create extra rests');

select pg_temp.rejects($q$select confirm_manual_workout(gen_random_uuid(),current_date,'Yoga',34,'{"version":1,"questionIds":["real","honest"],"answers":[true,true,true]}','UTC')$q$,'pelo menos');
select pg_temp.rejects($q$select confirm_manual_workout(gen_random_uuid(),current_date-1,'Yoga',35,'{"version":1,"questionIds":["real","honest"],"answers":[true,true,true]}','UTC')$q$,'hoje');
select pg_temp.rejects($q$select confirm_manual_workout(p_request_id=>gen_random_uuid(),p_day=>current_date,p_activity=>'Yoga',p_minutes=>35,p_review=>'{"intensity":3,"feeling":"normal","completion":"full"}',p_timezone=>'UTC')$q$,'does not exist');

-- Real client role; the private validator cannot be used to write or reward anything.
select pg_temp.check_ok(not has_function_privilege('anon','confirm_manual_workout(uuid,date,text,integer,jsonb,text)','EXECUTE'),'guest cannot confirm');
select pg_temp.check_ok(not has_function_privilege('authenticated','workout_valid_manual_confirmation(jsonb)','EXECUTE'),'validator remains private');
grant select,insert on manual_capture to authenticated;
set role authenticated;
insert into manual_capture values(confirm_manual_workout('d0000000-0000-4000-8000-000000000001',current_date,'Yoga',35,'{"version":1,"questionIds":["real","honest"],"answers":[true,true,true]}','UTC'));
select pg_temp.check_ok((select payload->>'manualConfirmed'='true' and payload->>'method'='manual' and payload->'review'='null'::jsonb from manual_capture),'essential declaration recorded, no fabricated review');
select pg_temp.check_ok((select not(payload ? 'manualConfirmation') from manual_capture),'question IDs and answers are not stored in definitive DTO');
select pg_temp.check_ok(confirm_manual_workout('d0000000-0000-4000-8000-000000000001',current_date,'Yoga',35,'{"version":1,"questionIds":["real","honest"],"answers":[true,true,true]}','Pacific/Kiritimati')=(select payload from manual_capture),'timeout retry same record with account timezone');
select pg_temp.rejects($q$select confirm_manual_workout('d0000000-0000-4000-8000-000000000001',current_date,'Yoga',35,'{}','UTC')$q$,'três perguntas');
select pg_temp.rejects($q$select confirm_manual_workout(gen_random_uuid(),current_date,'Yoga',35,'{"version":1,"questionIds":["real","honest"],"answers":[true,true,true]}','UTC')$q$,'já foi confirmado');
select pg_temp.rejects($q$update workout_days set manual_confirmed=true$q$,'permission denied');
select pg_temp.rejects($q$select workout_confirm(auth.uid(),current_date,'Forge',35,'manual',null,gen_random_uuid(),now())$q$,'permission denied');
reset role;
select pg_temp.check_ok((select count(*)=1 and sum(amount)=10 from coin_movements where user_id=auth.uid() and source_key='workout:'||current_date),'one workout reward, no interrogation bonus');
select pg_temp.check_ok((gf_day(auth.uid(),current_date)).completed,'confirmed manual feeds existing mission pipeline');
select pg_temp.check_ok(gf_streak(auth.uid())->>'current'='1','streak once, independent of assessment');
select pg_temp.check_ok((get_progress_report('week',date_trunc('week',now())::date,'UTC')->'recording'->>'evaluated')='0','declaration does not invent an intensity assessment');

set request.jwt.claim.sub='a0000000-0000-4000-8000-000000000002';
set role authenticated;
select pg_temp.check_ok(get_social_state()->'workouts'='[]'::jsonb,'account isolation through self-only RPC');
select pg_temp.rejects($q$select * from workout_days$q$,'permission denied');
reset role;
select 'PASS manual interrogation: strict positive declarations, minimum, same-day uniqueness, idempotency, legacy payload blocked, privacy, ACLs, unchanged reward and streak';
rollback;
