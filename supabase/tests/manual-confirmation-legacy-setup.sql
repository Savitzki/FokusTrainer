-- Synthetic fixtures only, inserted before migration 024 in a disposable database.
set request.jwt.claim.sub='c0000000-0000-4000-8000-000000000030';
insert into workout_days(user_id,day,activity,minutes,confirmed_at,recording_method,review)
 values(auth.uid(),current_date-2,'Manual anterior',35,now()-interval '2 days','manual','{"intensity":3,"feeling":"normal","completion":"partial"}'),
 (auth.uid(),current_date-3,'Cronometrado anterior',35,now()-interval '3 days','timed','{"intensity":4,"feeling":"great","completion":"full"}');
create table manual_test_baseline as select
 (select jsonb_agg(to_jsonb(w) order by id) from workout_days w) workouts,
 (select jsonb_agg(to_jsonb(m) order by id) from coin_movements m) movements,
 (select jsonb_agg(to_jsonb(w) order by user_id) from coin_wallets w) wallets,
 (select jsonb_agg(to_jsonb(g) order by group_id,day) from group_days g) groups,
 (select jsonb_agg(to_jsonb(g) order by user_id,day) from gf_days g) days,
 (select jsonb_object_agg(oid::text,md5(pg_get_functiondef(oid))) from pg_proc
  where pronamespace='public'::regnamespace and proname in
  ('start_workout_session','finish_workout_session','cancel_workout_session',
   'get_workout_recording_state','workout_recording_state','workout_expire_sessions','submit_workout_review')) timer_functions;
