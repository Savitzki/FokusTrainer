-- Synthetic pre-025 account which used the historical implicit seven-day calendar.
insert into auth.users(id) values('e0000000-0000-4000-8000-000000000099');
insert into profiles(id,nickname) values('e0000000-0000-4000-8000-000000000099','plans.legacy');
insert into training_accounts(user_id,time_zone,started_on) values('e0000000-0000-4000-8000-000000000099','UTC',current_date-10);
insert into workout_days(user_id,day,activity,minutes,confirmed_at) values('e0000000-0000-4000-8000-000000000099',current_date-1,'Antigo',10,now()-interval '1 day');
create table locked_plans_baseline as select
 (select jsonb_agg(to_jsonb(p) order by user_id,revision) from training_plans p) plans,
 (select jsonb_agg(to_jsonb(w) order by id) from workout_days w) workouts,
 (select jsonb_agg(to_jsonb(m) order by id) from coin_movements m) coins,
 (select jsonb_agg(to_jsonb(g) order by group_id,day) from group_days g) groups,
 (select jsonb_agg(to_jsonb(g) order by user_id,day) from gf_days g) days;
