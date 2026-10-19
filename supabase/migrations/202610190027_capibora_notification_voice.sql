-- Copy history and fresh eligibility for the existing push/local reminder flows.
-- No new schedules, rewards, preferences or changes to workout/streak calculations.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
alter table public.push_jobs add column message_id text,
 add column humor text check(humor in('light','teasing','exaggerated'));
create index if not exists push_devices_user_id on public.push_devices(user_id);
create index if not exists group_push_jobs_device_recent on public.group_push_jobs(device_id,attempted_at desc) where state='sent';
create table public.local_reminder_receipts (
 user_id uuid not null references public.profiles(id) on delete cascade,
 day date not null, kind text not null check(kind in('workout','weight')),
 claimed_at timestamptz not null default clock_timestamp(),
 primary key(user_id,day,kind)
);
create index local_reminder_receipts_day on public.local_reminder_receipts(day);
alter table public.local_reminder_receipts enable row level security;
revoke all on public.local_reminder_receipts from public,anon,authenticated;

create function public.notification_workout_pending(p_user uuid,p_day date) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from training_accounts a where a.user_id=p_user
  and p_day=(now() at time zone a.time_zone)::date and training_has_plan(p_user,p_day)
  and training_day_kind(p_user,p_day)='training'
  and not exists(select 1 from workout_days w where w.user_id=p_user and w.day=p_day)
  and not exists(select 1 from workout_sessions s where s.user_id=p_user and s.status='active'
    and now()<s.started_at+make_interval(secs=>s.maximum_seconds)));
$$;
create or replace function public.push_job_allowed(p_id uuid,p_lease uuid) returns boolean
language sql security definer set search_path=public,pg_temp as $$
 select exists(select 1 from push_jobs j join push_devices d on d.id=j.device_id
 join training_accounts a on a.user_id=d.user_id cross join workout_recording_rules r
 where j.id=p_id and j.lease=p_lease and j.state='sending' and d.enabled
  and j.day=(now() at time zone a.time_zone)::date
  and (now() at time zone a.time_zone)::time>=time '08:00'
  and (now() at time zone a.time_zone)::time<time '22:00'
  and now()+make_interval(mins=>r.minimum_minutes)<((j.day+1)::timestamp at time zone a.time_zone)
  and ((j.slot='reminder' and extract(hour from now() at time zone a.time_zone)=d.reminder_hour)
    or(j.slot='last_call' and extract(hour from now() at time zone a.time_zone)=21))
  and notification_workout_pending(d.user_id,j.day)
  and not exists(select 1 from local_reminder_receipts l where l.user_id=d.user_id and l.day=j.day and l.kind='workout'));
