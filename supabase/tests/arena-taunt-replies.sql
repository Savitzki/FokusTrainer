begin;
create function pg_temp.notice_check(ok boolean,label text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'FAIL: %',label;end if;end $$;
select pg_temp.notice_check(not exists(select 1 from arena_notice_legacy_baseline b left join arena_taunts t using(id) where t.id is null or (to_jsonb(t)-'in_reply_to'-'closed_at')<>b.original),'legacy messages and dates unchanged');
select pg_temp.notice_check((select closed_at=seen_at from arena_taunts where id='d3791000-0000-4000-8000-000000000001'),'dismissed legacy notice never reopened');
select pg_temp.notice_check((select closed_at is null and seen_at is null from arena_taunts where id='d3791000-0000-4000-8000-000000000002'),'unread legacy notice retained');
select pg_temp.notice_check(not (select taunt_push_enabled from arena_delivery_rules),'migration never activates push');
insert into auth.users(id) values('d3700000-0000-4000-8000-000000000001'),('d3700000-0000-4000-8000-000000000002'),('d3700000-0000-4000-8000-000000000003');
insert into profiles(id,nickname,avatar_photo) values
 ('d3700000-0000-4000-8000-000000000001','notice.alpha',null),
 ('d3700000-0000-4000-8000-000000000002','notice.beta','data:image/png;base64,YQ=='),
 ('d3700000-0000-4000-8000-000000000003','notice.stranger',null);
insert into training_accounts(user_id,time_zone,started_on) select id,'America/Sao_Paulo',(now() at time zone 'America/Sao_Paulo')::date from profiles where id::text like 'd3700000-%';
insert into friendships(requester,recipient,status) values('d3700000-0000-4000-8000-000000000001','d3700000-0000-4000-8000-000000000002','accepted');
create temporary table notice_financial_before as select md5(coalesce(string_agg(v::text,'|' order by v::text),'')) digest from (
 select to_jsonb(t) v from coin_wallets t union all select to_jsonb(t) from coin_movements t union all select to_jsonb(t) from medical_kits t union all select to_jsonb(t) from gf_badges t union all select to_jsonb(t) from workout_days t) rows;
set request.jwt.claim.sub='d3700000-0000-4000-8000-000000000001';
select pg_temp.notice_check((get_social_state()->>'arenaVersion')::integer=2 and (get_social_state()->>'tauntNotices')::boolean,'new capability version');
select pg_temp.notice_check((get_social_state()->'friends'->0->'avatar'->>'photo')='data:image/png;base64,YQ==','friend photo included without buying a frame');
select pg_temp.notice_check(not has_function_privilege('authenticated','gf_social_appearance(uuid)','execute'),'social appearance helper stays private');
select send_arena_taunt('d3700000-0000-4000-8000-000000000002','online','d3701000-0000-4000-8000-000000000001');
select send_arena_taunt('d3700000-0000-4000-8000-000000000002','online','d3701000-0000-4000-8000-000000000001');
select pg_temp.notice_check(get_arena_inbox()->'messages'='[]','old clients never receive unsupported catalog items');
select pg_temp.notice_check((select sent=1 from arena_taunt_limits where sender=auth.uid()),'resend does not consume another allowance');
set request.jwt.claim.sub='d3700000-0000-4000-8000-000000000002';
select pg_temp.notice_check(get_arena_inbox()->'messages'='[]','old recipient excludes new phrases without failing its parser');
select pg_temp.notice_check(jsonb_array_length(get_arena_inbox(2)->'messages')=1 and (get_arena_inbox(2)->'messages'->0->>'canReply')::boolean,'notice is visible and reply eligible');
set local role authenticated;
select reply_arena_taunt('d3701000-0000-4000-8000-000000000001','d3702000-0000-4000-8000-000000000001');
select reply_arena_taunt('d3701000-0000-4000-8000-000000000001','d3702000-0000-4000-8000-000000000001');
reset role;
select pg_temp.notice_check(get_arena_inbox(2)->'messages'='[]','replied notice disappears');
select pg_temp.notice_check((select count(*)=1 from arena_taunts where in_reply_to='d3701000-0000-4000-8000-000000000001'),'idempotent reply');
do $$ begin
 begin perform reply_arena_taunt('d3701000-0000-4000-8000-000000000001',gen_random_uuid());raise exception 'second reply accepted';exception when raise_exception then if sqlerrm='second reply accepted' then raise;end if;end;
end $$;
-- Closing an obsolete original notice on another device cannot dismiss the reply.
select acknowledge_arena_taunt('d3701000-0000-4000-8000-000000000001');
select pg_temp.notice_check((select closed_at is null from arena_taunts where id='d3701000-0000-4000-8000-000000000001'),'late original close does not close the reply');
set request.jwt.claim.sub='d3700000-0000-4000-8000-000000000001';
select pg_temp.notice_check(get_arena_inbox(2)->'messages'->0->>'replyTo'='d3701000-0000-4000-8000-000000000001' and not (get_arena_inbox(2)->'messages'->0->>'canReply')::boolean,'reply receipt has no reply action');
do $$ begin
 begin perform reply_arena_taunt('d3702000-0000-4000-8000-000000000001',gen_random_uuid());raise exception 'reply chain accepted';exception when raise_exception then if sqlerrm='reply chain accepted' then raise;end if;end;
end $$;
select acknowledge_arena_taunt('d3702000-0000-4000-8000-000000000001');
select acknowledge_arena_taunt('d3702000-0000-4000-8000-000000000001');
select pg_temp.notice_check(get_arena_inbox(2)->'messages'='[]','closing reply ends the exchange permanently');
select pg_temp.notice_check((select closed_at is not null from arena_taunts where id='d3701000-0000-4000-8000-000000000001'),'thread terminal state');
-- X before reply ends the original, without creating any response.
select send_arena_taunt('d3700000-0000-4000-8000-000000000002','invitation','d3701000-0000-4000-8000-000000000002');
set request.jwt.claim.sub='d3700000-0000-4000-8000-000000000003';
select acknowledge_arena_taunt('d3701000-0000-4000-8000-000000000002');
select pg_temp.notice_check((select seen_at is null from arena_taunts where id='d3701000-0000-4000-8000-000000000002'),'stranger cannot dismiss another inbox');
do $$ begin
 begin perform reply_arena_taunt('d3701000-0000-4000-8000-000000000002',gen_random_uuid());raise exception 'stranger reply accepted';exception when raise_exception then if sqlerrm='stranger reply accepted' then raise;end if;end;
end $$;
set request.jwt.claim.sub='d3700000-0000-4000-8000-000000000002';
select acknowledge_arena_taunt('d3701000-0000-4000-8000-000000000002');
do $$ begin
 begin perform reply_arena_taunt('d3701000-0000-4000-8000-000000000002',gen_random_uuid());raise exception 'closed reply accepted';exception when raise_exception then if sqlerrm='closed reply accepted' then raise;end if;end;
end $$;
select pg_temp.notice_check(get_arena_inbox(2)->'messages'='[]','X removes original notice');
-- Optional push is only for a real reply, with opt-in and current friendship.
set request.jwt.claim.sub='d3700000-0000-4000-8000-000000000001';
select set_arena_social_preferences(false,true);
select send_arena_taunt('d3700000-0000-4000-8000-000000000002','quiet','d3701000-0000-4000-8000-000000000003');
insert into push_devices(user_id,endpoint,p256dh,auth,vapid_key,time_zone,reminder_hour,tone)
 select id,'https://fcm.googleapis.com/send/reply-fixture-'||id,repeat('A',87),repeat('A',22),repeat('A',87),
 (select name from pg_timezone_names where extract(hour from clock_timestamp() at time zone name) between 10 and 19 order by name limit 1),18,'gentle'
 from profiles where id::text like 'd3700000-%' and nickname<>'notice.stranger';
set request.jwt.claim.sub='d3700000-0000-4000-8000-000000000002';
select set_arena_social_preferences(false,true);
update arena_delivery_rules set taunt_push_enabled=true;
select pg_temp.notice_check(claim_arena_taunt_push()='[]','original notice never triggers push');
select reply_arena_taunt('d3701000-0000-4000-8000-000000000003','d3702000-0000-4000-8000-000000000003');
create temporary table notice_push as select claim_arena_taunt_push() jobs;
select pg_temp.notice_check((select jsonb_array_length(jobs)=1 and jobs->0->>'body'='Olha quem fala... quero ver você também' from notice_push),'reply push uses actual approved text');
select pg_temp.notice_check(claim_arena_taunt_push()='[]','no duplicate push');
select pg_temp.notice_check(arena_taunt_push_allowed((select (jobs->0->>'job_id')::uuid from notice_push),(select (jobs->0->>'lease_id')::uuid from notice_push)),'authorized push eligible');
set request.jwt.claim.sub='d3700000-0000-4000-8000-000000000001';
select set_arena_social_preferences(true,true);
select pg_temp.notice_check(get_arena_inbox(2)->'messages'='[]','mute hides notices');
select pg_temp.notice_check(not arena_taunt_push_allowed((select (jobs->0->>'job_id')::uuid from notice_push),(select (jobs->0->>'lease_id')::uuid from notice_push)),'mute invalidates a claimed push');
select set_arena_social_preferences(false,true);
update friendships set status='declined' where requester=auth.uid();
select pg_temp.notice_check(get_arena_inbox(2)->'messages'='[]','removal of friendship hides reply');
select pg_temp.notice_check(not arena_taunt_push_allowed((select (jobs->0->>'job_id')::uuid from notice_push),(select (jobs->0->>'lease_id')::uuid from notice_push)),'friendship removal invalidates push');
update friendships set status='accepted' where requester=auth.uid();
select acknowledge_arena_taunt('d3702000-0000-4000-8000-000000000003');
select pg_temp.notice_check(not arena_taunt_push_allowed((select (jobs->0->>'job_id')::uuid from notice_push),(select (jobs->0->>'lease_id')::uuid from notice_push)),'X invalidates obsolete push');
do $$ begin
 begin perform send_arena_taunt('d3700000-0000-4000-8000-000000000002','online',gen_random_uuid());raise exception 'fourth accepted';exception when raise_exception then if sqlerrm='fourth accepted' then raise;end if;end;
 begin perform send_arena_taunt('d3700000-0000-4000-8000-000000000002','reply-back',gen_random_uuid());raise exception 'reply spoof accepted';exception when raise_exception then if sqlerrm='reply spoof accepted' then raise;end if;end;
 if has_function_privilege('anon','get_arena_inbox(integer)','execute') or has_function_privilege('anon','reply_arena_taunt(uuid,uuid)','execute') or has_function_privilege('authenticated','arena_post_taunt(uuid,text,uuid,uuid)','execute') or has_table_privilege('authenticated','arena_taunts','insert,update,select') then raise exception 'Privilege leak';end if;
end $$;
select pg_temp.notice_check((select digest from notice_financial_before)=(select md5(coalesce(string_agg(v::text,'|' order by v::text),'')) from (
 select to_jsonb(t) v from coin_wallets t union all select to_jsonb(t) from coin_movements t union all select to_jsonb(t) from medical_kits t union all select to_jsonb(t) from gf_badges t union all select to_jsonb(t) from workout_days t) rows),'economy, inventory, medals and workout history unchanged');
select 'PASS Arena notices: X, one reply, no chains, idempotency, privacy, mute, accepted friends, actual photos, bounded rate, optional push and no rewards';
rollback;
