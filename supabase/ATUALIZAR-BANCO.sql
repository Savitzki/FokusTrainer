-- ATUALIZAR O FOKUSTRAINER DEPOIS DE CRIAR A TABELA DE PERFIS
-- Copie este arquivo inteiro no Supabase > SQL Editor > New query > Run.
-- Não inclui nem recria a primeira tabela. Preserva os perfis já cadastrados.
-- Cria treinos online, amizades, grupos e a estrutura de dados do push.
-- O envio de push ainda precisa das chaves, da Edge Function e do agendador.
-- Execute uma vez. Arquivo gerado por: node scripts/build-database-update.mjs

begin;

do $fokus_check$
begin
  if to_regclass('public.profiles') is null
     or to_regprocedure('public.fokus_profile_updated_at()') is null then
    raise exception 'Primeiro execute o SQL de perfis do FokusTrainer (202610160001_profiles.sql). Esta atualização não recria a primeira tabela.';
  end if;
  if to_regclass('public.workout_days') is not null
     or to_regclass('public.friendships') is not null
     or to_regclass('public.streak_groups') is not null
     or to_regclass('public.group_members') is not null
     or to_regclass('public.group_days') is not null
     or to_regclass('public.push_devices') is not null
     or to_regclass('public.push_jobs') is not null
     or exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='friend_code') then
    raise exception 'Uma atualização de amigos ou push já existe. Nada foi alterado. Use as migrações individuais que ainda faltam, conforme docs/PUSH-E-GRUPOS.md.';
  end if;
end
$fokus_check$;

-- Origem: 202610160002_social.sql
-- Run after 202610160001_profiles.sql. All writes go through authenticated RPCs.
alter table public.profiles add column friend_code uuid not null default gen_random_uuid() unique;
revoke insert, update on public.profiles from authenticated;
grant insert(id,nickname,avatar_style,avatar_color,avatar_photo), update(id,nickname,avatar_style,avatar_color,avatar_photo) on public.profiles to authenticated;
create table public.workout_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  activity text not null check (length(activity) between 1 and 80),
  minutes integer not null check (minutes between 1 and 1440),
  confirmed_at timestamptz not null default now(),
  unique(user_id, day)
);
create index on public.workout_days(user_id, confirmed_at);
create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester uuid not null references public.profiles(id) on delete cascade,
  recipient uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  check (requester <> recipient)
);
create unique index on public.friendships(least(requester,recipient), greatest(requester,recipient));
create table public.streak_groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 40),
  time_zone text not null,
  status text not null default 'pending' check (status in ('pending','active','archived')),
  started_on date,
  created_at timestamptz not null default now()
);
create table public.group_members (
  group_id uuid not null references public.streak_groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('invited','accepted')),
  primary key(group_id,user_id)
);
create index on public.group_members(user_id);
create table public.group_days (
  group_id uuid not null references public.streak_groups(id) on delete cascade,
  day date not null,
  completed_at timestamptz not null default now(),
  members_count integer not null,
  primary key(group_id,day)
);
alter table public.workout_days enable row level security;
alter table public.friendships enable row level security;
alter table public.streak_groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_days enable row level security;
revoke all on public.workout_days, public.friendships, public.streak_groups, public.group_members, public.group_days from anon, authenticated;

create function public.social_require_profile() returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null or not exists(select 1 from profiles where id=auth.uid()) then
    raise exception 'Entre na conta e salve seu perfil primeiro.';
  end if;
  return auth.uid();
end $$;

