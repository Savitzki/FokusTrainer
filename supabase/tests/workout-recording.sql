\ir gamification-fixture.sql
create function pg_temp.rejects(command text, expected text) returns void language plpgsql as $$
begin
 begin execute command;exception when others then
  if sqlerrm not like '%'||expected||'%' then raise exception 'Unexpected rejection: %',sqlerrm;end if;return;
 end;
 raise exception 'FAIL: accepted forbidden operation: %',command;
end $$;
-- Synthetic accounts use a required day today, independent of the CI weekday.
update training_plans set training_days=array(select n from generate_series(1,7) n where n<>((extract(isodow from current_date)::integer)%7)+1 and n<>((extract(isodow from current_date)::integer+1)%7)+1);
create temp table capture(key text primary key, payload jsonb);
set role authenticated;
select get_workout_recording_state('UTC');
reset role;
insert into capture values('start',start_workout_session('c0000000-0000-4000-8000-000000000001','Corrida','UTC'));
select pg_temp.check_ok((select payload->'session'->>'status'='active' from capture where key='start'),'start active');
select pg_temp.check_ok((select count(*)=0 from coin_movements where kind='workout' and source_key like 'workout:%'),'no reward for start');
select pg_temp.check_ok((select count(*)=0 from workout_days where user_id=auth.uid()),'active session is not a confirmed workout');
insert into capture values('recover',get_workout_recording_state('Pacific/Kiritimati'));
select pg_temp.check_ok((select payload->'session'->>'id' from capture where key='start')=(select payload->'session'->>'id' from capture where key='recover'),'reload/device recovery same session');
select pg_temp.check_ok((select payload->>'timezone'='UTC' from capture where key='recover'),'account timezone pinned');
select pg_temp.check_ok((start_workout_session('c0000000-0000-4000-8000-000000000002','Outro treino','UTC')->'session'->>'id')=(select payload->'session'->>'id' from capture where key='start'),'second request resumes the single active session');
select pg_temp.rejects(format('select finish_workout_session(%L,''UTC'')',(select payload->'session'->>'id' from capture where key='start')),'tempo mínimo');
select pg_temp.rejects($q$select confirm_manual_workout(gen_random_uuid(),current_date,'Corrida',40,'{"intensity":3,"feeling":"normal","completion":"full"}','UTC')$q$,'Finalize ou cancele');
-- A SQL owner moves ONLY this disposable test session's time to simulate suspension.
update workout_sessions set started_at=clock_timestamp()-interval '35 minutes 5 seconds' where user_id=auth.uid();
insert into capture values('finished',finish_workout_session((select (payload->'session'->>'id')::uuid from capture where key='start'),'UTC'));
select pg_temp.check_ok((select payload->'session'->>'status'='completed' from capture where key='finished'),'valid finish');
select pg_temp.check_ok((select minutes=35 and recording_method='timed' and review is null from workout_days where user_id=auth.uid()),'validated elapsed minutes and optional review');
select pg_temp.check_ok((select count(*)=1 and sum(amount)=10 from coin_movements where user_id=auth.uid() and source_key='workout:'||current_date),'unique standard reward');
select pg_temp.check_ok((finish_workout_session((select (payload->'session'->>'id')::uuid from capture where key='start'),'UTC')->'session'->'workout')=(select payload->'session'->'workout' from capture where key='finished'),'timeout retry original workout');
select pg_temp.rejects($q$select start_workout_session(gen_random_uuid(),'Corrida','UTC')$q$,'já foi confirmado');
select pg_temp.rejects($q$select confirm_manual_workout(gen_random_uuid(),current_date,'Corrida',40,'{"intensity":2,"feeling":"normal","completion":"full"}','UTC')$q$,'já foi confirmado');
select pg_temp.check_ok((gf_day(auth.uid(),current_date)).completed,'confirmed session feeds missions and consistency');
select pg_temp.check_ok((select gf_streak(auth.uid())->>'current')='1','one mandatory workout increases streak once');
select pg_temp.check_ok((submit_workout_review((select id from workout_days where user_id=auth.uid()),'{"intensity":4,"feeling":"great","completion":"partial"}')->'review'->>'completion')='partial','optional evaluation after definitive confirmation');
select submit_workout_review((select id from workout_days where user_id=auth.uid()),'{"intensity":4,"feeling":"great","completion":"partial"}');
select pg_temp.rejects(format('select submit_workout_review(%L,''{"intensity":1,"feeling":"normal","completion":"full"}'')',(select id from workout_days where user_id=auth.uid())),'já foi salva');
select pg_temp.check_ok((select count(*)=1 from coin_movements where user_id=auth.uid() and source_key='workout:'||current_date),'evaluation does not reward');
insert into capture values('report',get_progress_report('week',date_trunc('week',now())::date,'UTC'));
select pg_temp.check_ok((select payload->'recording'->>'timed'='1' and payload->'recording'->>'averageIntensity'='4.0' and payload->'recording'->>'evaluated'='1' from capture where key='report'),'private report evaluated denominator');
select pg_temp.check_ok((get_social_state()->'workouts'->0->>'method')='timed','social self history provenance');

