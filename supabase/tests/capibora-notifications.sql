\set ON_ERROR_STOP on
begin;
-- Isolated fixtures only; the runner uses a disposable PostgreSQL container.
insert into auth.users(id) values('d7000000-0000-4000-8000-000000000001'),('d7000000-0000-4000-8000-000000000002');
insert into profiles(id,nickname) values('d7000000-0000-4000-8000-000000000001','voice.one'),('d7000000-0000-4000-8000-000000000002','voice.two');
select name as tz from pg_timezone_names where extract(hour from now() at time zone name)=17 order by length(name),name limit 1 \gset
insert into training_accounts(user_id,time_zone,started_on,revision) select id,:'tz',(now() at time zone :'tz')::date,1 from profiles where nickname in('voice.one','voice.two');
insert into training_plans(user_id,revision,effective_on,training_days,starts_immediately)
select user_id,1,started_on,array(select x from generate_series(1,7) x where x<>extract(isodow from started_on+1)::integer and x<>extract(isodow from started_on+2)::integer),true
from training_accounts where user_id='d7000000-0000-4000-8000-000000000001';
insert into push_devices(user_id,endpoint,p256dh,auth,vapid_key,time_zone,reminder_hour,tone)
select id,'https://fcm.googleapis.com/voice-'||nickname,repeat('A',87),repeat('A',22),repeat('A',87),'Pacific/Kiritimati',17,'dramatic' from profiles where nickname in('voice.one','voice.two');
create temp table voice_claimed as select * from claim_push_jobs() where selection_key='d7000000-0000-4000-8000-000000000001';
do $$ declare j record;begin
 if exists(select 1 from push_jobs q join push_devices d on d.id=q.device_id where d.user_id='d7000000-0000-4000-8000-000000000002') then raise exception 'Unplanned account charged';end if;
 if (select count(*) from voice_claimed)<>1 then raise exception 'Due reminder missing';end if;
 select * into j from voice_claimed;
 if j.local_hour<>17 or j.time_zone=(select time_zone from push_devices where endpoint like '%voice.one') then raise exception 'Travelling device changed account timezone';end if;
 if not push_job_allowed(j.job_id,j.lease_id) then raise exception 'Valid job rejected';end if;
 if exists(select 1 from claim_push_jobs() where selection_key='d7000000-0000-4000-8000-000000000001') then raise exception 'Concurrent lease duplicate';end if;
 if reserve_push_message(j.job_id,j.lease_id,'afternoon-bora','exaggerated','afternoon-wait')<>'afternoon-bora' then raise exception 'Selection missing';end if;
 if reserve_push_message(j.job_id,j.lease_id,'afternoon-go','exaggerated','afternoon-today')<>'afternoon-bora' then raise exception 'Retry changed copy';end if;
end $$;
-- Another device / previous exaggerated day cannot produce consecutive exaggeration.
insert into push_devices(user_id,endpoint,p256dh,auth,vapid_key,time_zone,reminder_hour,tone)
select user_id,endpoint||'-second',p256dh,auth,vapid_key,time_zone,reminder_hour,tone from push_devices where endpoint like '%voice.one';
create temp table second_claim as select * from claim_push_jobs() where selection_key='d7000000-0000-4000-8000-000000000001';
do $$ declare j record;begin
 select * into j from second_claim;
 if reserve_push_message(j.job_id,j.lease_id,'afternoon-hello','exaggerated','afternoon-wait')<>'afternoon-wait' then raise exception 'Concurrent device exaggerated twice';end if;
