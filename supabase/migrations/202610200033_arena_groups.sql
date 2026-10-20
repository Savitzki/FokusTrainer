-- Arena phase 1. Prepared only; requires explicit production authorization.
begin;
set local lock_timeout='5s';set local statement_timeout='60s';
alter table streak_groups add column original_owner_id uuid;
update streak_groups set original_owner_id=owner_id;
alter table streak_groups alter column original_owner_id set not null;
create function arena_group_creator() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin new.original_owner_id:=new.owner_id;return new;end $$;
create trigger arena_group_creator before insert on streak_groups for each row execute function arena_group_creator();
alter function create_streak_group(text,uuid[],text) rename to arena_base_create_streak_group;
create function create_streak_group(p_name text,p_friends uuid[],p_timezone text) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
begin perform pg_advisory_xact_lock(607173021);perform 1 from profiles where id=social_require_profile() for update;return arena_base_create_streak_group(p_name,p_friends,p_timezone);end $$;
alter table gf_challenges add column cancel_reason text;
alter table gf_challenge_members add column withdrawn_at timestamptz;
alter table gf_challenge_members drop constraint gf_challenge_members_status_check;
alter table gf_challenge_members add constraint gf_challenge_members_status_check check(status in('invited','accepted','declined','withdrawn'));
create index arena_membership_history on gf_badge_memberships(group_id,accepted_at,left_at);
create table arena_group_cycles(
 group_id uuid not null references streak_groups(id) on delete cascade, week_start date not null,
 starts_on date not null, timezone text not null, opened_at timestamptz not null,
 target integer not null check(target>=0), participants jsonb not null,
 closed_at timestamptz, final_count integer, primary key(group_id,week_start),
 check(extract(isodow from week_start)=1 and starts_on between week_start and week_start+6)
);
create table arena_group_receipts(
 user_id uuid not null references profiles(id) on delete cascade, request_id uuid not null,
 payload jsonb not null, created_at timestamptz not null default clock_timestamp(),primary key(user_id,request_id)
);
-- Explicit cutoff excludes later first plans too (the legacy schedule helper has
-- a starts_immediately compatibility exception unsuitable for frozen targets).
create function arena_planned_days(p_user uuid,p_from date,p_to date,p_cutoff timestamptz) returns date[]
language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce(array_agg(d::date order by d),'{}'::date[]) from generate_series(p_from::timestamp,p_to::timestamp,interval '1 day') d
 where case
 when exists(select 1 from training_reschedules where user_id=p_user and original_day=d::date and created_at<=p_cutoff) then false
 when exists(select 1 from training_reschedules where user_id=p_user and target_day=d::date and created_at<=p_cutoff) then true
 else extract(isodow from d)::integer=any(coalesce((select training_days from training_plans where user_id=p_user and effective_on<=d::date and created_at<=p_cutoff order by effective_on desc,revision desc limit 1),'{}'::integer[])) end
 and not exists(select 1 from training_extra_rests where user_id=p_user and day=d::date and authorized_at<=p_cutoff)
 and not exists(select 1 from medical_kits where user_id=p_user and used_on=d::date and used_at<=p_cutoff);
