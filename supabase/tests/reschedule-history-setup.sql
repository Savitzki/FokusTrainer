-- Snapshot of disposable legacy fixtures only, before migration 012.
create table public.test_reschedule_baseline as
select jsonb_build_object(
 'plans',(select md5(coalesce(string_agg(to_jsonb(t)::text,'|' order by user_id,revision),'')) from public.training_plans t),
 'groups',(select md5(coalesce(string_agg(to_jsonb(t)::text,'|' order by group_id,day),'')) from public.group_days t),
 'accounts',(select md5(coalesce(string_agg(to_jsonb(t)::text,'|' order by user_id),'')) from public.training_accounts t),
 'wallets',(select md5(coalesce(string_agg(to_jsonb(t)::text,'|' order by user_id),'')) from public.coin_wallets t),
 'coins',(select md5(coalesce(string_agg(to_jsonb(t)::text,'|' order by id),'')) from public.coin_movements t),
 'kits',(select md5(coalesce(string_agg(to_jsonb(t)::text,'|' order by id),'')) from public.medical_kits t),
 'workouts',(select md5(coalesce(string_agg(to_jsonb(t)::text,'|' order by id),'')) from public.workout_days t)
) payload;
