begin;
-- Data predating the new format stays byte-for-byte identical (new columns excluded).
do $$ declare t record;value text;begin for t in select * from arena_legacy_baseline loop execute format('select md5(coalesce(string_agg(v::text,''|'' order by v::text),'''')) from(select to_jsonb(x)-''rule_version''-''rematch_of''-''invitation_key''-''planned_days'' v from public.%I x) rows',t.table_name) into value;if value<>t.digest then raise exception 'Legacy data changed: %',t.table_name;end if;end loop;end $$;
set request.jwt.claim.sub='d3400000-0000-4000-8000-000000000001';
create temporary table arena_new_challenge as select create_arena_challenge('d3402000-0000-4000-8000-000000000001','Dupla','frequency',7,array['d3400000-0000-4000-8000-000000000002']::uuid[],null,'UTC','any',null) id;
select create_arena_challenge('d3402000-0000-4000-8000-000000000001','Dupla','frequency',7,array['d3400000-0000-4000-8000-000000000002']::uuid[],null,'UTC','any',null);
select create_arena_challenge('d3402000-0000-4000-8000-000000000002','Dupla','frequency',7,array['d3400000-0000-4000-8000-000000000002']::uuid[],null,'UTC','any',null);
do $$ begin
 if (select count(*) from gf_challenges where name='Dupla')<>1 then raise exception 'Duplicate invitation';end if;
 if not(select rule_version=2 and rewards='{"participation":0,"winner":0}' and ends_on-starts_on=6 and starts_on>current_date from gf_challenges where id=(select id from arena_new_challenge)) then raise exception 'New contract invalid';end if;
 begin perform create_arena_challenge(gen_random_uuid(),'Prazo inválido','frequency',30,array['d3400000-0000-4000-8000-000000000002']::uuid[],null,'UTC','any',null);raise exception '30 days accepted';exception when raise_exception then if sqlerrm='30 days accepted' then raise;end if;end;
 begin perform create_arena_challenge(gen_random_uuid(),'Sem amizade','frequency',7,array['d3400000-0000-4000-8000-000000000003']::uuid[],null,'UTC','any',null);raise exception 'Stranger invited';exception when raise_exception then if sqlerrm='Stranger invited' then raise;end if;end;
end $$;
set request.jwt.claim.sub='d3400000-0000-4000-8000-000000000002';
select reply_challenge_invite((select id from arena_new_challenge),true,'Pacific/Kiritimati');
select reply_challenge_invite((select id from arena_new_challenge),true,'Pacific/Kiritimati');
do $$ begin
 if (select timezone from gf_challenge_members where challenge_id=(select id from arena_new_challenge) and user_id=auth.uid())<>'UTC' then raise exception 'Pinned timezone changed';end if;
end $$;
-- Controlled past dates in disposable fixtures only, never a production clock.
update gf_challenges set starts_on=date_trunc('week',now())::date-7,ends_on=date_trunc('week',now())::date-1,invite_until=now()-interval '8 days' where id=(select id from arena_new_challenge);
update gf_challenge_members set planned_days=array(select date_trunc('week',now())::date-7+x from generate_series(0,4)x),quota=5 where challenge_id=(select id from arena_new_challenge);
insert into workout_days(user_id,day,activity,minutes,recording_method,manual_confirmed,confirmed_at)
 select p.id,date_trunc('week',now())::date-7+x,'Caminhada',35,'manual',true,(date_trunc('week',now())::date-7+x)::timestamp+interval '12 hours'
 from profiles p cross join generate_series(0,5)x where p.id in('d3400000-0000-4000-8000-000000000001','d3400000-0000-4000-8000-000000000002');
do $$ begin
 if (gf_challenge_metric((select id from arena_new_challenge),auth.uid())->>'completed')::integer<>6 then raise exception 'Frequency must count voluntary too once per day';end if;
end $$;
select gf_settle_challenge((select id from arena_new_challenge));
create temporary table arena_result_before as select results from gf_challenges where id=(select id from arena_new_challenge);
select gf_settle_challenge((select id from arena_new_challenge));
do $$ begin
 if (select count(*) from gf_challenges c cross join lateral jsonb_array_elements(c.results)x where c.id=(select id from arena_new_challenge) and (x->>'place')::integer=1)<>2 then raise exception 'Tie missing';end if;
 if exists(select 1 from coin_movements where kind='challenge' and user_id::text like 'd3400000%') then raise exception 'New challenge paid coins';end if;
 if (select results from gf_challenges where id=(select id from arena_new_challenge))<>(select results from arena_result_before) then raise exception 'Result mutated';end if;
end $$;
-- New competition modes/durations and rematch reuse participants, not scores.
set request.jwt.claim.sub='d3400000-0000-4000-8000-000000000001';
select create_arena_challenge('d3402000-0000-4000-8000-000000000003','Revanche','consistency',14,array['d3400000-0000-4000-8000-000000000002']::uuid[],null,'UTC','timed',(select id from arena_new_challenge));
select create_arena_challenge('d3402000-0000-4000-8000-000000000004','Coletivo','collective',28,array['d3400000-0000-4000-8000-000000000002']::uuid[],4,'UTC','any',null);
do $$ begin
 if not exists(select 1 from gf_challenges where name='Revanche' and rule_version=2 and ends_on-starts_on=13 and recording_policy='timed' and rematch_of=(select id from arena_new_challenge)) or not exists(select 1 from gf_challenges where name='Coletivo' and ends_on-starts_on=27) then raise exception 'Durations/rematch invalid';end if;
 if exists(select 1 from jsonb_array_elements(get_friend_challenges())x where x->>'name'='Revanche' and exists(select 1 from jsonb_array_elements(x->'board')p where (p->>'completed')::integer>0)) then raise exception 'Pre-start workout counted';end if;
end $$;
-- Settling an existing rule-1 challenge keeps its old cap and frozen rewards.
do $$ begin
 if (select count(*) from gf_challenges c cross join lateral jsonb_array_elements(c.results)x where c.id='d3401000-0000-4000-8000-000000000002' and (x->>'completed')::integer=5 and (x->>'place')::integer=1)<>2 then raise exception 'Legacy cap or tie changed';end if;
 if (select coalesce(sum(amount),0) from coin_movements where source_key='challenge:d3401000-0000-4000-8000-000000000002')<>14 then raise exception 'Existing frozen legacy reward changed';end if;
 if exists(select 1 from coin_movements m join gf_challenges c on m.source_key='challenge:'||c.id where c.rule_version=2) then raise exception 'New challenge paid out';end if;
end $$;
-- Consistency uses accepted obligations, not a later plan or voluntary extras.
set request.jwt.claim.sub='d3400000-0000-4000-8000-000000000002';
select reply_challenge_invite((select id from gf_challenges where name='Revanche'),true,'UTC');
update gf_challenges set starts_on=date_trunc('week',now())::date-14,ends_on=date_trunc('week',now())::date-1,invite_until=now()-interval '15 days' where name='Revanche';
update gf_challenge_members set planned_days=array(select date_trunc('week',now())::date-7+x from generate_series(0,4)x),quota=5 where challenge_id=(select id from gf_challenges where name='Revanche');
set request.jwt.claim.sub='d3400000-0000-4000-8000-000000000001';
do $$ begin
 if (gf_challenge_metric((select id from gf_challenges where name='Revanche'),auth.uid())->>'completed')::integer<>0 then raise exception 'Manual counted in timed challenge';end if;
end $$;
update workout_days set recording_method='timed',manual_confirmed=false where user_id=auth.uid() and day=date_trunc('week',now())::date-7;
insert into training_plans(user_id,revision,effective_on,training_days) values(auth.uid(),2,current_date+1,array[1]);
do $$ begin
 if (gf_challenge_metric((select id from gf_challenges where name='Revanche'),auth.uid())->>'percent')::numeric<>20 then raise exception 'Frozen timed consistency should be 1/5';end if;
end $$;
-- A real same-week swap follows the compensatory date without counting both.
insert into training_reschedules(user_id,original_day,target_day,week_start,revision,created_at) values(auth.uid(),date_trunc('week',now())::date-7,date_trunc('week',now())::date-2,date_trunc('week',now())::date-7,3,date_trunc('week',now())-interval '6 days 12 hours');
update workout_days set recording_method='timed',manual_confirmed=false where user_id=auth.uid() and day=date_trunc('week',now())::date-2;
insert into training_extra_rests(user_id,day,authorized_at) values(auth.uid(),date_trunc('week',now())::date-6,date_trunc('week',now())-interval '5 days 12 hours');
insert into coin_wallets(user_id) values(auth.uid()) on conflict do nothing;
insert into medical_kits(user_id,grant_month,grant_slot,used_on,used_at,automatic,day_closed_at)
 values(auth.uid(),date_trunc('month',current_date)::date,99,date_trunc('week',now())::date-5,date_trunc('week',now())-interval '3 days',true,date_trunc('week',now())-interval '4 days');
do $$ begin
 if (gf_challenge_metric((select id from gf_challenges where name='Revanche'),auth.uid())->>'planned')::integer<>3 or (gf_challenge_metric((select id from gf_challenges where name='Revanche'),auth.uid())->>'completed')::integer<>1 then raise exception 'Swap/rest/automatic kit must yield 1/3';end if;
end $$;
-- No obligation never means a perfect score.
update gf_challenge_members set planned_days='{}' where challenge_id=(select id from gf_challenges where name='Revanche') and user_id=auth.uid();
do $$ begin if gf_challenge_metric((select id from gf_challenges where name='Revanche'),auth.uid())->'percent'<>'null'::jsonb then raise exception 'Zero denominator became perfect';end if;end $$;
-- A compensation outside the competition window is neutral, never a point.
update gf_challenges set starts_on=date_trunc('week',now())::date-20,ends_on=date_trunc('week',now())::date-7 where name='Revanche';
update gf_challenge_members set planned_days=array[date_trunc('week',now())::date-7] where challenge_id=(select id from gf_challenges where name='Revanche') and user_id=auth.uid();
do $$ begin if (gf_challenge_metric((select id from gf_challenges where name='Revanche'),auth.uid())->>'planned')::integer<>0 then raise exception 'Outside-window swap inflated obligation';end if;end $$;
-- Before any public list can settle it, demonstrate the nonfriend acceptance check.
update friendships set status='declined' where requester=auth.uid() and recipient='d3400000-0000-4000-8000-000000000002';
set request.jwt.claim.sub='d3400000-0000-4000-8000-000000000002';
do $$ begin begin perform reply_challenge_invite((select id from gf_challenges where name='Coletivo'),true,'UTC');raise exception 'No-friend acceptance';exception when raise_exception then if sqlerrm='No-friend acceptance' then raise;end if;end;end $$;
update friendships set status='accepted' where requester='d3400000-0000-4000-8000-000000000001' and recipient=auth.uid();
-- The cooperative mode preserves mandatory-only counting and has no individual winner/payment.
select reply_challenge_invite((select id from gf_challenges where name='Coletivo'),true,'UTC');
update gf_challenges set starts_on=date_trunc('week',now())::date-28,ends_on=date_trunc('week',now())::date-1,invite_until=now()-interval '29 days' where name='Coletivo';
select gf_settle_challenge((select id from gf_challenges where name='Coletivo'));
do $$ begin
 if (select sum((x->>'completed')::integer) from gf_challenges c cross join lateral jsonb_array_elements(c.results)x where c.name='Coletivo')<>10 then raise exception 'Cooperative total must keep the ten mandatory confirmations, excluding voluntary extras';end if;
 if exists(select 1 from gf_challenges c cross join lateral jsonb_array_elements(c.results)x where c.name='Coletivo' and x->'place'<>'null'::jsonb) then raise exception 'Cooperative mode declared individual winner';end if;
 if exists(select 1 from coin_movements m join gf_challenges c on m.source_key='challenge:'||c.id where c.rule_version=2) then raise exception 'Cooperative challenge paid coins';end if;
 if gf_collective_wins(auth.uid())<>1 then raise exception 'Original valid collective achievement condition changed';end if;
end $$;
-- Taunts: only approved IDs, no free text, daily max 3, idempotency, mute.
select send_arena_taunt('d3400000-0000-4000-8000-000000000001','doubt','d3403000-0000-4000-8000-000000000001');
select send_arena_taunt('d3400000-0000-4000-8000-000000000001','doubt','d3403000-0000-4000-8000-000000000001');
select send_arena_taunt('d3400000-0000-4000-8000-000000000001','sure','d3403000-0000-4000-8000-000000000002');
select send_arena_taunt('d3400000-0000-4000-8000-000000000001','watching','d3403000-0000-4000-8000-000000000003');
do $$ begin
 begin perform send_arena_taunt('d3400000-0000-4000-8000-000000000001','doubt',gen_random_uuid());raise exception 'Fourth taunt';exception when raise_exception then if sqlerrm='Fourth taunt' then raise;end if;end;
 begin perform send_arena_taunt('d3400000-0000-4000-8000-000000000003','doubt',gen_random_uuid());raise exception 'Stranger taunt';exception when raise_exception then if sqlerrm='Stranger taunt' then raise;end if;end;
 if claim_arena_taunt_push()<>'[]' then raise exception 'Push enabled automatically';end if;
 if has_function_privilege('authenticated','claim_arena_taunt_push()','execute') or has_table_privilege('authenticated','arena_taunts','select,insert,update') then raise exception 'Private social access';end if;
end $$;
set request.jwt.claim.sub='d3400000-0000-4000-8000-000000000001';
do $$ begin if jsonb_array_length(get_arena_inbox()->'messages')<>3 then raise exception 'Inbox missing messages';end if;end $$;
select set_arena_social_preferences(true,false);
set request.jwt.claim.sub='d3400000-0000-4000-8000-000000000002';
update arena_taunt_limits set sent=1;
do $$ begin begin perform send_arena_taunt('d3400000-0000-4000-8000-000000000001','sure',gen_random_uuid());raise exception 'Mute bypassed';exception when raise_exception then if sqlerrm='Mute bypassed' then raise;end if;end;end $$;
-- Optional push stays disabled until configured; test only synthetic queue rows.
set request.jwt.claim.sub='d3400000-0000-4000-8000-000000000001';
select set_arena_social_preferences(false,true);
insert into push_devices(user_id,endpoint,p256dh,auth,vapid_key,time_zone,reminder_hour,tone)
 values(auth.uid(),'https://fcm.googleapis.com/send/arena-fixture',repeat('A',87),repeat('A',22),repeat('A',87),(select name from pg_timezone_names where extract(hour from clock_timestamp() at time zone name) between 10 and 19 order by name limit 1),18,'gentle');
update arena_delivery_rules set taunt_push_enabled=true;
create temporary table arena_claimed_push as select claim_arena_taunt_push() jobs;
do $$ declare j jsonb;begin
 select jobs->0 into j from arena_claimed_push;
 if (select jsonb_array_length(jobs) from arena_claimed_push)<>1 then raise exception 'Optional push must coalesce per device';end if;
 if claim_arena_taunt_push()<>'[]' then raise exception 'Push claimed twice';end if;
 if not arena_taunt_push_allowed((j->>'job_id')::uuid,(j->>'lease_id')::uuid) then raise exception 'Eligible push rejected';end if;
 perform set_arena_social_preferences(true,true);
 if arena_taunt_push_allowed((j->>'job_id')::uuid,(j->>'lease_id')::uuid) then raise exception 'Mute did not invalidate queued push';end if;
 perform set_arena_social_preferences(false,true);
 update push_devices set enabled=false where user_id=auth.uid();
 if arena_taunt_push_allowed((j->>'job_id')::uuid,(j->>'lease_id')::uuid) then raise exception 'Permission/device disable ignored';end if;
end $$;
set request.jwt.claim.sub='d3400000-0000-4000-8000-000000000003';
do $$ begin if get_arena_inbox()->'messages'<>'[]' then raise exception 'Stranger read another inbox';end if;if get_friend_challenges()::text like '%"kg"%' or get_friend_challenges()::text like '%"email"%' then raise exception 'Private challenge data exposed';end if;end $$;
select 'PASS Arena phase 2: versioned 7/14/28, consent, idempotent invitations, all confirmed workouts, timed filter, ties, immutable zero-payment results, rematch, approved taunts/limit/mute/RLS, push disabled';
rollback;
