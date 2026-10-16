-- Web Push devices and a durable, bounded delivery queue. No browser table access.
begin;
create table public.push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9.-]+\.notify\.windows\.com)/[^[:space:]]+$' and length(endpoint)<4096),
  p256dh text not null check (p256dh ~ '^[A-Za-z0-9_-]{87}=?$'),
  auth text not null check (auth ~ '^[A-Za-z0-9_-]{22}(==)?$'),
  vapid_key text not null check (vapid_key ~ '^[A-Za-z0-9_-]{87}=?$'),
  time_zone text not null,
  reminder_hour integer not null check(reminder_hour between 8 and 20),
  tone text not null check(tone in ('gentle','dramatic')),
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
create table public.push_jobs (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.push_devices(id) on delete cascade,
  day date not null,
  slot text not null check(slot in ('reminder','last_call')),
  state text not null default 'queued' check(state in ('queued','sending','sent','expired')),
  attempts integer not null default 0,
  lease uuid,
  attempted_at timestamptz,
  unique(device_id,day,slot)
);
alter table public.push_devices enable row level security;
alter table public.push_jobs enable row level security;
revoke all on public.push_devices,public.push_jobs from anon,authenticated;

create function public.save_push_device(p_endpoint text,p_p256dh text,p_auth text,p_vapid_key text,p_timezone text,p_hour integer,p_tone text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=social_require_profile();
begin
  if not exists(select 1 from pg_timezone_names where name=p_timezone) then raise exception 'Fuso inválido.'; end if;
  if (select count(*) from push_devices where user_id=u and enabled) >= 8 and not exists(select 1 from push_devices where user_id=u and endpoint=p_endpoint) then raise exception 'Limite de aparelhos atingido.'; end if;
  -- A browser subscription can change accounts, but requires the original secret key pair.
  insert into push_devices(user_id,endpoint,p256dh,auth,vapid_key,time_zone,reminder_hour,tone)
  values(u,p_endpoint,p_p256dh,p_auth,p_vapid_key,p_timezone,p_hour,p_tone)
  on conflict(endpoint) do update set user_id=u,vapid_key=p_vapid_key,time_zone=p_timezone,reminder_hour=p_hour,tone=p_tone,enabled=true,updated_at=now()
  where push_devices.p256dh=p_p256dh and push_devices.auth=p_auth;
  if not found then raise exception 'Assinatura indisponível.'; end if;
end $$;
create function public.disable_push_device(p_endpoint text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  update push_devices set enabled=false,updated_at=now() where user_id=auth.uid() and endpoint=p_endpoint;
end $$;

-- Only the server can call these functions. Queue claim + lease prevents concurrent cron duplicates.
create function public.claim_push_jobs(p_limit integer default 100) returns table(
  job_id uuid,lease_id uuid,endpoint text,p256dh text,auth text,vapid_key text,tone text,slot text,day date,time_zone text
) language plpgsql security definer set search_path=public,pg_temp as $$
begin
  delete from push_jobs where push_jobs.day < current_date-30;
  insert into push_jobs(device_id,day,slot)
  select d.id,(now() at time zone d.time_zone)::date,
    case when extract(hour from now() at time zone d.time_zone)>=21 then 'last_call' else 'reminder' end
  from push_devices d
  where d.enabled and extract(hour from now() at time zone d.time_zone) between d.reminder_hour and 21
    and not exists(select 1 from workout_days w where w.user_id=d.user_id and (w.confirmed_at at time zone d.time_zone)::date=(now() at time zone d.time_zone)::date)
  on conflict on constraint push_jobs_device_id_day_slot_key do nothing;

  update push_jobs j set state='expired' from push_devices d where j.device_id=d.id and j.state in ('queued','sending') and
    (not d.enabled or j.day<>(now() at time zone d.time_zone)::date or extract(hour from now() at time zone d.time_zone)>=22
    or (j.slot='reminder' and extract(hour from now() at time zone d.time_zone)>=21)
    or exists(select 1 from workout_days w where w.user_id=d.user_id and (w.confirmed_at at time zone d.time_zone)::date=j.day));

  return query with candidates as (
    select j.id from push_jobs j where j.attempts<3 and (j.state='queued' or (j.state='sending' and j.attempted_at<now()-interval '10 minutes'))
    order by j.day,j.id limit least(greatest(p_limit,1),200) for update skip locked
  ), claimed as (
    update push_jobs j set state='sending',attempts=j.attempts+1,lease=gen_random_uuid(),attempted_at=now()
    from candidates c where j.id=c.id returning j.*
  ) select j.id,j.lease,d.endpoint,d.p256dh,d.auth,d.vapid_key,d.tone,j.slot,j.day,d.time_zone from claimed j join push_devices d on d.id=j.device_id;
end $$;

-- Recheck immediately before delivery: a workout or opt-out may have arrived since claim.
create function public.push_job_allowed(p_id uuid,p_lease uuid) returns boolean
language sql security definer set search_path=public,pg_temp as $$
  select exists(select 1 from push_jobs j join push_devices d on d.id=j.device_id
    where j.id=p_id and j.lease=p_lease and j.state='sending' and d.enabled
    and j.day=(now() at time zone d.time_zone)::date
    and extract(hour from now() at time zone d.time_zone) between d.reminder_hour and 21
    and (j.slot='last_call' or extract(hour from now() at time zone d.time_zone)<21)
    and not exists(select 1 from workout_days w where w.user_id=d.user_id and (w.confirmed_at at time zone d.time_zone)::date=j.day));
$$;
create function public.finish_push_job(p_id uuid,p_lease uuid,p_result text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare device uuid;
begin
  update push_jobs set state=case when p_result='sent' then 'sent' when p_result='retry' and attempts<3 then 'queued' else 'expired' end
  where id=p_id and lease=p_lease and state='sending' returning device_id into device;
  if device is not null and p_result='gone' then update push_devices set enabled=false where id=device; end if;
end $$;
revoke all on function public.save_push_device(text,text,text,text,text,integer,text),public.disable_push_device(text),public.claim_push_jobs(integer),public.push_job_allowed(uuid,uuid),public.finish_push_job(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.save_push_device(text,text,text,text,text,integer,text),public.disable_push_device(text) to authenticated;
grant execute on function public.claim_push_jobs(integer),public.push_job_allowed(uuid,uuid),public.finish_push_job(uuid,uuid,text) to service_role;
commit;