$$;
create function arena_sync_group_cycle(p_group uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare g streak_groups; current_week date; cycle_week date; start_day date; cutoff timestamptz; people jsonb; goal integer; previous arena_group_cycles; participant uuid; blocked boolean;
begin
 select * into strict g from streak_groups where id=p_group for update;
 if g.status<>'active' then return;end if;
 current_week:=date_trunc('week',clock_timestamp() at time zone g.time_zone)::date;
 select max(week_start)+7 into cycle_week from arena_group_cycles where group_id=p_group;
 cycle_week:=coalesce(cycle_week,current_week);
 while cycle_week<=current_week loop
  if not exists(select 1 from arena_group_cycles where group_id=p_group and week_start=cycle_week) then
   start_day:=greatest(cycle_week,g.started_on);
   cutoff:=case when exists(select 1 from arena_group_cycles where group_id=p_group) then start_day::timestamp at time zone g.time_zone else clock_timestamp() end;
   -- Migration/opening in a partial week never fabricates earlier activity.
   if not exists(select 1 from arena_group_cycles where group_id=p_group) then start_day:=greatest(start_day,(cutoff at time zone g.time_zone)::date);end if;
   select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'nickname',p.nickname,'timezone',coalesce(a.time_zone,g.time_zone),
    'days',arena_planned_days(p.id,start_day,cycle_week+6,cutoff)) order by p.id),'[]') into people
   from profiles p left join training_accounts a on a.user_id=p.id
   where exists(select 1 from gf_badge_memberships e where e.group_id=p_group and e.user_id=p.id and e.accepted_at<=cutoff and (e.left_at is null or e.left_at>cutoff));
   select ceil(.8*coalesce(sum(jsonb_array_length(x->'days')),0))::integer into goal from jsonb_array_elements(people) x;
   insert into arena_group_cycles values(p_group,cycle_week,start_day,g.time_zone,cutoff,goal,people,null,null);
  end if;
  cycle_week:=cycle_week+7;
 end loop;
 for previous in select * from arena_group_cycles where group_id=p_group and closed_at is null and week_start<current_week loop
  -- A confirmation may hold its account while waiting for the group lock.
  -- Never wait in the inverse order: defer closure when any account is busy.
  blocked:=false;
  for participant in select (x->>'id')::uuid from jsonb_array_elements(previous.participants)x order by x->>'id' loop
   perform 1 from training_accounts where user_id=participant for update skip locked;
   if not found and exists(select 1 from training_accounts where user_id=participant) then blocked:=true;exit;end if;
  end loop;
  if blocked then continue;end if;
  update arena_group_cycles set closed_at=(previous.week_start+7)::timestamp at time zone previous.timezone,
   final_count=(select count(distinct (w.user_id,w.day)) from workout_days w where exists(select 1 from jsonb_array_elements(previous.participants) p where (p->>'id')::uuid=w.user_id)
    and w.confirmed_at>=previous.opened_at and w.confirmed_at<(previous.week_start+7)::timestamp at time zone previous.timezone)
  where group_id=p_group and week_start=previous.week_start;
 end loop;