-- Private helper: the group row serializes simultaneous confirmations.
create function public.social_refresh_day(p_group uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare g streak_groups; d date; n integer;
begin
  select * into g from streak_groups where id=p_group for update;
  if g.status <> 'active' then return; end if;
  d := (now() at time zone g.time_zone)::date;
  if d < g.started_on then return; end if;
  select count(*) into n from group_members where group_id=g.id;
  if n < 2 or exists (
    select 1 from group_members m where m.group_id=g.id and
    (m.status <> 'accepted' or not exists (
      select 1 from workout_days w where w.user_id=m.user_id
      and (w.confirmed_at at time zone g.time_zone)::date=d
    ))
  ) then return; end if;
  insert into group_days(group_id,day,members_count) values(g.id,d,n) on conflict do nothing;
end $$;

create function public.confirm_daily_workout(p_day date,p_activity text,p_minutes integer,p_timezone text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare u uuid := social_require_profile(); g record;
begin
  if not exists(select 1 from pg_timezone_names where name=p_timezone) then raise exception 'Fuso inválido.'; end if;
  if p_day is distinct from (now() at time zone p_timezone)::date then raise exception 'Só o treino de hoje pode sincronizar.'; end if;
  insert into workout_days(user_id,day,activity,minutes) values(u,p_day,trim(p_activity),p_minutes) on conflict(user_id,day) do nothing;
  for g in select group_id from group_members where user_id=u order by group_id loop
    perform social_refresh_day(g.group_id);
  end loop;
end $$;

create function public.send_friend_request(p_code uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare u uuid := social_require_profile(); target uuid;
begin
  select id into target from profiles where friend_code=p_code;
  if target is null or target=u then raise exception 'Código de amigo inválido.'; end if;
  insert into friendships(requester,recipient) values(u,target)
  on conflict(least(requester,recipient),greatest(requester,recipient)) do update
    set requester=u,recipient=target,status='pending',created_at=now()
    where friendships.status='declined';
end $$;

create function public.reply_friend_request(p_id uuid,p_accept boolean) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare u uuid := social_require_profile();
begin
  update friendships set status=case when p_accept then 'accepted' else 'declined' end
  where id=p_id and recipient=u and status='pending';
  if not found then raise exception 'Convite indisponível.'; end if;
end $$;

create function public.create_streak_group(p_name text,p_friends uuid[],p_timezone text) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare u uuid := social_require_profile(); gid uuid; friend uuid;
begin
  if not exists(select 1 from pg_timezone_names where name=p_timezone) then raise exception 'Fuso inválido.'; end if;
  if coalesce(cardinality(p_friends),0) not between 1 and 7 or
    (select count(distinct x) from unnest(p_friends) x) <> cardinality(p_friends)
  then raise exception 'Escolha de 1 a 7 amigos diferentes.'; end if;
  -- Bound pending invites and active groups per owner.
  if (select count(*) from streak_groups where owner_id=u and status<>'archived') >= 20 then raise exception 'Limite de grupos atingido.'; end if;
  foreach friend in array p_friends loop
    if friend=u or not exists(select 1 from friendships where status='accepted' and
      ((requester=u and recipient=friend) or (requester=friend and recipient=u))) then
      raise exception 'Convide somente amigos que aceitaram seu pedido.';
    end if;
  end loop;
  insert into streak_groups(owner_id,name,time_zone) values(u,trim(p_name),p_timezone) returning id into gid;
  insert into group_members values(gid,u,'accepted');
  insert into group_members select gid,x,'invited' from unnest(p_friends) x;
  return gid;
end $$;

create function public.reply_group_invite(p_id uuid,p_accept boolean) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare u uuid := social_require_profile(); g streak_groups;
begin
  select * into g from streak_groups where id=p_id for update;
  if g.status <> 'pending' or not exists(select 1 from group_members where group_id=p_id and user_id=u and status='invited') then
    raise exception 'Convite indisponível.';
  end if;
  if not p_accept then update streak_groups set status='archived' where id=p_id; return; end if;
  update group_members set status='accepted' where group_id=p_id and user_id=u;
  if not exists(select 1 from group_members where group_id=p_id and status='invited') then
    update streak_groups set status='active',started_on=(now() at time zone g.time_zone)::date where id=p_id;
    perform social_refresh_day(p_id);
  end if;
end $$;

create function public.social_streak(p_group uuid,p_today date,p_best boolean default false) returns integer
language sql stable security definer set search_path = public, pg_temp as $$
  with numbered as (
    select day,day-(row_number() over(order by day))::integer as island
    from group_days where group_id=p_group and day<=p_today
  ), runs as (select count(*)::integer n,max(day) last_day from numbered group by island)
  select coalesce(max(n),0) from runs where p_best or last_day>=p_today-1;
$$;

create function public.close_streak_group(p_id uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  update streak_groups set status='archived' where id=p_id and exists(select 1 from group_members where group_id=p_id and user_id=auth.uid());
  if not found then raise exception 'Grupo indisponível.'; end if;
end $$;
revoke all on function public.close_streak_group(uuid) from public,anon,authenticated;
grant execute on function public.close_streak_group(uuid) to authenticated;

create function public.social_profile_deleted() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  update streak_groups set status='archived' where id in(select group_id from group_members where user_id=old.id);
  return old;
end $$;
revoke all on function public.social_profile_deleted() from public,anon,authenticated;
create trigger social_profile_deleted before delete on public.profiles for each row execute function public.social_profile_deleted();

create function public.get_social_state() returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare u uuid := social_require_profile(); result jsonb;
begin
  select jsonb_build_object(
    'code',(select friend_code from profiles where id=u),
    'workouts',coalesce((select jsonb_agg(jsonb_build_object('id',id,'date',day,'activity',activity,'minutes',minutes) order by day) from workout_days where user_id=u),'[]'::jsonb),
    'friends',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'nickname',p.nickname)) from friendships f join profiles p on p.id=case when f.requester=u then f.recipient else f.requester end where (f.requester=u or f.recipient=u) and f.status='accepted'),'[]'::jsonb),
    'requests',coalesce((select jsonb_agg(jsonb_build_object('id',f.id,'nickname',p.nickname,'incoming',f.recipient=u)) from friendships f join profiles p on p.id=case when f.requester=u then f.recipient else f.requester end where (f.requester=u or f.recipient=u) and f.status='pending'),'[]'::jsonb),
    'groups',coalesce((select jsonb_agg(jsonb_build_object(
      'id',g.id,'name',g.name,'timezone',g.time_zone,'status',g.status,
      'invited',me.status='invited','today',(now() at time zone g.time_zone)::date,
      'streak',social_streak(g.id,(now() at time zone g.time_zone)::date),
      'best',social_streak(g.id,(now() at time zone g.time_zone)::date,true),
      'completed',exists(select 1 from group_days d where d.group_id=g.id and d.day=(now() at time zone g.time_zone)::date),
      'members',(select jsonb_agg(jsonb_build_object('id',p.id,'nickname',p.nickname,'accepted',m.status='accepted','trained',exists(select 1 from workout_days w where w.user_id=m.user_id and (w.confirmed_at at time zone g.time_zone)::date=(now() at time zone g.time_zone)::date))) from group_members m join profiles p on p.id=m.user_id where m.group_id=g.id)
    ) order by g.created_at desc) from streak_groups g join group_members me on me.group_id=g.id and me.user_id=u where g.status<>'archived'),'[]'::jsonb)
  ) into result;
  return result;
end $$;

revoke all on function public.social_require_profile(), public.social_refresh_day(uuid), public.social_streak(uuid,date,boolean), public.confirm_daily_workout(date,text,integer,text), public.send_friend_request(uuid), public.reply_friend_request(uuid,boolean), public.create_streak_group(text,uuid[],text), public.reply_group_invite(uuid,boolean), public.get_social_state() from public,anon,authenticated;
grant execute on function public.confirm_daily_workout(date,text,integer,text), public.send_friend_request(uuid), public.reply_friend_request(uuid,boolean), public.create_streak_group(text,uuid[],text), public.reply_group_invite(uuid,boolean), public.get_social_state() to authenticated;

-- Origem: 202610160003_push.sql
-- Web Push devices and a durable, bounded delivery queue. No browser table access.
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

select 'Pronto! Banco atualizado para treinos, amigos e grupos. O push ainda precisa ativar o serviço de envio.' as resultado;
