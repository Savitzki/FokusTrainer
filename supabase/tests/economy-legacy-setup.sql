-- Before migration 010, populate an existing account with today's records.
insert into auth.users(id) values('cccccccc-cccc-4ccc-8ccc-000000000009');
insert into public.profiles(id,nickname) values('cccccccc-cccc-4ccc-8ccc-000000000009','coins.legacy');
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','cccccccc-cccc-4ccc-8ccc-000000000009',true);
select public.confirm_daily_workout(current_date,'Treino anterior à moeda',40,'UTC');
select public.sync_weights(auth.uid(),jsonb_build_array(jsonb_build_object('date',current_date,'kg',78,'baseVersion',0,'mutationId',gen_random_uuid())),'UTC');
commit;