end $$;
-- A timer on another device invalidates an already claimed reminder.
insert into workout_sessions(user_id,request_id,activity,time_zone,minimum_seconds,maximum_seconds)
select user_id,gen_random_uuid(),'Caminhada',time_zone,2100,14400 from training_accounts where user_id='d7000000-0000-4000-8000-000000000001';
do $$ begin if exists(select 1 from voice_claimed where push_job_allowed(job_id,lease_id)) then raise exception 'Active timer charged';end if;end $$;
delete from workout_sessions where user_id='d7000000-0000-4000-8000-000000000001';
insert into training_extra_rests(user_id,day) select user_id,started_on from training_accounts where user_id='d7000000-0000-4000-8000-000000000001';
do $$ begin if exists(select 1 from voice_claimed where push_job_allowed(job_id,lease_id)) then raise exception 'Extra rest charged';end if;end $$;
delete from training_extra_rests where user_id='d7000000-0000-4000-8000-000000000001';
-- Medical protection, scheduled rest and a rescheduled-away day all suppress reminders.
insert into coin_wallets(user_id) values('d7000000-0000-4000-8000-000000000001') on conflict do nothing;
insert into medical_kits(user_id,grant_month,grant_slot,used_on,used_at)
select user_id,date_trunc('month',started_on)::date,1,started_on,now() from training_accounts where user_id='d7000000-0000-4000-8000-000000000001';
do $$ begin if exists(select 1 from voice_claimed where push_job_allowed(job_id,lease_id)) then raise exception 'Medical protection charged';end if;end $$;
delete from medical_kits where user_id='d7000000-0000-4000-8000-000000000001';
update training_plans set training_days=array(select x from generate_series(1,7)x where x<>extract(isodow from (now() at time zone :'tz')::date)::integer and x<>extract(isodow from (now() at time zone :'tz')::date+1)::integer) where user_id='d7000000-0000-4000-8000-000000000001';
do $$ begin if exists(select 1 from voice_claimed where push_job_allowed(job_id,lease_id)) then raise exception 'Scheduled rest charged';end if;end $$;
update training_plans set training_days=array(select x from generate_series(1,7)x where x<>extract(isodow from (now() at time zone :'tz')::date+1)::integer and x<>extract(isodow from (now() at time zone :'tz')::date+2)::integer) where user_id='d7000000-0000-4000-8000-000000000001';
-- Pure fixture insertion lets this test cover Sunday too, without changing production rules.
do $$ declare d date;begin
 select started_on into d from training_accounts where user_id='d7000000-0000-4000-8000-000000000001';
 if extract(isodow from d)<7 then
  insert into training_reschedules(user_id,original_day,target_day,week_start,revision) values('d7000000-0000-4000-8000-000000000001',d,d+1,d-(extract(isodow from d)::integer-1),2);
  if exists(select 1 from voice_claimed where push_job_allowed(job_id,lease_id)) then raise exception 'Rescheduled origin charged';end if;
  delete from training_reschedules where user_id='d7000000-0000-4000-8000-000000000001';
 end if;
end $$;
insert into workout_days(user_id,day,activity,minutes) select user_id,started_on,'Caminhada',35 from training_accounts where user_id='d7000000-0000-4000-8000-000000000001';
do $$ begin if exists(select 1 from voice_claimed where push_job_allowed(job_id,lease_id)) then raise exception 'Completed workout charged between slots';end if;end $$;
delete from workout_days where user_id='d7000000-0000-4000-8000-000000000001';
update push_devices set enabled=false where user_id='d7000000-0000-4000-8000-000000000001';
do $$ begin if exists(select 1 from voice_claimed where push_job_allowed(job_id,lease_id)) then raise exception 'Opt-out ignored';end if;end $$;
-- Local + push duplication, clock manipulation and a second tab.
set local request.jwt.claim.sub='d7000000-0000-4000-8000-000000000001';
set local role authenticated;
select claim_local_reminder('workout',to_char(now() at time zone :'tz','HH24:MI'),'UTC') as local_claim \gset
reset role;
do $$ begin if (select count(*) from local_reminder_receipts where user_id='d7000000-0000-4000-8000-000000000001' and kind='workout')<>1 then raise exception 'Local claim missing';end if;end $$;
set local role authenticated;
do $$ declare tz text;begin
 select null into tz; -- Authenticated clients cannot inspect private delivery state.
 if claim_local_reminder('workout','00:00','UTC') is not null then raise exception 'Stale local reminder allowed';end if;
 begin perform 1 from local_reminder_receipts;raise exception 'Private receipts exposed';exception when insufficient_privilege then null;end;
 begin perform reserve_push_message(gen_random_uuid(),gen_random_uuid(),'x','light','y');raise exception 'Client wrote push copy';exception when insufficient_privilege then null;end;
end $$;
select claim_local_reminder('workout',to_char(now() at time zone :'tz','HH24:MI'),'Pacific/Kiritimati') is null as duplicate_blocked \gset
reset role;
\if :duplicate_blocked
\else
 \quit 1
\endif
update push_devices set enabled=true where user_id='d7000000-0000-4000-8000-000000000001';
do $$ begin if exists(select 1 from voice_claimed where push_job_allowed(job_id,lease_id)) then raise exception 'Push duplicated local notification';end if;end $$;
-- Existing weight record invalidates a reminder without commenting on its value.
insert into weight_entries(user_id,id,day,kg,recorded_at) select user_id,gen_random_uuid(),started_on,70,now() from training_accounts where user_id='d7000000-0000-4000-8000-000000000001';
set local role authenticated;
select claim_local_reminder('weight',to_char(now() at time zone :'tz','HH24:MI'),'UTC') is null as weight_suppressed \gset
reset role;
\if :weight_suppressed
\else
 \quit 1
