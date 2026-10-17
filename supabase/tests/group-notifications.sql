\set ON_ERROR_STOP on
begin;
insert into public.workout_days(id,user_id,day,activity,minutes) values
 ('aaaaaaaa-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111',current_date,'Treino',30),
 ('aaaaaaaa-2222-4222-8222-222222222222','22222222-2222-4222-8222-222222222222',current_date,'Treino',30);
insert into public.push_devices(user_id,endpoint,p256dh,auth,vapid_key,time_zone,reminder_hour,tone)
select user_id,'https://fcm.googleapis.com/group-'||suffix,repeat('A',87),repeat('A',22),repeat('A',87),'UTC',18,'gentle'
from (values ('11111111-1111-4111-8111-111111111111'::uuid,'self'),('22222222-2222-4222-8222-222222222222'::uuid,'b1'),('22222222-2222-4222-8222-222222222222'::uuid,'b2'),('33333333-3333-4333-8333-333333333333'::uuid,'outsider')) v(user_id,suffix);
do $$ begin if exists(select 1 from public.group_push_jobs) then raise exception 'Workout sent an automatic notification'; end if; end $$;
set local role authenticated;
set local request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
do $$ begin
 begin perform public.notify_workout_groups('aaaaaaaa-1111-4111-8111-111111111111',array['44444444-4444-4444-8444-444444444444'::uuid]); raise exception 'Forged workout accepted'; exception when raise_exception then if sqlerrm='Forged workout accepted' then raise; end if; end;
 begin perform public.claim_group_push_jobs(); raise exception 'Client read private jobs'; exception when insufficient_privilege then null; end;
 begin perform 1 from public.group_push_jobs; raise exception 'Client read subscriptions'; exception when insufficient_privilege then null; end;
end $$;
set local request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
do $$ declare r jsonb; begin
 begin perform public.notify_workout_groups('aaaaaaaa-1111-4111-8111-111111111111',array[gen_random_uuid()]); raise exception 'Unknown group accepted'; exception when raise_exception then if sqlerrm='Unknown group accepted' then raise; end if; end;
 r:=public.notify_workout_groups('aaaaaaaa-1111-4111-8111-111111111111',array['44444444-4444-4444-8444-444444444444'::uuid]);
 if (r->>'queued')::int<>2 or (r->>'recipients')::int<>1 then raise exception 'Wrong recipients %',r; end if;
 perform public.notify_workout_groups('aaaaaaaa-1111-4111-8111-111111111111',array['44444444-4444-4444-8444-444444444444'::uuid]);
end $$;
reset role;
do $$ begin
 if (select count(*) from public.group_push_jobs)<>2 then raise exception 'Duplicate jobs or self/outsider notified'; end if;
 if exists(select 1 from public.group_push_jobs where recipient_id<>'22222222-2222-4222-8222-222222222222') then raise exception 'Membership bypass'; end if;
end $$;
create temp table group_claimed as select * from public.claim_group_push_jobs(24,'11111111-1111-4111-8111-111111111111');
do $$ begin
 if (select count(*) from group_claimed)<>2 then raise exception 'Claim missing'; end if;
 if exists(select 1 from public.claim_group_push_jobs()) then raise exception 'Concurrent duplicate claim'; end if;
 if exists(select 1 from group_claimed where not public.group_push_job_allowed(job_id,lease_id)) then raise exception 'Valid recipient already trained should still receive'; end if;
end $$;
update public.push_devices set enabled=false where endpoint='https://fcm.googleapis.com/group-b1';
update public.push_devices set user_id='33333333-3333-4333-8333-333333333333' where endpoint='https://fcm.googleapis.com/group-b2';
do $$ begin
 if exists(select 1 from group_claimed where public.group_push_job_allowed(job_id,lease_id)) then raise exception 'Opt-out or changed-account device notified'; end if;
end $$;
update public.push_devices set enabled=true where endpoint='https://fcm.googleapis.com/group-b1';
update public.push_devices set user_id='22222222-2222-4222-8222-222222222222' where endpoint='https://fcm.googleapis.com/group-b2';
select public.finish_group_push_job(job_id,gen_random_uuid(),'sent') from group_claimed;
do $$ begin if (select count(*) from public.group_push_jobs where state='sending')<>2 then raise exception 'Stale lease finished'; end if; end $$;
select public.finish_group_push_job(job_id,lease_id,'retry') from group_claimed;
truncate group_claimed;
insert into group_claimed select * from public.claim_group_push_jobs();
update public.streak_groups set status='archived' where id='44444444-4444-4444-8444-444444444444';
do $$ begin if exists(select 1 from group_claimed where public.group_push_job_allowed(job_id,lease_id)) then raise exception 'Archived group notified'; end if; end $$;
update public.streak_groups set status='active' where id='44444444-4444-4444-8444-444444444444';
select public.finish_group_push_job(job_id,lease_id,'sent') from group_claimed;
do $$ begin if exists(select 1 from public.claim_group_push_jobs()) then raise exception 'Delivered notification resent'; end if; end $$;
-- A stale workout cannot be used to manufacture new group messages.
update public.workout_days set confirmed_at=now()-interval '2 days' where id='aaaaaaaa-1111-4111-8111-111111111111';
set local role authenticated;
set local request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
do $$ begin
 begin perform public.notify_workout_groups('aaaaaaaa-1111-4111-8111-111111111111',array['44444444-4444-4444-8444-444444444444'::uuid]); raise exception 'Stale workout accepted'; exception when raise_exception then if sqlerrm='Stale workout accepted' then raise; end if; end;
end $$;
set local role anon;
do $$ begin
 begin perform public.notify_workout_groups(gen_random_uuid(),array[gen_random_uuid()]); raise exception 'Anonymous request accepted'; exception when insufficient_privilege then null; end;
end $$;
rollback;
select 'PASS: explicit group notifications, ownership, membership, private endpoints, deduplication, lease/retry, opt-out, account switch, archive and stale workout' as result;