set request.jwt.claim.sub='a0000000-0000-4000-8000-000000000002';
select pg_temp.rejects(format('select finish_workout_session(%L,''UTC'')',(select payload->'session'->>'id' from capture where key='start')),'não encontrado');
select pg_temp.rejects(format('select submit_workout_review(%L,''{"intensity":1,"feeling":"normal","completion":"full"}'')',(select id from workout_days limit 1)),'não encontrado');
select pg_temp.rejects($q$select confirm_manual_workout(gen_random_uuid(),current_date,'Yoga',34,'{"intensity":2,"feeling":"normal","completion":"full"}','UTC')$q$,'pelo menos');
select pg_temp.rejects($q$select confirm_manual_workout(gen_random_uuid(),current_date,'Yoga',35,'{"intensity":2,"feeling":"normal"}','UTC')$q$,'três perguntas');
select pg_temp.rejects($q$select confirm_manual_workout(gen_random_uuid(),current_date,'Yoga',35,'{"intensity":0,"feeling":"normal","completion":"full"}','UTC')$q$,'três perguntas');
select pg_temp.rejects($q$select confirm_daily_workout(current_date,'Yoga',5,'UTC')$q$,'Atualize o app');
select pg_temp.rejects($q$select confirm_manual_workout(gen_random_uuid(),current_date-1,'Yoga',35,'{"intensity":2,"feeling":"normal","completion":"full"}','UTC')$q$,'hoje');
insert into capture values('cancel',start_workout_session(gen_random_uuid(),'Yoga','UTC'));
select pg_temp.check_ok((cancel_workout_session((select (payload->'session'->>'id')::uuid from capture where key='cancel'),'UTC')->'session'->>'status')='cancelled','cancel persisted');
select pg_temp.check_ok((finish_workout_session((select (payload->'session'->>'id')::uuid from capture where key='cancel'),'UTC')->'session'->>'status')='cancelled','cancel cannot finish');
insert into capture values('expiry',start_workout_session(gen_random_uuid(),'Yoga','UTC'));
update workout_sessions set started_at=clock_timestamp()-interval '4 hours' where user_id=auth.uid() and status='active';
select pg_temp.check_ok((get_workout_recording_state('UTC')->'session'->>'status')='expired','4h expiration on recovery');
select pg_temp.check_ok((finish_workout_session((select (payload->'session'->>'id')::uuid from capture where key='expiry'),'UTC')->'session'->>'status')='expired','expired cannot finish');
select pg_temp.check_ok(not exists(select 1 from workout_days where user_id=auth.uid()),'cancel/expiry do not preserve a streak');
select pg_temp.check_ok(not exists(select 1 from coin_movements where user_id=auth.uid() and source_key='workout:'||current_date),'cancel/expiry no reward');
insert into capture values('manual',confirm_manual_workout('c0000000-0000-4000-8000-000000000003',current_date,'Yoga',35,'{"intensity":2,"feeling":"normal","completion":"adapted"}','UTC'));
select pg_temp.check_ok((select payload->>'method'='manual' from capture where key='manual'),'manual complete review valid');
select pg_temp.check_ok(confirm_manual_workout('c0000000-0000-4000-8000-000000000003',current_date,'Yoga',35,'{"intensity":2,"feeling":"normal","completion":"adapted"}','Pacific/Kiritimati')=(select payload from capture where key='manual'),'manual retry idempotent across device timezone');
select pg_temp.check_ok((select count(*)=1 and sum(amount)=10 from coin_movements where user_id=auth.uid() and source_key='workout:'||current_date),'manual same unique reward');

-- Both methods fulfill the existing collective day. No evaluation or private session is shared.
insert into streak_groups(id,owner_id,name,time_zone,status,started_on) values('c0000000-0000-4000-8000-000000000004','a0000000-0000-4000-8000-000000000001','Recording arena','UTC','active',current_date);
insert into group_members(group_id,user_id,status) select 'c0000000-0000-4000-8000-000000000004',id,'accepted' from profiles where id::text like 'a0000000-%' and id<>'a0000000-0000-4000-8000-000000000003';
select social_refresh_day('c0000000-0000-4000-8000-000000000004');
select pg_temp.check_ok(exists(select 1 from group_days where group_id='c0000000-0000-4000-8000-000000000004' and counts_for_streak),'Arena accepts manual and timed');
select pg_temp.check_ok(not ((get_social_state()->'groups')::text like '%intensity%'),'no reviews shared with Arena');

