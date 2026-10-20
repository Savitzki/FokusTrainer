begin;
do $$ declare t record;value text;begin for t in select * from arena_group_legacy_baseline loop execute format('select md5(coalesce(string_agg(v::text,''|'' order by v::text),'''')) from(select to_jsonb(x)-''original_owner_id''-''cancel_reason''-''withdrawn_at'' v from public.%I x) rows',t.table_name) into value;if value<>t.digest then raise exception 'Group migration changed historical data: %',t.table_name;end if;end loop;
 if (select owner_id<>original_owner_id from streak_groups where id='d3311000-0000-4000-8000-000000000001') then raise exception 'Old creator not retained as admin';end if;
end $$;
insert into auth.users(id) select ('d3300000-0000-4000-8000-'||lpad(x::text,12,'0'))::uuid from generate_series(1,4)x;
insert into profiles(id,nickname) select id,'arena.'||right(id::text,1) from auth.users where id::text like 'd3300000%';
insert into training_accounts(user_id,time_zone,started_on) select id,'UTC',current_date-30 from profiles where id::text like 'd3300000%';
insert into training_plans(user_id,revision,effective_on,training_days,created_at)
 select id,1,current_date-30,case right(id::text,1) when '1' then array[1,2,3,4,5] when '2' then array[1,3,5] else array[2,4] end,current_date-30 from profiles where id::text like 'd3300000%';
insert into friendships(requester,recipient,status) select 'd3300000-0000-4000-8000-000000000001',id,'accepted' from profiles where id::text like 'd3300000%' and right(id::text,1)<>'1';
set request.jwt.claim.sub='d3300000-0000-4000-8000-000000000001';
create temporary table arena_test_group as select create_streak_group('Equipe',array['d3300000-0000-4000-8000-000000000002','d3300000-0000-4000-8000-000000000003']::uuid[],'UTC') id;
set request.jwt.claim.sub='d3300000-0000-4000-8000-000000000002';
select reply_group_invite((select id from arena_test_group),true);
set request.jwt.claim.sub='d3300000-0000-4000-8000-000000000003';
select reply_group_invite((select id from arena_test_group),true);
-- Set up an auditable prior opening, so the current cycle starts on Monday.
delete from arena_group_cycles where group_id=(select id from arena_test_group);
update streak_groups set started_on=date_trunc('week',now())::date-7,training_checked_through=current_date-1 where id=(select id from arena_test_group);
update gf_badge_memberships set accepted_at=current_date-20 where group_id=(select id from arena_test_group);
insert into arena_group_cycles values((select id from arena_test_group),date_trunc('week',now())::date-7,date_trunc('week',now())::date-7,'UTC',current_date-20,0,'[]',now(),0);
select arena_sync_group_cycle((select id from arena_test_group));
do $$ begin
 if (select target from arena_group_cycles where group_id=(select id from arena_test_group) and closed_at is null)<>8 then raise exception '80 percent of 5+3+2 must be 8';end if;
 if (select original_owner_id<>owner_id from streak_groups where id=(select id from arena_test_group)) then raise exception 'Original creator lost';end if;
end $$;
-- Freeze against later plan changes.
insert into training_plans(user_id,revision,effective_on,training_days) values('d3300000-0000-4000-8000-000000000001',2,current_date+1,array[1]);
select arena_sync_group_cycle((select id from arena_test_group));
do $$ begin if (select target from arena_group_cycles where group_id=(select id from arena_test_group) and closed_at is null)<>8 then raise exception 'Snapshot changed';end if;end $$;
-- Member can invite, cannot rename/remove/admin/close.
set request.jwt.claim.sub='d3300000-0000-4000-8000-000000000002';
insert into friendships(requester,recipient,status) values(auth.uid(),'d3300000-0000-4000-8000-000000000004','accepted');
select arena_group_command((select id from arena_test_group),'invite','d3300000-0000-4000-8000-000000000004',null,'d3301000-0000-4000-8000-000000000001');
do $$ begin
 begin perform arena_group_command((select id from arena_test_group),'rename',null,'Inválido',gen_random_uuid());raise exception 'Unauthorized rename';exception when raise_exception then if sqlerrm='Unauthorized rename' then raise;end if;end;
 begin perform close_streak_group((select id from arena_test_group));raise exception 'Unauthorized close';exception when raise_exception then if sqlerrm='Unauthorized close' then raise;end if;end;
end $$;
set request.jwt.claim.sub='d3300000-0000-4000-8000-000000000004';
select reply_group_invite((select id from arena_test_group),true);
do $$ begin if (select jsonb_array_length(participants) from arena_group_cycles where group_id=(select id from arena_test_group) and closed_at is null)<>3 then raise exception 'Midweek member changed snapshot';end if;end $$;
set request.jwt.claim.sub='d3300000-0000-4000-8000-000000000001';
select arena_group_command((select id from arena_test_group),'rename',null,'Novo nome','d3301000-0000-4000-8000-000000000002');
select arena_group_command((select id from arena_test_group),'rename',null,'Novo nome','d3301000-0000-4000-8000-000000000002');
select arena_group_command((select id from arena_test_group),'remove','d3300000-0000-4000-8000-000000000004',null,gen_random_uuid());
select arena_group_command((select id from arena_test_group),'transfer','d3300000-0000-4000-8000-000000000002',null,gen_random_uuid());
select arena_group_command((select id from arena_test_group),'leave',null,null,gen_random_uuid());
do $$ begin
 if (select status from streak_groups where id=(select id from arena_test_group))<>'active' then raise exception 'Leave archived group';end if;
 if exists(select 1 from group_members where group_id=(select id from arena_test_group) and user_id=auth.uid()) then raise exception 'Leave retained access';end if;
 if (select target from arena_group_cycles where group_id=(select id from arena_test_group) and closed_at is null)<>8 then raise exception 'Leaving reduced target';end if;
end $$;
-- Challenges stay historical on completed rows, cancel 1v1, withdraw multi-party.
insert into gf_challenges(id,owner_id,name,kind,starts_on,ends_on,invite_until,target,rewards,settled_at,results)
 select ('d3302000-0000-4000-8000-'||lpad(x::text,12,'0'))::uuid,'d3300000-0000-4000-8000-000000000001','Teste','frequency',current_date+1,current_date+7,now()+interval '1 day',5,'{}',case when x=3 then now() end,case when x=3 then '[{"completed":2}]'::jsonb end from generate_series(1,3)x;
insert into gf_challenge_members(challenge_id,user_id,nickname,status,timezone,quota)
 select c.id,p.id,p.nickname,'accepted','UTC',5 from gf_challenges c cross join profiles p where c.id::text like 'd3302000%' and p.id in('d3300000-0000-4000-8000-000000000001','d3300000-0000-4000-8000-000000000002');
insert into gf_challenge_members(challenge_id,user_id,nickname,status,timezone,quota) values('d3302000-0000-4000-8000-000000000002','d3300000-0000-4000-8000-000000000003','arena.3','accepted','UTC',2);
select remove_friend('d3300000-0000-4000-8000-000000000002');
select remove_friend('d3300000-0000-4000-8000-000000000002');
do $$ begin
 if not (select cancelled and cancel_reason='friendship-ended' and results='[]' from gf_challenges where id='d3302000-0000-4000-8000-000000000001') then raise exception '1v1 cancellation incorrect';end if;
 if (select results from gf_challenges where id='d3302000-0000-4000-8000-000000000003')<>'[{"completed":2}]' then raise exception 'Historical result changed';end if;
 if (select status from gf_challenge_members where challenge_id='d3302000-0000-4000-8000-000000000002' and user_id=auth.uid())<>'withdrawn' then raise exception 'Multiplayer withdrawal missing';end if;
 if exists(select 1 from coin_movements where user_id::text like 'd3300000%' and kind='challenge') then raise exception 'Unexpected rewards';end if;
 if has_function_privilege('authenticated','arena_group_goals(uuid)','execute') or has_table_privilege('authenticated','arena_group_cycles','select') then raise exception 'Private helper exposed';end if;
end $$;
set request.jwt.claim.sub='d3300000-0000-4000-8000-000000000002';
select arena_group_command((select id from arena_test_group),'close',null,null,gen_random_uuid());
do $$ begin if (select status from streak_groups where id=(select id from arena_test_group))<>'archived' then raise exception 'Admin close failed';end if;end $$;
-- No-plan and zero-target groups are deterministic, even with mixed timezones.
insert into streak_groups(id,owner_id,name,time_zone,status,started_on,training_checked_through)
 values('d3304000-0000-4000-8000-000000000001',auth.uid(),'Sem plano','Pacific/Kiritimati','active',(now() at time zone 'Pacific/Kiritimati')::date,(now() at time zone 'Pacific/Kiritimati')::date-1);
insert into group_members values('d3304000-0000-4000-8000-000000000001',auth.uid(),'accepted');
-- Remove only these test users' plans to demonstrate zero is not auto-success.
delete from training_plans where user_id=auth.uid();
select arena_sync_group_cycle('d3304000-0000-4000-8000-000000000001');
do $$ declare c arena_group_cycles;begin
 select * into strict c from arena_group_cycles where group_id='d3304000-0000-4000-8000-000000000001';
 if c.target<>0 or c.timezone<>'Pacific/Kiritimati' or c.week_start<>date_trunc('week',now() at time zone 'Pacific/Kiritimati')::date then raise exception 'Zero target/timezone mismatch';end if;
end $$;
-- A last refusal leaves the accepted team intact; it never closes everyone.
insert into streak_groups(id,owner_id,name,time_zone,status) values('d3304000-0000-4000-8000-000000000002',auth.uid(),'Aceite e recusa','UTC','pending');
insert into group_members values('d3304000-0000-4000-8000-000000000002',auth.uid(),'accepted'),('d3304000-0000-4000-8000-000000000002','d3300000-0000-4000-8000-000000000003','accepted'),('d3304000-0000-4000-8000-000000000002','d3300000-0000-4000-8000-000000000004','invited');
set request.jwt.claim.sub='d3300000-0000-4000-8000-000000000004';
select reply_group_invite('d3304000-0000-4000-8000-000000000002',false);
do $$ begin if (select status from streak_groups where id='d3304000-0000-4000-8000-000000000002')<>'active' then raise exception 'Refusal destroyed or stranded the team';end if;end $$;
select 'PASS Arena phase 1: 80% frozen targets, membership/admin permissions, transfer/leave/close, idempotency, friendship cancellation, histories, RLS, no rewards';
rollback;
