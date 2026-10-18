-- Only disposable fixtures: verify migration 023 changes no historical facts or balances.
insert into auth.users(id) values('c0000000-0000-4000-8000-000000000030');
insert into profiles(id,nickname) values('c0000000-0000-4000-8000-000000000030','recording.legacy');
set request.jwt.claim.sub='c0000000-0000-4000-8000-000000000030';
select get_training_state('UTC');
insert into workout_days(user_id,day,activity,minutes,confirmed_at)
 values(auth.uid(),current_date-1,'Caminhada',10,now()-interval '1 day');
create table recording_test_baseline as select
 (select jsonb_agg(to_jsonb(w) order by id) from workout_days w) workouts,
 (select jsonb_agg(to_jsonb(m) order by id) from coin_movements m) movements,
 (select jsonb_agg(to_jsonb(w) order by user_id) from coin_wallets w) wallets,
 (select jsonb_agg(to_jsonb(g) order by group_id,day) from group_days g) groups,
 (select jsonb_agg(to_jsonb(g) order by user_id,day) from gf_days g) days;