\endif
-- Real account-local morning, afternoon and evening, regardless of CI UTC time.
delete from local_reminder_receipts where user_id='d7000000-0000-4000-8000-000000000001';
do $$ declare h integer;tz_value text;d_value date;begin
 foreach h in array array[9,17,21] loop
  select name into tz_value from pg_timezone_names where extract(hour from now() at time zone name)=h order by length(name),name limit 1;
  d_value:=(now() at time zone tz_value)::date;
  update training_accounts set time_zone=tz_value where user_id='d7000000-0000-4000-8000-000000000001';
  update training_plans set effective_on=d_value-7,training_days=array(select x from generate_series(1,7)x where x<>extract(isodow from d_value+1)::integer and x<>extract(isodow from d_value+2)::integer) where user_id='d7000000-0000-4000-8000-000000000001';
  update push_devices set reminder_hour=least(h,20) where user_id='d7000000-0000-4000-8000-000000000001';
  update push_jobs q set day=d_value,slot=case when h=21 then 'last_call' else 'reminder' end from push_devices dev where dev.id=q.device_id and dev.user_id='d7000000-0000-4000-8000-000000000001';
  if not exists(select 1 from voice_claimed where push_job_allowed(job_id,lease_id)) then raise exception 'Account-local hour % not allowed',h;end if;
  if h=21 then
   update workout_recording_rules set minimum_minutes=180;
   if exists(select 1 from voice_claimed where push_job_allowed(job_id,lease_id)) then raise exception 'Insufficient time for configured workout minimum';end if;
   update workout_recording_rules set minimum_minutes=35;
  end if;
 end loop;
end $$;
update training_accounts set time_zone=:'tz' where user_id='d7000000-0000-4000-8000-000000000001';
-- Two explicit real group events near each other produce a single social alert.
insert into workout_days(user_id,day,activity,minutes)
select user_id,(now() at time zone time_zone)::date,'Caminhada',35 from training_accounts where user_id='d7000000-0000-4000-8000-000000000001';
insert into streak_groups(id,owner_id,name,time_zone,status,started_on)
select id,'d7000000-0000-4000-8000-000000000001',name,:'tz','active',(now() at time zone :'tz')::date from
 (values('d7000000-0000-4000-8000-000000000011'::uuid,'Voice group one'),('d7000000-0000-4000-8000-000000000012'::uuid,'Voice group two'))v(id,name);
insert into group_members(group_id,user_id,status)
select g.id,p.id,'accepted' from streak_groups g cross join profiles p
where g.id in('d7000000-0000-4000-8000-000000000011','d7000000-0000-4000-8000-000000000012') and p.nickname in('voice.one','voice.two');
set local request.jwt.claim.sub='d7000000-0000-4000-8000-000000000001';
select notify_workout_groups((select id from workout_days where user_id=auth.uid()),array['d7000000-0000-4000-8000-000000000011'::uuid,'d7000000-0000-4000-8000-000000000012'::uuid]);
create temp table social_voice_claimed as select * from claim_group_push_jobs(24,'d7000000-0000-4000-8000-000000000001');
do $$ begin
 if (select count(*) from social_voice_claimed)<>2 then raise exception 'Real social events lost';end if;
 if (select count(*) from social_voice_claimed where group_push_job_allowed(job_id,lease_id))<>1 then raise exception 'Nearby group events not grouped';end if;
end $$;
-- Resting recipients can receive neutral factual social copy, without a charge.
update training_accounts set time_zone=:'tz' where user_id='d7000000-0000-4000-8000-000000000002';
update push_devices set enabled=false where user_id='d7000000-0000-4000-8000-000000000002';
do $$ begin if exists(select 1 from social_voice_claimed where group_push_job_allowed(job_id,lease_id)) then raise exception 'Social opt-out ignored';end if;end $$;
update push_devices set enabled=true where user_id='d7000000-0000-4000-8000-000000000002';
update training_accounts set time_zone=(select name from pg_timezone_names where extract(hour from now() at time zone name)=23 order by length(name) limit 1) where user_id='d7000000-0000-4000-8000-000000000002';
do $$ begin if exists(select 1 from social_voice_claimed where group_push_job_allowed(job_id,lease_id)) then raise exception 'Social quiet hours ignored';end if;end $$;
update training_accounts set time_zone=:'tz' where user_id='d7000000-0000-4000-8000-000000000002';
select finish_group_push_job(job_id,lease_id,'sent') from social_voice_claimed where group_push_job_allowed(job_id,lease_id);
do $$ begin if exists(select 1 from social_voice_claimed where group_push_job_allowed(job_id,lease_id)) then raise exception 'Social events repeated within cooldown';end if;end $$;

-- Quiet hours and insufficient time use the server's configured minimum.
update training_accounts set time_zone=(select name from pg_timezone_names where extract(hour from now() at time zone name)=23 order by length(name) limit 1) where user_id='d7000000-0000-4000-8000-000000000001';
do $$ begin if exists(select 1 from voice_claimed where push_job_allowed(job_id,lease_id)) then raise exception 'Quiet hours ignored';end if;end $$;
do $$ begin
 if not(select relrowsecurity from pg_class where oid='local_reminder_receipts'::regclass) then raise exception 'RLS missing';end if;
 if has_function_privilege('anon','claim_local_reminder(text,text,text)','EXECUTE') then raise exception 'Anonymous claim allowed';end if;
end $$;
rollback;
select 'PASS: notification eligibility, stable copy, repeated attempts, clocks, protection, active session, rest, reschedule, opt-out, private weight and cross-channel deduplication';
