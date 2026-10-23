-- Morning workout reminders at 06h, 08h and 10h in the account timezone.
-- Preserve saved afternoon/evening preferences, consent and all eligibility guards.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
alter table public.push_jobs drop constraint push_jobs_slot_check;
alter table public.push_jobs add constraint push_jobs_slot_check
 check(slot in('morning_06','morning_08','morning_10','reminder','last_call'));

-- One event per hour even when a saved reminder overlaps the morning cadence.
create function public.push_slot_due(p_slot text,p_hour integer,p_reminder_hour integer)
returns boolean language sql immutable set search_path=public,pg_temp as $$
 select coalesce(case p_slot
  when 'morning_06' then p_hour=6
  when 'morning_08' then p_hour=8
  when 'morning_10' then p_hour=10
  when 'reminder' then p_hour=p_reminder_hour and p_hour between 8 and 20 and p_hour not in(8,10)
  when 'last_call' then p_hour=21
  else false end,false);
$$;
revoke all on function public.push_slot_due(text,integer,integer) from public,anon,authenticated;

create or replace function public.push_job_allowed(p_id uuid,p_lease uuid) returns boolean
language sql security definer set search_path=public,pg_temp as $$
 select exists(select 1 from push_jobs j join push_devices d on d.id=j.device_id
 join training_accounts a on a.user_id=d.user_id cross join workout_recording_rules r
 where j.id=p_id and j.lease=p_lease and j.state='sending' and d.enabled
  and j.day=(now() at time zone a.time_zone)::date
  and (now() at time zone a.time_zone)::time>=time '06:00'
  and (now() at time zone a.time_zone)::time<time '22:00'
  and now()+make_interval(mins=>r.minimum_minutes)<((j.day+1)::timestamp at time zone a.time_zone)
  and push_slot_due(j.slot,extract(hour from now() at time zone a.time_zone)::integer,d.reminder_hour)
  and notification_workout_pending(d.user_id,j.day)
  and not exists(select 1 from local_reminder_receipts l where l.user_id=d.user_id and l.day=j.day and l.kind='workout'));
$$;
create or replace function public.claim_push_jobs(p_limit integer default 100) returns table(
 job_id uuid,lease_id uuid,endpoint text,p256dh text,auth text,vapid_key text,tone text,slot text,day date,time_zone text,
 local_hour integer,local_minute integer,selection_key text,recent_ids text[],last_exaggerated_day date,message_id text,minimum_minutes integer
) language plpgsql security definer set search_path=public,pg_temp as $$
begin
 delete from push_jobs where push_jobs.day<current_date-30;
 delete from local_reminder_receipts where local_reminder_receipts.day<current_date-30;
 insert into push_jobs(device_id,day,slot)
 select d.id,(now() at time zone a.time_zone)::date,
  due.slot
 from push_devices d join training_accounts a on a.user_id=d.user_id
 cross join (values('morning_06'),('morning_08'),('morning_10'),('reminder'),('last_call')) due(slot)
 where d.enabled and push_slot_due(due.slot,extract(hour from now() at time zone a.time_zone)::integer,d.reminder_hour)
  and notification_workout_pending(d.user_id,(now() at time zone a.time_zone)::date)
  and not exists(select 1 from local_reminder_receipts l where l.user_id=d.user_id and l.day=(now() at time zone a.time_zone)::date and l.kind='workout')
 on conflict on constraint push_jobs_device_id_day_slot_key do nothing;
 -- Reuse the same fresh validation for queued, leased and retried messages.
 update push_jobs j set state='expired' where j.state in('queued','sending') and not exists(
  select 1 from push_devices d join training_accounts a on a.user_id=d.user_id
  where d.id=j.device_id and d.enabled and j.day=(now() at time zone a.time_zone)::date
  and push_slot_due(j.slot,extract(hour from now() at time zone a.time_zone)::integer,d.reminder_hour)
  and notification_workout_pending(d.user_id,j.day)
  and not exists(select 1 from local_reminder_receipts l where l.user_id=d.user_id and l.day=j.day and l.kind='workout'));
 return query with candidates as (
  select j.id from push_jobs j where j.attempts<3 and(j.state='queued' or(j.state='sending' and j.attempted_at<now()-interval '10 minutes'))
  order by j.day,j.id limit least(greatest(p_limit,1),200) for update skip locked
 ), claimed as (
  update push_jobs j set state='sending',attempts=j.attempts+1,lease=gen_random_uuid(),attempted_at=now()
  from candidates c where j.id=c.id returning j.*
 ) select j.id,j.lease,d.endpoint,d.p256dh,d.auth,d.vapid_key,d.tone,j.slot,j.day,a.time_zone,
 extract(hour from now() at time zone a.time_zone)::integer,extract(minute from now() at time zone a.time_zone)::integer,
 d.user_id::text,
 array(select h.message_id from push_jobs h join push_devices hd on hd.id=h.device_id
  where hd.user_id=d.user_id and h.id<>j.id and h.message_id is not null and h.day>=j.day-7
  order by h.day desc,h.attempted_at desc limit 3),
 (select max(h.day) from push_jobs h join push_devices hd on hd.id=h.device_id where hd.user_id=d.user_id and h.humor='exaggerated'),
 j.message_id,r.minimum_minutes
 from claimed j join push_devices d on d.id=j.device_id join training_accounts a on a.user_id=d.user_id cross join workout_recording_rules r;
end $$;
notify pgrst,'reload schema';
commit;