end $$;
create function arena_group_goals(p_group uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 perform arena_sync_group_cycle(p_group);
 select coalesce(jsonb_agg(v order by week_start desc),'[]') into result from (
 select c.week_start,jsonb_build_object('weekStart',c.week_start,'startsOn',c.starts_on,'target',c.target,
 'completed',coalesce(c.final_count,(select count(distinct(w.user_id,w.day)) from workout_days w where exists(select 1 from jsonb_array_elements(c.participants) p where (p->>'id')::uuid=w.user_id) and w.confirmed_at>=c.opened_at and w.confirmed_at<least(clock_timestamp(),(c.week_start+7)::timestamp at time zone c.timezone))),
 'closed',c.closed_at is not null,'timezone',c.timezone) v
 from arena_group_cycles c where group_id=p_group order by week_start desc limit 9) rows;
 return result;
end $$;
-- Freeze today's old membership before changing it; never retry a historical
-- day using a different member set if closure is busy on another device.
create function arena_prepare_membership_change(p_group uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare g streak_groups;
begin
 perform social_refresh_day(p_group);
 select * into strict g from streak_groups where id=p_group for update;
 if g.status='active' and coalesce(g.training_checked_through,g.started_on-1)<(now() at time zone g.time_zone)::date-1 then
  raise exception using errcode='40001',message='O grupo está sincronizando. Atualize e tente novamente.';
 end if;
 perform arena_sync_group_cycle(p_group);
end $$;
create function arena_group_command(p_id uuid,p_action text,p_target uuid,p_name text,p_request uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=social_require_profile(); g streak_groups; value jsonb:=jsonb_build_array(p_id,p_action,p_target,p_name); old_value jsonb;
begin
 perform pg_advisory_xact_lock(607173021);
 if p_request is null then raise exception 'Identificação da operação obrigatória.';end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text||p_request::text,33));
 select payload into old_value from arena_group_receipts where user_id=u and request_id=p_request;
 if found then if old_value<>value then raise exception 'Identificação já utilizada.';end if;return;end if;
 if not exists(select 1 from group_members where group_id=p_id and user_id=u and status='accepted') then raise exception 'Grupo indisponível.';end if;
 perform arena_prepare_membership_change(p_id);
 select * into strict g from streak_groups where id=p_id for update;
 if g.status='archived' then raise exception 'Este grupo foi encerrado.';end if;
 if not exists(select 1 from group_members where group_id=p_id and user_id=u and status='accepted') then raise exception 'Grupo indisponível.';end if;
 if p_action in('rename','remove','transfer','close') and g.owner_id<>u then raise exception 'Somente o administrador pode fazer isso.';end if;
 if p_action='rename' then
  if p_name is null or length(trim(p_name)) not between 1 and 40 then raise exception 'Escolha um nome de até 40 caracteres.';end if;
  update streak_groups set name=trim(p_name) where id=p_id;
 elsif p_action='invite' then
  if p_target is null or p_target=u or not exists(select 1 from friendships where status='accepted' and least(requester,recipient)=least(u,p_target) and greatest(requester,recipient)=greatest(u,p_target)) then raise exception 'Convide apenas amigos aceitos.';end if;
  if not exists(select 1 from group_members where group_id=p_id and user_id=p_target) then
   if (select count(*) from group_members where group_id=p_id)>=8 then raise exception 'O grupo já tem oito participantes ou convites.';end if;
   insert into group_members values(p_id,p_target,'invited');
  end if;
 elsif p_action='remove' then
  if p_target=g.owner_id or p_target=u then raise exception 'Use a saída ou transfira a administração.';end if;
  delete from group_members where group_id=p_id and user_id=p_target;
 elsif p_action='transfer' then
  if p_target is null or p_target=u or not exists(select 1 from group_members where group_id=p_id and user_id=p_target and status='accepted') then raise exception 'Escolha um integrante aceito.';end if;
  if (select count(*) from streak_groups where owner_id=p_target and status<>'archived')>=20 then raise exception 'O novo administrador atingiu o limite de grupos.';end if;
  update streak_groups set owner_id=p_target where id=p_id;
 elsif p_action='leave' then
  if g.owner_id=u then raise exception 'Transfira a administração ou encerre se for o último integrante.';end if;
  delete from group_members where group_id=p_id and user_id=u;
 elsif p_action='close' then
  update streak_groups set status='archived' where id=p_id;
  delete from group_members where group_id=p_id and status='invited';
  -- Close the partial goal at the actual end; no later activity is added.
  update arena_group_cycles c set final_count=(select count(distinct(w.user_id,w.day)) from workout_days w where exists(select 1 from jsonb_array_elements(c.participants) p where (p->>'id')::uuid=w.user_id) and w.confirmed_at>=c.opened_at and w.confirmed_at<clock_timestamp()),closed_at=clock_timestamp() where group_id=p_id and closed_at is null;
 else raise exception 'Ação inválida.';end if;
 insert into arena_group_receipts(user_id,request_id,payload) values(u,p_request,value);
end $$;
-- Keep the old endpoint secure even for cached clients.
create or replace function close_streak_group(p_id uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin perform arena_group_command(p_id,'close',null,null,gen_random_uuid());end $$;
create or replace function reply_group_invite(p_id uuid,p_accept boolean) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=social_require_profile();g streak_groups;
begin
 perform pg_advisory_xact_lock(607173021);
 if p_accept is null then raise exception 'Responda ao convite.';end if;
 if not exists(select 1 from group_members where group_id=p_id and user_id=u and status='invited') then raise exception 'Convite indisponível.';end if;
 perform arena_prepare_membership_change(p_id);
 select * into strict g from streak_groups where id=p_id for update;
 if g.status='archived' or not exists(select 1 from group_members where group_id=p_id and user_id=u and status='invited') then raise exception 'Convite indisponível.';end if;
 if not p_accept then delete from group_members where group_id=p_id and user_id=u;
 else update group_members set status='accepted' where group_id=p_id and user_id=u;end if;
 if g.status='pending' and not exists(select 1 from group_members where group_id=p_id and status='invited') and (select count(*) from group_members where group_id=p_id and status='accepted')>=2 then
  update streak_groups set status='active',started_on=(now() at time zone g.time_zone)::date where id=p_id;
  perform arena_sync_group_cycle(p_id);
 end if;
end $$;
create function remove_friend(p_user uuid,p_request uuid default gen_random_uuid()) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=social_require_profile(); c gf_challenges; n integer; person uuid;finish_at timestamptz;payload jsonb:=jsonb_build_array('remove-friend',p_user);old_value jsonb;
begin
 perform pg_advisory_xact_lock(607173021);
 if p_user is null or p_user=u then raise exception 'Amizade inválida.';end if;
 if p_request is null then raise exception 'Identificação da operação obrigatória.';end if;
 select r.payload into old_value from arena_group_receipts r where user_id=u and request_id=p_request;
 if found then if old_value<>payload then raise exception 'Identificação já utilizada.';end if;return;end if;

 -- Same lane/account/challenge order as the canonical challenge read.
 for person in select distinct m.user_id from gf_challenge_members m join gf_challenges x on x.id=m.challenge_id
  where x.settled_at is null and m.status='accepted' and m.user_id is not null
  and exists(select 1 from gf_challenge_members where challenge_id=x.id and user_id=u and status in('accepted','invited'))
  and exists(select 1 from gf_challenge_members where challenge_id=x.id and user_id=p_user and status in('accepted','invited')) order by m.user_id
 loop perform 1 from training_accounts where user_id=person for update;end loop;
 for c in select * from gf_challenges where settled_at is null and exists(select 1 from gf_challenge_members where challenge_id=gf_challenges.id and user_id=u and status in('accepted','invited')) and exists(select 1 from gf_challenge_members where challenge_id=gf_challenges.id and user_id=p_user and status in('accepted','invited')) order by id for update loop
  perform gf_settle_challenge(c.id);
  select * into strict c from gf_challenges where id=c.id;
  if c.settled_at is not null then continue;end if;
  select max((c.ends_on+1)::timestamp at time zone timezone) into finish_at from gf_challenge_members where challenge_id=c.id and status='accepted' and user_id is not null;
  if clock_timestamp()>=finish_at then raise exception using errcode='40001',message='O desafio está encerrando. Atualize e tente novamente.';end if;
  select count(*) into n from gf_challenge_members where challenge_id=c.id and status in('accepted','invited') and user_id is not null;
  if n<=2 then update gf_challenges set cancelled=true,settled_at=clock_timestamp(),results='[]',cancel_reason='friendship-ended' where id=c.id;
  else update gf_challenge_members set status='withdrawn',withdrawn_at=clock_timestamp() where challenge_id=c.id and user_id=u;
   if c.owner_id=u then update gf_challenge_members set status='declined' where challenge_id=c.id and user_id=p_user and status='invited';end if;
   if (select count(*) from gf_challenge_members where challenge_id=c.id and status in('accepted','invited') and user_id is not null)<2 then update gf_challenges set cancelled=true,settled_at=clock_timestamp(),results='[]',cancel_reason='insufficient-participants' where id=c.id;end if;
  end if;
 end loop;
 update friendships set status='declined' where least(requester,recipient)=least(u,p_user) and greatest(requester,recipient)=greatest(u,p_user);
 insert into arena_group_receipts(user_id,request_id,payload) values(u,p_request,payload);
end $$;
-- Invites/acceptance and removal share the existing settlement lane.
alter function send_friend_request(uuid) rename to arena_base_send_friend_request;
create function send_friend_request(p_code uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin perform pg_advisory_xact_lock(607173021);perform arena_base_send_friend_request(p_code);end $$;
alter function reply_friend_request(uuid,boolean) rename to arena_base_reply_friend_request;
create function reply_friend_request(p_id uuid,p_accept boolean) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin perform pg_advisory_xact_lock(607173021);perform arena_base_reply_friend_request(p_id,p_accept);end $$;
alter function reply_challenge_invite(uuid,boolean,text) rename to arena_base_reply_challenge_invite;
create function reply_challenge_invite(p_id uuid,p_accept boolean,p_timezone text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=social_require_profile(); owner uuid;
begin
 perform pg_advisory_xact_lock(607173021);
 select owner_id into strict owner from gf_challenges where id=p_id;
 if p_accept and not exists(select 1 from friendships where status='accepted' and least(requester,recipient)=least(u,owner) and greatest(requester,recipient)=greatest(u,owner)) then raise exception 'A amizade precisa estar aceita.';end if;
 perform arena_base_reply_challenge_invite(p_id,p_accept,p_timezone);
end $$;
alter function get_social_state() rename to arena_base_social_state;
create function get_social_state() returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare payload jsonb; groups_value jsonb:='[]';item jsonb;g streak_groups;
begin
 payload:=arena_base_social_state();
 for item in select value from jsonb_array_elements(payload->'groups') loop
  select * into strict g from streak_groups where id=(item->>'id')::uuid;
  groups_value:=groups_value||jsonb_build_array(item||jsonb_build_object('adminId',g.owner_id,'goals',case when not (item->>'invited')::boolean then arena_group_goals(g.id) else '[]'::jsonb end));
 end loop;
 return payload||jsonb_build_object('arenaVersion',1,'groups',groups_value);
end $$;
create or replace function public.social_refresh_day(p_group uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare g streak_groups; d date; today_value date; n integer; complete boolean; scored boolean; participant record;
begin
 for participant in select user_id from group_members where group_id=p_group and status='accepted' order by user_id loop
  if not medical_auto_close_account(participant.user_id) then return;end if;
 end loop;
 select * into g from streak_groups where id=p_group for update;
 if not found or g.status<>'active' or g.started_on is null then return;end if;
 today_value:=(now() at time zone g.time_zone)::date;
 d:=coalesce(g.training_checked_through+1,g.started_on);
 while d<=today_value loop
  if not exists(select 1 from group_days where group_id=g.id and day=d) then
   select count(*),bool_and(m.status='accepted' and m.kind<>'unplanned' and (m.kind<>'training' or m.trained)),bool_or(m.kind='training')
    into n,complete,scored from (
     select gm.status,training_day_kind(gm.user_id,d,d::timestamp at time zone g.time_zone,(d+1)::timestamp at time zone g.time_zone) kind,
      exists(select 1 from workout_days w where w.user_id=gm.user_id and (w.confirmed_at at time zone g.time_zone)::date=d) trained
     from group_members gm where gm.group_id=g.id and gm.status='accepted'
    ) m;
   if n>=2 and complete then
    insert into group_days(group_id,day,members_count,counts_for_streak) values(g.id,d,n,scored) on conflict do nothing;
   end if;
  end if;
  d:=d+1;
 end loop;
 update streak_groups set training_checked_through=today_value-1 where id=g.id;
end $$;

-- Seed only current active cycles at deployment, never historical goals.
do $$ declare g record;begin for g in select id from streak_groups where status='active' order by id loop perform arena_sync_group_cycle(g.id);end loop;end $$;
alter table arena_group_cycles enable row level security;alter table arena_group_receipts enable row level security;
revoke all on arena_group_cycles,arena_group_receipts from public,anon,authenticated;
do $$ declare f regprocedure;begin for f in select oid::regprocedure from pg_proc where pronamespace='public'::regnamespace and (proname like 'arena_%' or proname in('get_social_state','send_friend_request','reply_friend_request','reply_group_invite','remove_friend','create_streak_group')) loop execute format('revoke all on function %s from public,anon,authenticated',f);end loop;end $$;
grant execute on function create_streak_group(text,uuid[],text),get_social_state(),send_friend_request(uuid),reply_friend_request(uuid,boolean),reply_group_invite(uuid,boolean),remove_friend(uuid,uuid),arena_group_command(uuid,text,uuid,text,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