-- Existing challenge policy remains any; only NEW challenges can restrict methods.
set request.jwt.claim.sub='a0000000-0000-4000-8000-000000000001';
insert into capture values('challenge',to_jsonb(create_recording_challenge('Com cronômetro','frequency',7,array['a0000000-0000-4000-8000-000000000002'::uuid],null,'UTC','timed')));
set request.jwt.claim.sub='a0000000-0000-4000-8000-000000000002';
select reply_challenge_invite((select (payload#>>'{}')::uuid from capture where key='challenge'),true,'UTC');
update gf_challenges set starts_on=current_date,ends_on=current_date+6 where id=(select (payload#>>'{}')::uuid from capture where key='challenge');
select pg_temp.check_ok((gf_challenge_metric((select (payload#>>'{}')::uuid from capture where key='challenge'),'a0000000-0000-4000-8000-000000000001')->>'completed')='1','timed-only metric accepts timed');
select pg_temp.check_ok((gf_challenge_metric((select (payload#>>'{}')::uuid from capture where key='challenge'),auth.uid())->>'completed')='0','timed-only metric excludes manual without removing personal points');
select pg_temp.check_ok((get_friend_challenges()->0->>'recordingPolicy')='timed','challenge exposes rule');
select pg_temp.check_ok((select (x->>'completed')::integer=0 from jsonb_array_elements(get_friend_challenges()->0->'board') x where x->>'id'=auth.uid()::text),'public board applies timed-only policy');

-- Historical compatibility: no guessed method, no new minimum applied to old rows.
set request.jwt.claim.sub='a0000000-0000-4000-8000-000000000003';
insert into workout_days(user_id,day,activity,minutes,confirmed_at) values(auth.uid(),current_date-1,'Registro antigo',10,now()-interval '1 day');
select pg_temp.check_ok((get_social_state()->'workouts'->0->>'method')='legacy','legacy classification');
update training_plans set training_days=array(select n from generate_series(1,7) n where n<>extract(isodow from current_date)::integer and n<>((extract(isodow from current_date)::integer)%7)+1) where user_id=auth.uid();
select confirm_manual_workout(gen_random_uuid(),current_date,'Voluntário',35,'{"intensity":3,"feeling":"great","completion":"full"}','UTC');
select pg_temp.check_ok((gf_day(auth.uid(),current_date)).kind='scheduled-rest','method does not alter programmed rests');
select pg_temp.check_ok((gf_streak(auth.uid())->>'current')='1','voluntary rest workout does not add streak point');
select pg_temp.check_ok((get_progress_report('week',date_trunc('week',now())::date,'UTC')->'recording'->>'averageIntensity')='3.0','unfilled legacy evaluation not zero');

-- A server-started session spanning midnight belongs to the server finish day.
insert into auth.users(id) values('c0000000-0000-4000-8000-000000000040');
insert into profiles(id,nickname) values('c0000000-0000-4000-8000-000000000040','timer.midnight');
set request.jwt.claim.sub='c0000000-0000-4000-8000-000000000040';
select get_training_state((select name from pg_timezone_names where extract(hour from now() at time zone name)=0 order by name limit 1));
insert into capture values('midnight',start_workout_session(gen_random_uuid(),'Corrida','UTC'));
update workout_sessions set started_at=clock_timestamp()-interval '2 hours' where user_id=auth.uid();
select finish_workout_session((select (payload->'session'->>'id')::uuid from capture where key='midnight'),'Pacific/Kiritimati');
select pg_temp.check_ok((select w.day=(clock_timestamp() at time zone a.time_zone)::date
 and w.day>(s.started_at at time zone a.time_zone)::date from workout_days w join training_accounts a on a.user_id=w.user_id
 join workout_sessions s on s.workout_id=w.id where w.user_id=auth.uid()),'midnight credit uses pinned finish day');
select pg_temp.check_ok((select count(*)=1 and sum(amount)=10 from coin_movements where user_id=auth.uid() and kind='workout'),'midnight reward once');

-- RLS/table privileges plus private helper ACLs, also executed under the real client role.
select pg_temp.check_ok((select relrowsecurity from pg_class where oid='public.workout_sessions'::regclass),'RLS enabled');
select pg_temp.check_ok(not has_table_privilege('authenticated','workout_sessions','INSERT,UPDATE,DELETE'),'no client session mutation');
select pg_temp.check_ok(not has_function_privilege('authenticated','workout_confirm(uuid,date,text,integer,text,jsonb,uuid,timestamptz)','EXECUTE'),'canonical helper private');
select pg_temp.check_ok(not has_function_privilege('authenticated','workout_recording_state(uuid,uuid)','EXECUTE'),'no reading arbitrary accounts');
select pg_temp.check_ok(not has_function_privilege('anon','start_workout_session(uuid,text,text)','EXECUTE'),'authentication required');
set role authenticated;
select pg_temp.rejects($q$update public.workout_sessions set started_at=now()-interval '1 hour'$q$,'permission denied');
select pg_temp.rejects($q$insert into public.workout_days(user_id,day,activity,minutes) values(auth.uid(),current_date,'Forge',35)$q$,'permission denied');
select pg_temp.rejects($q$select public.workout_recording_state('a0000000-0000-4000-8000-000000000001',null)$q$,'permission denied');
select get_workout_recording_state('UTC');
reset role;
select 'PASS workout recording: authoritative time, recover, minimum, expiry, cancel, retry, daily uniqueness, review, legacy, streak, rewards, Arena, challenge methods, private reports, ACLs';
rollback;