$$;
-- Keep the original two slots: the configured hour (default 18h) and 21h.
-- Use the account's fixed timezone, not the travelling device's clock.
drop function public.claim_push_jobs(integer);
create function public.claim_push_jobs(p_limit integer default 100) returns table(
 job_id uuid,lease_id uuid,endpoint text,p256dh text,auth text,vapid_key text,tone text,slot text,day date,time_zone text,
 local_hour integer,local_minute integer,selection_key text,recent_ids text[],last_exaggerated_day date,message_id text,minimum_minutes integer
) language plpgsql security definer set search_path=public,pg_temp as $$
begin
 delete from push_jobs where push_jobs.day<current_date-30;
 delete from local_reminder_receipts where local_reminder_receipts.day<current_date-30;
 insert into push_jobs(device_id,day,slot)
 select d.id,(now() at time zone a.time_zone)::date,
  case when extract(hour from now() at time zone a.time_zone)=21 then 'last_call' else 'reminder' end
 from push_devices d join training_accounts a on a.user_id=d.user_id
 where d.enabled and extract(hour from now() at time zone a.time_zone) in(d.reminder_hour,21)
  and notification_workout_pending(d.user_id,(now() at time zone a.time_zone)::date)
  and not exists(select 1 from local_reminder_receipts l where l.user_id=d.user_id and l.day=(now() at time zone a.time_zone)::date and l.kind='workout')
 on conflict on constraint push_jobs_device_id_day_slot_key do nothing;
 -- Reuse the same fresh validation for queued, leased and retried messages.
 update push_jobs j set state='expired' where j.state in('queued','sending') and not exists(
  select 1 from push_devices d join training_accounts a on a.user_id=d.user_id
  where d.id=j.device_id and d.enabled and j.day=(now() at time zone a.time_zone)::date
  and ((j.slot='reminder' and extract(hour from now() at time zone a.time_zone)=d.reminder_hour)
    or(j.slot='last_call' and extract(hour from now() at time zone a.time_zone)=21))
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
-- Persist the selected ID before delivery so retries retain their message. The
-- account lock also prevents concurrent devices choosing excessive exaggeration.
create function public.reserve_push_message(p_id uuid,p_lease uuid,p_message_id text,p_humor text,p_fallback_id text)
returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid;j push_jobs;chosen text:=p_message_id;level text:=p_humor;
begin
 select d.user_id into u from push_jobs q join push_devices d on d.id=q.device_id where q.id=p_id;
 if u is null then return null;end if;
 perform 1 from training_accounts where user_id=u for update;
 if not push_job_allowed(p_id,p_lease) then return null;end if;
 select * into j from push_jobs where id=p_id for update;
 if j.message_id is not null and not(j.humor<>'light' and exists(select 1 from push_devices where user_id=u and id=j.device_id and tone='gentle')) then return j.message_id;end if;
 if p_message_id is null or length(p_message_id)>80 or p_fallback_id is null or length(p_fallback_id)>80
  or p_humor is null or p_humor not in('light','teasing','exaggerated') then return null;end if;
 if p_humor='exaggerated' and exists(select 1 from push_jobs h join push_devices d on d.id=h.device_id
  where d.user_id=u and h.humor='exaggerated' and h.day>=j.day-1)
 then chosen:=p_fallback_id;level:='light';end if;
 update push_jobs set message_id=chosen,humor=level where id=p_id;
 return chosen;
end $$;

-- Existing local reminders remain opt-in. Claim once per account/day/kind,
-- even with multiple open tabs/devices. A push-enabled account uses push for
-- workouts; weight reminders retain their independent, existing preference.
create function public.claim_local_reminder(p_kind text,p_time text,p_timezone text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=social_require_profile();tz text;t timestamp;d date;scheduled time;claimed integer;
begin
 if p_kind not in('workout','weight') or p_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then return null;end if;
 select time_zone into tz from training_accounts where user_id=u for update;
 if tz is null then return null;end if; -- No implicit plan or account created by a reminder.
 t:=now() at time zone tz;d:=t::date;scheduled:=p_time::time;
 if t::time<time '08:00' or t::time>=time '22:00' or t<d+scheduled or t>=d+scheduled+interval '1 hour' then return null;end if;
 if p_kind='workout' and (not notification_workout_pending(u,d)
  or exists(select 1 from push_devices where user_id=u and enabled)
  or now()+make_interval(mins=>(select minimum_minutes from workout_recording_rules))>=((d+1)::timestamp at time zone tz)) then return null;end if;
 if p_kind='weight' and exists(select 1 from weight_entries where user_id=u and day=d) then return null;end if;
 insert into local_reminder_receipts(user_id,day,kind) values(u,d,p_kind) on conflict do nothing;
 get diagnostics claimed=row_count;
 if claimed=0 then return null;end if;
 return jsonb_build_object('day',d,'hour',extract(hour from t)::integer,'minute',extract(minute from t)::integer,
  'selectionKey',u::text,'timezone',tz);
end $$;

-- Group notifications still originate only from an explicit post-workout request.
-- Neutral copy is valid on rest days too; throttle nearby real events per device.
create or replace function public.group_push_job_allowed(p_id uuid,p_lease uuid)
returns boolean language sql security definer set search_path=public,pg_temp as $$
 select exists(select 1 from group_push_jobs j
 join group_workout_events e on e.id=j.event_id join streak_groups g on g.id=e.group_id
 join workout_days w on w.id=e.workout_id and w.user_id=e.sender_id
 join push_devices d on d.id=j.device_id and d.user_id=j.recipient_id and d.enabled
 join group_members sender on sender.group_id=g.id and sender.user_id=e.sender_id and sender.status='accepted'
 join group_members recipient on recipient.group_id=g.id and recipient.user_id=j.recipient_id and recipient.status='accepted'
 where j.id=p_id and j.lease=p_lease and j.state='sending' and j.recipient_id<>e.sender_id
  and g.status='active' and e.created_at>now()-interval '30 minutes'
  and (now() at time zone coalesce((select time_zone from training_accounts where user_id=j.recipient_id),d.time_zone))::time>=time '08:00'
  and (now() at time zone coalesce((select time_zone from training_accounts where user_id=j.recipient_id),d.time_zone))::time<time '22:00'
  and (w.confirmed_at at time zone g.time_zone)::date=(now() at time zone g.time_zone)::date
  and not exists(select 1 from group_push_jobs recent where recent.device_id=j.device_id and recent.id<>j.id
   and recent.state='sent' and recent.attempted_at>now()-interval '30 minutes')
  -- Among simultaneous real events only the oldest claim may deliver.
  and not exists(select 1 from group_push_jobs earlier join group_workout_events ee on ee.id=earlier.event_id
   where earlier.device_id=j.device_id and earlier.id<>j.id and earlier.state in('queued','sending')
    and ee.created_at>now()-interval '30 minutes' and (ee.created_at,earlier.id)<(e.created_at,j.id)));
$$;
revoke all on function public.notification_workout_pending(uuid,date),public.claim_push_jobs(integer),public.reserve_push_message(uuid,uuid,text,text,text),public.claim_local_reminder(text,text,text) from public,anon,authenticated;
grant execute on function public.claim_push_jobs(integer),public.reserve_push_message(uuid,uuid,text,text,text) to service_role;
grant execute on function public.claim_local_reminder(text,text,text) to authenticated;
notify pgrst,'reload schema';
commit;
