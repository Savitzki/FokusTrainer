do $$ declare b manual_test_baseline;begin
 select * into strict b from manual_test_baseline;
 if b.workouts is distinct from (select jsonb_agg(to_jsonb(w)-'manual_confirmed' order by id) from workout_days w)
  or b.movements is distinct from (select jsonb_agg(to_jsonb(m) order by id) from coin_movements m)
  or b.wallets is distinct from (select jsonb_agg(to_jsonb(w) order by user_id) from coin_wallets w)
  or b.groups is distinct from (select jsonb_agg(to_jsonb(g) order by group_id,day) from group_days g)
  or b.days is distinct from (select jsonb_agg(to_jsonb(g) order by user_id,day) from gf_days g)
  or b.timer_functions is distinct from (select jsonb_object_agg(oid::text,md5(pg_get_functiondef(oid))) from pg_proc
   where pronamespace='public'::regnamespace and proname in
   ('start_workout_session','finish_workout_session','cancel_workout_session',
    'get_workout_recording_state','workout_recording_state','workout_expire_sessions','submit_workout_review'))
  or exists(select 1 from workout_days where manual_confirmed)
 then raise exception 'Migration 024 changed historical facts, rewards, snapshots or timer functions';end if;
end $$;
drop table manual_test_baseline;
select 'PASS migration 024: historical assessments, balances, snapshots and timer definitions unchanged';
