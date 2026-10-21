begin;
create function pg_temp.global_check(ok boolean,label text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'FAIL global notices: %',label;end if;end $$;
insert into auth.users(id) values('d4000000-0000-4000-8000-000000000001'),('d4000000-0000-4000-8000-000000000002'),('d4000000-0000-4000-8000-000000000003');
insert into profiles(id,nickname) values('d4000000-0000-4000-8000-000000000001','global.alpha'),('d4000000-0000-4000-8000-000000000002','global.beta'),('d4000000-0000-4000-8000-000000000003','global.stranger');
insert into training_accounts(user_id,time_zone,started_on) select id,'America/Sao_Paulo',current_date from profiles where id::text like 'd4000000-%';
insert into friendships(requester,recipient,status) values('d4000000-0000-4000-8000-000000000001','d4000000-0000-4000-8000-000000000002','accepted');
create temporary table global_before as select md5(coalesce(string_agg(v::text,'|' order by v::text),'')) digest from (
 select to_jsonb(t) v from coin_wallets t union all select to_jsonb(t) from coin_movements t union all select to_jsonb(t) from medical_kits t union all select to_jsonb(t) from gf_badges t union all select to_jsonb(t) from workout_days t) rows;
set request.jwt.claim.sub='d4000000-0000-4000-8000-000000000001';
select send_arena_taunt('d4000000-0000-4000-8000-000000000002',null,'d4001000-0000-4000-8000-000000000001');
select send_arena_taunt('d4000000-0000-4000-8000-000000000002',null,'d4001000-0000-4000-8000-000000000001');
select pg_temp.global_check((select revision=2 from arena_inbox_signals where user_id='d4000000-0000-4000-8000-000000000002'),'receipt retry produces no duplicate event');
set local role authenticated;
select pg_temp.global_check((select count(*)=1 from arena_inbox_signals),'RLS only own signal');
select pg_temp.global_check((select count(*)=0 from arena_inbox_signals where user_id='d4000000-0000-4000-8000-000000000002'),'cannot see recipient signal');
reset role;
set request.jwt.claim.sub='d4000000-0000-4000-8000-000000000003';
set local role authenticated;
select pg_temp.global_check((select count(*)=0 from arena_inbox_signals),'unrelated account sees nothing');
reset role;
select pg_temp.global_check(not has_table_privilege('authenticated','arena_taunts','select'),'private content remains RPC-only');
select pg_temp.global_check(not has_table_privilege('anon','arena_inbox_signals','select'),'no anonymous subscription');
select pg_temp.global_check(not has_table_privilege('authenticated','arena_inbox_signals','insert,update,delete'),'clients cannot forge invalidations');
select pg_temp.global_check(not has_function_privilege('authenticated','arena_signal_inbox()','execute'),'trigger helper stays private');
select pg_temp.global_check((select count(*)=2 from information_schema.columns where table_schema='public' and table_name='arena_inbox_signals'),'signal carries no sender/text/message ID');
insert into push_devices(user_id,endpoint,p256dh,auth,vapid_key,time_zone,reminder_hour,tone)
 select id,'https://fcm.googleapis.com/send/global-fixture-'||id,repeat('A',87),repeat('A',22),repeat('A',87),
 (select name from pg_timezone_names where extract(hour from clock_timestamp() at time zone name) between 10 and 19 order by name limit 1),18,'gentle'
 from profiles where id::text like 'd4000000-%' and nickname<>'global.stranger';
set request.jwt.claim.sub='d4000000-0000-4000-8000-000000000002';
select pg_temp.global_check(claim_arena_taunt_push()='[]','service flag remains opt-in');
select set_arena_social_preferences(false,true);
update arena_delivery_rules set taunt_push_enabled=true;
create temporary table global_jobs as select claim_arena_taunt_push() jobs;
select pg_temp.global_check((select jsonb_array_length(jobs)=1 and jobs->0->>'title'='Capibora' and jobs->0->>'body'='Psiu, alguém mandou uma provocação' from global_jobs),'original push eligible, no private content');
select pg_temp.global_check(claim_arena_taunt_push()='[]','claim at most once per event/device');
select pg_temp.global_check(arena_taunt_push_allowed((select (jobs->0->>'job_id')::uuid from global_jobs),(select (jobs->0->>'lease_id')::uuid from global_jobs)),'revalidation allows eligible original');
select set_arena_social_preferences(true,true);
select pg_temp.global_check(not arena_taunt_push_allowed((select (jobs->0->>'job_id')::uuid from global_jobs),(select (jobs->0->>'lease_id')::uuid from global_jobs)),'mute immediately revokes delivery');
select pg_temp.global_check(get_arena_inbox(3)->'messages'='[]','muted inbox hides originals');
select set_arena_social_preferences(false,true);
select reply_arena_taunt('d4001000-0000-4000-8000-000000000001','d4002000-0000-4000-8000-000000000001');
select pg_temp.global_check(not exists(select 1 from arena_taunt_limits where sender=auth.uid()),'reply quota unchanged');
select pg_temp.global_check(not arena_taunt_push_allowed((select (jobs->0->>'job_id')::uuid from global_jobs),(select (jobs->0->>'lease_id')::uuid from global_jobs)),'read original invalidates pending push');
set request.jwt.claim.sub='d4000000-0000-4000-8000-000000000001';
select set_arena_social_preferences(false,true);
select pg_temp.global_check(jsonb_array_length(get_arena_inbox(3)->'messages')=1,'reply in same global inbox');
select pg_temp.global_check((claim_arena_taunt_push()->0->>'body')='Psiu, alguém mandou uma provocação','reply also generic');
select acknowledge_arena_taunt('d4002000-0000-4000-8000-000000000001');
select pg_temp.global_check(get_arena_inbox(3)->'messages'='[]','X clears reply without another reply chain');
select pg_temp.global_check((select digest from global_before)=(select md5(coalesce(string_agg(v::text,'|' order by v::text),'')) from (
 select to_jsonb(t) v from coin_wallets t union all select to_jsonb(t) from coin_movements t union all select to_jsonb(t) from medical_kits t union all select to_jsonb(t) from gf_badges t union all select to_jsonb(t) from workout_days t) rows),'no economic/workout/achievement mutations');
select 'PASS global notices: signals, RLS, idempotency, originals/replies, opt-in, mute, generic payload, no rewards';
rollback;
