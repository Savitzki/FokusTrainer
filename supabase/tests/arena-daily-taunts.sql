begin;
create function pg_temp.daily_check(ok boolean,label text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'FAIL: %',label;end if;end $$;
select pg_temp.daily_check((select count(*)=5 from arena_taunt_catalog where original_eligible and not reply_only),'exactly five eligible originals');
select pg_temp.daily_check(not exists(select 1 from daily_legacy_before b where not exists(select 1 from arena_taunts t where to_jsonb(t)=b.original)),'all historical messages unchanged');
select pg_temp.daily_check(not exists(select 1 from daily_receipts_before b where not exists(select 1 from arena_group_receipts t where to_jsonb(t)=b.original)),'historical receipts unchanged');
create temp table economy_before as select md5(coalesce(string_agg(v::text,'|' order by v::text),'')) digest from (
 select to_jsonb(t) v from coin_wallets t union all select to_jsonb(t) from coin_movements t union all select to_jsonb(t) from medical_kits t union all select to_jsonb(t) from gf_badges t union all select to_jsonb(t) from workout_days t) rows;
set request.jwt.claim.sub='d3900000-0000-4000-8000-000000000001';
select send_arena_taunt('d3900000-0000-4000-8000-000000000002','arbitrary-ignored','d3901000-0000-4000-8000-000000000001');
do $$begin
 begin perform send_arena_taunt('d3900000-0000-4000-8000-000000000002',null,gen_random_uuid());raise exception 'quota reset';exception when raise_exception then if sqlerrm='quota reset' then raise;end if;end;
end $$;
select pg_temp.daily_check((get_social_state()->'tauntAllowance'->'sentTo') ? 'd3900000-0000-4000-8000-000000000002','spent quota returned by server');
select pg_temp.daily_check(get_social_state()->'tauntAllowance'->>'day'=(clock_timestamp() at time zone 'America/Sao_Paulo')::date::text,'official account day');
select pg_temp.daily_check((get_social_state()->'tauntAllowance'->>'resetsAt')::timestamptz=(((clock_timestamp() at time zone 'America/Sao_Paulo')::date+1)::timestamp at time zone 'America/Sao_Paulo'),'next local midnight');
-- A different friend is independently eligible, even when p_message spoofs reply-only.
select send_arena_taunt('d3900000-0000-4000-8000-000000000003','reply-back','d3901000-0000-4000-8000-000000000002');
select pg_temp.daily_check((select c.original_eligible and not c.reply_only from arena_taunts t join arena_taunt_catalog c on c.id=t.message_id where t.id='d3901000-0000-4000-8000-000000000002'),'client cannot choose retired or reply message');
set request.jwt.claim.sub='d3900000-0000-4000-8000-000000000003';
select pg_temp.daily_check(jsonb_array_length(get_arena_inbox(3)->'messages')=1,'new client reads exact saved random message');
select pg_temp.daily_check(get_arena_inbox(2)->'messages'='[]','old clients never receive unknown new IDs');
select pg_temp.daily_check((get_arena_inbox(3)->'messages'->0->>'text')=(select c.body from arena_taunts t join arena_taunt_catalog c on c.id=t.message_id where t.id='d3901000-0000-4000-8000-000000000002'),'inbox shows saved body without resampling');
select reply_arena_taunt('d3901000-0000-4000-8000-000000000002','d3902000-0000-4000-8000-000000000001');
select reply_arena_taunt('d3901000-0000-4000-8000-000000000002','d3902000-0000-4000-8000-000000000001');
select pg_temp.daily_check(not exists(select 1 from arena_taunt_limits where sender=auth.uid()),'reply never consumes original allowance');
select send_arena_taunt('d3900000-0000-4000-8000-000000000001',null,'d3901000-0000-4000-8000-000000000003');
select pg_temp.daily_check((select count(*)=1 from arena_taunt_limits where sender=auth.uid()),'reverse original after replying is eligible');
do $$begin
 begin perform reply_arena_taunt('d3901000-0000-4000-8000-000000000002',gen_random_uuid());raise exception 'second reply';exception when raise_exception then if sqlerrm='second reply' then raise;end if;end;
end $$;
set request.jwt.claim.sub='d3900000-0000-4000-8000-000000000001';
do $$begin
 begin perform reply_arena_taunt('d3902000-0000-4000-8000-000000000001',gen_random_uuid());raise exception 'reply chain';exception when raise_exception then if sqlerrm='reply chain' then raise;end if;end;
end $$;
-- Spent quotas from yesterday do not block today; no browser date is accepted.
set request.jwt.claim.sub='d3900000-0000-4000-8000-000000000002';
insert into arena_taunt_limits values(auth.uid(),'d3900000-0000-4000-8000-000000000003',(clock_timestamp() at time zone 'America/Sao_Paulo')::date-1,3);
select send_arena_taunt('d3900000-0000-4000-8000-000000000003','online','d3901000-0000-4000-8000-000000000004');
update arena_social_preferences set muted=true where user_id='d3900000-0000-4000-8000-000000000001';
insert into arena_social_preferences(user_id,muted) values('d3900000-0000-4000-8000-000000000001',true) on conflict(user_id) do update set muted=true;
do $$begin
 begin perform send_arena_taunt('d3900000-0000-4000-8000-000000000001',null,gen_random_uuid());raise exception 'muted send';exception when raise_exception then if sqlerrm='muted send' then raise;end if;end;
end $$;
update arena_social_preferences set muted=false where user_id='d3900000-0000-4000-8000-000000000001';
select send_arena_taunt('d3900000-0000-4000-8000-000000000001',null,'d3901000-0000-4000-8000-000000000005');
select reply_arena_taunt('d3901000-0000-4000-8000-000000000001','d3902000-0000-4000-8000-000000000002');
select pg_temp.daily_check((select sent=1 from arena_taunt_limits where sender=auth.uid() and recipient='d3900000-0000-4000-8000-000000000001' and day=(clock_timestamp() at time zone 'America/Sao_Paulo')::date),'reply succeeds even after the original daily quota was spent');
update friendships set status='declined' where requester='d3900000-0000-4000-8000-000000000001' and recipient=auth.uid();
do $$begin
 begin perform send_arena_taunt('d3900000-0000-4000-8000-000000000001',null,gen_random_uuid());raise exception 'nonfriend send';exception when raise_exception then if sqlerrm='nonfriend send' then raise;end if;end;
 if has_function_privilege('anon','send_arena_taunt(uuid,text,uuid)','execute') or has_function_privilege('authenticated','arena_post_taunt(uuid,text,uuid,uuid)','execute') or has_table_privilege('authenticated','arena_taunt_limits','insert,update,select') then raise exception 'Privilege leak';end if;
end $$;
select pg_temp.daily_check((select digest from economy_before)=(select md5(coalesce(string_agg(v::text,'|' order by v::text),'')) from (
 select to_jsonb(t) v from coin_wallets t union all select to_jsonb(t) from coin_movements t union all select to_jsonb(t) from medical_kits t union all select to_jsonb(t) from gf_badges t union all select to_jsonb(t) from workout_days t) rows),'no financial, achievement or workout writes');
select 'PASS random daily taunts: quota, migration, legacy messages/receipts, independent reply, mute, friendship, midnight, privacy and no rewards';
rollback;
