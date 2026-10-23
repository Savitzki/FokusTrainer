\set ON_ERROR_STOP on
begin;
-- Isolated fixtures; run only in the disposable notification test database.
insert into auth.users(id) values('d7430000-0000-4000-8000-000000000001');
insert into profiles(id,nickname) values('d7430000-0000-4000-8000-000000000001','morning.cadence');
insert into training_accounts(user_id,time_zone,started_on,revision)
values('d7430000-0000-4000-8000-000000000001','UTC',current_date-7,1);
insert into training_plans(user_id,revision,effective_on,training_days,starts_immediately)
values('d7430000-0000-4000-8000-000000000001',1,current_date-7,array[1,2,3,4,5,6,7],true);
insert into push_devices(user_id,endpoint,p256dh,auth,vapid_key,time_zone,reminder_hour,tone)
values('d7430000-0000-4000-8000-000000000001','https://fcm.googleapis.com/morning-cadence',repeat('A',87),repeat('A',22),repeat('A',87),'Pacific/Kiritimati',18,'dramatic');

do $$ declare h integer;s text;configured integer;actual text[];expected text[];begin
 foreach configured in array array[8,10,14,18,20] loop
  for h in 0..23 loop
   select coalesce(array_agg(slot order by slot),'{}') into actual
   from unnest(array['morning_06','morning_08','morning_10','reminder','last_call']) slot
   where push_slot_due(slot,h,configured);
   expected:=case when h in(6,8,10) then array['morning_'||lpad(h::text,2,'0')]
    when h=21 then array['last_call'] when h=configured then array['reminder'] else '{}'::text[] end;
   if actual<>expected then raise exception 'Schedule mismatch at %, configured %: % vs %',h,configured,actual,expected;end if;
  end loop;
 end loop;
 if push_slot_due('unexpected',6,18) or push_slot_due('morning_06',null,18) then raise exception 'Invalid slot allowed';end if;
end $$;

do $$ declare h integer;tz text;d date;j record;retry record;expected text;claimed integer;begin
 foreach h in array array[5,6,7,8,9,10,11,18,21,22] loop
  select name into tz from pg_timezone_names where extract(hour from now() at time zone name)=h order by length(name),name limit 1;
  if tz is null then raise exception 'No fixture timezone for hour %',h;end if;
  d:=(now() at time zone tz)::date;
  delete from push_jobs where device_id in(select id from push_devices where user_id='d7430000-0000-4000-8000-000000000001');
  update training_accounts set time_zone=tz,started_on=d-7 where user_id='d7430000-0000-4000-8000-000000000001';
  update training_plans set effective_on=d-7 where user_id='d7430000-0000-4000-8000-000000000001';
  -- Saved 8h/10h preferences must not create a second event in the same hour.
  update push_devices set reminder_hour=case when h in(8,10) then h else 18 end where user_id='d7430000-0000-4000-8000-000000000001';
  select count(*) into claimed from claim_push_jobs() where selection_key='d7430000-0000-4000-8000-000000000001';
  if h not in(6,8,10,18,21) then
   if claimed<>0 then raise exception 'Unscheduled hour % produced jobs',h;end if;
   continue;
  end if;
  if claimed<>1 then raise exception 'Hour % produced % jobs',h,claimed;end if;
  select q.id as job_id,q.lease as lease_id,q.slot into j from push_jobs q join push_devices dev on dev.id=q.device_id where dev.user_id='d7430000-0000-4000-8000-000000000001';
  expected:=case when h=21 then 'last_call' when h=18 then 'reminder' else 'morning_'||lpad(h::text,2,'0') end;
  if j.slot<>expected or not push_job_allowed(j.job_id,j.lease_id) then raise exception 'Hour % not deliverable with correct slot',h;end if;
  if exists(select 1 from claim_push_jobs() where selection_key='d7430000-0000-4000-8000-000000000001') then raise exception 'Concurrent cron duplicated hour %',h;end if;
  insert into workout_sessions(user_id,request_id,activity,time_zone,minimum_seconds,maximum_seconds)
   values('d7430000-0000-4000-8000-000000000001',gen_random_uuid(),'Caminhada',tz,2100,14400);
  if push_job_allowed(j.job_id,j.lease_id) then raise exception 'Active session charged at %',h;end if;
  delete from workout_sessions where user_id='d7430000-0000-4000-8000-000000000001';
  insert into training_extra_rests(user_id,day) values('d7430000-0000-4000-8000-000000000001',d);
  if push_job_allowed(j.job_id,j.lease_id) then raise exception 'Rest day charged at %',h;end if;
  delete from training_extra_rests where user_id='d7430000-0000-4000-8000-000000000001';
  insert into workout_days(user_id,day,activity,minutes) values('d7430000-0000-4000-8000-000000000001',d,'Caminhada',35);
  if push_job_allowed(j.job_id,j.lease_id) then raise exception 'Completed workout charged at %',h;end if;
  delete from workout_days where user_id='d7430000-0000-4000-8000-000000000001';
  update push_devices set enabled=false where user_id='d7430000-0000-4000-8000-000000000001';
  if push_job_allowed(j.job_id,j.lease_id) then raise exception 'Opt-out ignored at %',h;end if;
  update push_devices set enabled=true where user_id='d7430000-0000-4000-8000-000000000001';
  perform finish_push_job(j.job_id,j.lease_id,'retry');
  select * into retry from claim_push_jobs() where selection_key='d7430000-0000-4000-8000-000000000001';
  if retry.job_id is null or retry.lease_id=j.lease_id or push_job_allowed(j.job_id,j.lease_id) then raise exception 'Retry lease invalid at %',h;end if;
  perform finish_push_job(retry.job_id,retry.lease_id,'sent');
  if exists(select 1 from claim_push_jobs() where selection_key='d7430000-0000-4000-8000-000000000001') then raise exception 'Sent slot repeated at %',h;end if;
 end loop;
 if has_function_privilege('authenticated','push_slot_due(text,integer,integer)','EXECUTE')
  or has_function_privilege('anon','claim_push_jobs(integer)','EXECUTE') then raise exception 'Private schedule exposed';end if;
end $$;
rollback;
select 'PASS: 6h/8h/10h cadence, saved reminders, timezone, quiet hours, overlap, leases, retries, rest, sessions, completed workouts and opt-out';
