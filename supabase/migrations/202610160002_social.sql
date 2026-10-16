-- Run after 202610160001_profiles.sql. All writes go through authenticated RPCs.
begin;
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
commit;
