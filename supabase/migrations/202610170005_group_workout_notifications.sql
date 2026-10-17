-- After migrations 001-004. Only an explicit authenticated request creates events.
begin;
create table if not exists public.group_workout_events (
 id uuid primary key default gen_random_uuid(),
 group_id uuid not null references public.streak_groups(id) on delete cascade,
 workout_id uuid not null references public.workout_days(id) on delete cascade,
 sender_id uuid not null references public.profiles(id) on delete cascade,
 created_at timestamptz not null default now(),
 unique(group_id,workout_id)
);
create table if not exists public.group_push_jobs (
 id uuid primary key default gen_random_uuid(),
 event_id uuid not null references public.group_workout_events(id) on delete cascade,
 device_id uuid not null references public.push_devices(id) on delete cascade,
 recipient_id uuid not null references public.profiles(id) on delete cascade,
 state text not null default 'queued' check(state in ('queued','sending','sent','expired')),
 attempts integer not null default 0,
 lease uuid, attempted_at timestamptz,
 unique(event_id,device_id)
);
alter table public.group_workout_events enable row level security;
alter table public.group_push_jobs enable row level security;
revoke all on public.group_workout_events,public.group_push_jobs from public,anon,authenticated;
create index if not exists group_push_jobs_pending on public.group_push_jobs(state,attempted_at);

create or replace function public.notify_workout_groups(p_workout_id uuid,p_group_ids uuid[])
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=social_require_profile(); w workout_days; gid uuid;
begin
 if p_group_ids is null or cardinality(p_group_ids) not between 1 and 20
   or (select count(distinct id) from unnest(p_group_ids) id)<>cardinality(p_group_ids)
 then raise exception 'Escolha de 1 a 20 grupos diferentes.'; end if;
 select * into w from workout_days where id=p_workout_id and user_id=u;
 if not found then raise exception 'Confirme seu treino online antes de avisar o grupo.'; end if;
 for gid in select id from unnest(p_group_ids) id order by id loop
   perform 1 from streak_groups g join group_members m on m.group_id=g.id
    where g.id=gid and g.status='active' and m.user_id=u and m.status='accepted'
     and (w.confirmed_at at time zone g.time_zone)::date=(now() at time zone g.time_zone)::date
    for share of g;
   if not found then raise exception 'O grupo não está ativo ou o treino não pertence ao dia atual do grupo.'; end if;
   insert into group_workout_events(group_id,workout_id,sender_id) values(gid,w.id,u)
    on conflict(group_id,workout_id) do nothing;
 end loop;
 insert into group_push_jobs(event_id,device_id,recipient_id)
 select e.id,d.id,m.user_id from group_workout_events e
 join group_members m on m.group_id=e.group_id and m.status='accepted' and m.user_id<>u
 join push_devices d on d.user_id=m.user_id and d.enabled
 where e.workout_id=w.id and e.sender_id=u and e.group_id=any(p_group_ids)
  and e.created_at>now()-interval '30 minutes'
 on conflict(event_id,device_id) do nothing;
 return (select jsonb_build_object('queued',count(*) filter(where j.state in ('queued','sending')),
   'already_sent',count(*) filter(where j.state='sent'),'recipients',count(distinct j.recipient_id))
  from group_push_jobs j join group_workout_events e on e.id=j.event_id
  where e.workout_id=w.id and e.sender_id=u and e.group_id=any(p_group_ids));
end $$;

create or replace function public.group_push_job_allowed(p_id uuid,p_lease uuid)
returns boolean language sql security definer set search_path=public,pg_temp as $$
 select exists(select 1 from group_push_jobs j
 join group_workout_events e on e.id=j.event_id
 join streak_groups g on g.id=e.group_id
 join workout_days w on w.id=e.workout_id and w.user_id=e.sender_id
 join push_devices d on d.id=j.device_id and d.user_id=j.recipient_id and d.enabled
 join group_members sender on sender.group_id=g.id and sender.user_id=e.sender_id and sender.status='accepted'
 join group_members recipient on recipient.group_id=g.id and recipient.user_id=j.recipient_id and recipient.status='accepted'
 where j.id=p_id and j.lease=p_lease and j.state='sending' and j.recipient_id<>e.sender_id
  and g.status='active' and e.created_at>now()-interval '30 minutes'
  and (w.confirmed_at at time zone g.time_zone)::date=(now() at time zone g.time_zone)::date);
$$;
create or replace function public.claim_group_push_jobs(p_limit integer default 24,p_sender_id uuid default null)
returns table(job_id uuid,lease_id uuid,endpoint text,p256dh text,auth text,vapid_key text,title text,body text,tag text)
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 delete from group_workout_events where created_at<now()-interval '30 days';
 update group_push_jobs j set state='expired' from group_workout_events e
 where e.id=j.event_id and j.state in ('queued','sending') and e.created_at<=now()-interval '30 minutes';
 return query with candidates as (
  select j.id from group_push_jobs j join group_workout_events e on e.id=j.event_id
  where (p_sender_id is null or e.sender_id=p_sender_id) and j.attempts<3
   and (j.state='queued' or (j.state='sending' and j.attempted_at<now()-interval '5 minutes'))
  order by e.created_at,j.id limit least(greatest(p_limit,1),24) for update of j skip locked
 ), claimed as (
  update group_push_jobs j set state='sending',attempts=j.attempts+1,lease=gen_random_uuid(),attempted_at=now()
  from candidates c where j.id=c.id returning j.*
 ) select j.id,j.lease,d.endpoint,d.p256dh,d.auth,d.vapid_key,
   p.nickname||' acendeu a chama 🔥',g.name||': treino registrado. Bora manter essa chama viva?',
   'fokus-group-'||e.id::text
 from claimed j join group_workout_events e on e.id=j.event_id
 join profiles p on p.id=e.sender_id join streak_groups g on g.id=e.group_id
 join push_devices d on d.id=j.device_id;
end $$;
create or replace function public.finish_group_push_job(p_id uuid,p_lease uuid,p_result text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare device uuid;
begin
 update group_push_jobs set state=case when p_result='sent' then 'sent' when p_result='retry' and attempts<3 then 'queued' else 'expired' end
 where id=p_id and lease=p_lease and state='sending' returning device_id into device;
 if device is not null and p_result='gone' then update push_devices set enabled=false where id=device; end if;
end $$;
revoke all on function public.notify_workout_groups(uuid,uuid[]),public.group_push_job_allowed(uuid,uuid),public.claim_group_push_jobs(integer,uuid),public.finish_group_push_job(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.notify_workout_groups(uuid,uuid[]) to authenticated;
grant execute on function public.group_push_job_allowed(uuid,uuid),public.claim_group_push_jobs(integer,uuid),public.finish_group_push_job(uuid,uuid,text) to service_role;
commit;
select 'Pronto! Avisos opcionais de treino para grupos preparados. Publique também as funções group-notify e push-dispatch.' as resultado;
