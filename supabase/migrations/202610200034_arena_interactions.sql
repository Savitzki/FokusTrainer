-- Arena phase 2. Prepared only. No production deploy, cron or new payments.
begin;
set local lock_timeout='5s';set local statement_timeout='60s';
alter table gf_challenges add column rule_version integer not null default 1 check(rule_version in(1,2));
alter table gf_challenges add column rematch_of uuid references gf_challenges(id);
alter table gf_challenges add column invitation_key text;
alter table gf_challenges drop constraint gf_challenges_check;
alter table gf_challenges add constraint gf_challenge_duration check((rule_version=1 and ends_on-starts_on in(6,29)) or(rule_version=2 and ends_on-starts_on in(6,13,27)));
alter table gf_challenges add constraint gf_challenge_no_new_rewards check(rule_version=1 or rewards='{"participation":0,"winner":0}'::jsonb);
create unique index arena_challenge_invitation on gf_challenges(invitation_key) where settled_at is null;
alter table gf_challenge_members add column planned_days date[];
alter table arena_group_receipts add column result_id uuid;
create function create_arena_challenge(p_request uuid,p_name text,p_kind text,p_duration integer,p_friends uuid[],p_target integer,p_timezone text,p_recording_policy text,p_rematch uuid default null) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=social_require_profile(); a training_accounts; first_day date;last_day date; cutoff timestamptz;deadline timestamptz; loop_user uuid; days date[]; total integer:=0; id_value uuid; signature text; payload jsonb; previous arena_group_receipts; original gf_challenges;
begin
 perform pg_advisory_xact_lock(607173021);
 payload:=jsonb_build_array(p_name,p_kind,p_duration,p_friends,p_target,p_timezone,p_recording_policy,p_rematch);
 if p_request is null then raise exception 'Identificação da operação obrigatória.';end if;
 select * into previous from arena_group_receipts where user_id=u and request_id=p_request;
 if found then if previous.payload<>payload then raise exception 'Identificação já utilizada.';end if;return previous.result_id;end if;
 if p_name is null or length(trim(p_name)) not between 1 and 40 or p_kind is null or p_kind not in('consistency','collective','frequency') or p_duration is null or p_duration not in(7,14,28) or p_recording_policy is null or p_recording_policy not in('any','timed')
 or p_friends is null or cardinality(p_friends) not between 1 and 7 or cardinality(p_friends)<>(select count(distinct x) from unnest(p_friends)x) or u=any(p_friends) then raise exception 'Escolha modalidade, 7/14/28 dias e de 1 a 7 amigos.';end if;
 if exists(select 1 from unnest(p_friends) person where not exists(select 1 from friendships where status='accepted' and least(requester,recipient)=least(u,person) and greatest(requester,recipient)=greatest(u,person))) then raise exception 'Convide apenas amizades aceitas.';end if;
 if p_rematch is not null then
  select * into strict original from gf_challenges where id=p_rematch;
  if original.settled_at is null or original.cancelled or cardinality(p_friends)<>1 or (select count(*) from gf_challenge_members where challenge_id=p_rematch and status='accepted')<>2
   or not exists(select 1 from gf_challenge_members where challenge_id=p_rematch and user_id=u and status='accepted')
   or not exists(select 1 from gf_challenge_members where challenge_id=p_rematch and user_id=p_friends[1] and status='accepted') then raise exception 'Esta revanche não está disponível.';end if;
 end if;
 perform get_training_state(p_timezone);
 select * into strict a from training_accounts where user_id=u for update;
 cutoff:=clock_timestamp();
 select max((cutoff at time zone coalesce(time_zone,'Pacific/Kiritimati'))::date+1) into first_day from unnest(p_friends||array[u]) who left join training_accounts on user_id=who;
 last_day:=first_day+p_duration-1;
 select min(first_day::timestamp at time zone coalesce(time_zone,'Pacific/Kiritimati')) into deadline from unnest(p_friends||array[u]) who left join training_accounts on user_id=who;
 signature:=md5(jsonb_build_array(u,trim(p_name),p_kind,p_duration,array(select x from unnest(p_friends)x order by x),p_target,p_recording_policy,p_rematch,first_day)::text);
 select id into id_value from gf_challenges where invitation_key=signature and settled_at is null;
 if id_value is null then
  if (select count(*) from gf_challenges where owner_id=u and settled_at is null)>=3 then raise exception 'Limite de três desafios abertos atingido.';end if;
  if exists(select 1 from unnest(p_friends||array[u]) person where (select count(*) from gf_challenge_members m join gf_challenges c on c.id=m.challenge_id where user_id=person and status in('accepted','invited') and settled_at is null)>=10) then raise exception 'Um participante já tem dez desafios abertos.';end if;
  foreach loop_user in array p_friends||array[u] loop total:=total+cardinality(arena_planned_days(loop_user,first_day,last_day,cutoff));end loop;
  days:=arena_planned_days(u,first_day,last_day,cutoff);
  if cardinality(days)<1 or (p_kind='collective' and (p_target is null or p_target<1 or p_target>total)) then raise exception 'A meta deve caber nos planos dos participantes.';end if;
  insert into gf_challenges(owner_id,name,kind,starts_on,ends_on,invite_until,target,rewards,recording_policy,rule_version,rematch_of,invitation_key)
   values(u,trim(p_name),p_kind,first_day,last_day,deadline,case when p_kind='collective' then p_target else cardinality(days) end,'{"participation":0,"winner":0}',p_recording_policy,2,p_rematch,signature) returning id into id_value;
  insert into gf_challenge_members(challenge_id,user_id,nickname,status,timezone,quota,accepted_at,planned_days)
   select id_value,u,nickname,'accepted',a.time_zone,cardinality(days),cutoff,days from profiles where id=u;
  insert into gf_challenge_members(challenge_id,user_id,nickname,status) select id_value,id,nickname,'invited' from profiles where id=any(p_friends);
 end if;
 insert into arena_group_receipts(user_id,request_id,payload,result_id) values(u,p_request,payload,id_value);
 return id_value;
end $$;
-- Cached clients can no longer create new rewarding or 30-day challenges.
create or replace function create_friend_challenge(p_name text,p_kind text,p_duration integer,p_friends uuid[],p_target integer,p_timezone text) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
begin return create_arena_challenge(gen_random_uuid(),p_name,p_kind,p_duration,p_friends,p_target,p_timezone,'any',null);end $$;
alter function reply_challenge_invite(uuid,boolean,text) rename to arena_v1_reply_challenge_invite;
create function reply_challenge_invite(p_id uuid,p_accept boolean,p_timezone text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=social_require_profile();c gf_challenges;tz text; days date[];
begin
 perform pg_advisory_xact_lock(607173021);
 select * into strict c from gf_challenges where id=p_id;
 if c.rule_version=1 then perform arena_v1_reply_challenge_invite(p_id,p_accept,p_timezone);return;end if;
 if p_accept is null or c.settled_at is not null or clock_timestamp()>=c.invite_until then raise exception 'O prazo deste convite terminou.';end if;
 if not exists(select 1 from gf_challenge_members where challenge_id=p_id and user_id=u and status in('invited','accepted')) then raise exception 'Convite indisponível.';end if;
 if p_accept and not exists(select 1 from friendships where status='accepted' and least(requester,recipient)=least(u,c.owner_id) and greatest(requester,recipient)=greatest(u,c.owner_id)) then raise exception 'A amizade precisa estar aceita.';end if;
 if exists(select 1 from gf_challenge_members where challenge_id=p_id and user_id=u and status='accepted') then return;end if;
 perform get_training_state(p_timezone);
 select time_zone into strict tz from training_accounts where user_id=u for update;
 days:=arena_planned_days(u,c.starts_on,c.ends_on,clock_timestamp());
 if p_accept and cardinality(days)<1 then raise exception 'Configure seu plano antes de aceitar.';end if;
 update gf_challenge_members set status=case when p_accept then 'accepted' else 'declined' end,timezone=tz,quota=cardinality(days),planned_days=days,accepted_at=case when p_accept then clock_timestamp() end where challenge_id=p_id and user_id=u;
end $$;
alter function gf_challenge_metric(uuid,uuid) rename to arena_v1_challenge_metric;
create function gf_challenge_metric(p_challenge uuid,p_user uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare c gf_challenges;m gf_challenge_members;done integer;planned integer;today_value date;
begin
 select * into strict c from gf_challenges where id=p_challenge;
 if c.rule_version=1 or c.kind='collective' then return arena_v1_challenge_metric(p_challenge,p_user);end if;
 select * into strict m from gf_challenge_members where challenge_id=p_challenge and user_id=p_user and status='accepted';
 if not medical_auto_close_account(p_user) then raise exception using errcode='40001',message='O fechamento do dia está em andamento. Atualize novamente.';end if;
 today_value:=(clock_timestamp() at time zone m.timezone)::date;
 if c.kind='consistency' then
  -- Freeze the plan, follow valid swaps and neutralize authorized protections.
  -- Later permanent plans cannot reduce the accepted reference.
  with effective as(select distinct coalesce(r.target_day,x) as day from unnest(m.planned_days)x
   left join training_reschedules r on r.user_id=p_user and r.original_day=x and r.created_at<(c.ends_on+1)::timestamp at time zone m.timezone),
  eligible as(select day from effective e where day between c.starts_on and c.ends_on
   and not exists(select 1 from training_extra_rests where user_id=p_user and training_extra_rests.day=e.day and authorized_at<(e.day+1)::timestamp at time zone m.timezone)
   and not exists(select 1 from medical_kits where user_id=p_user and used_on=e.day and ((not automatic and used_at<(e.day+1)::timestamp at time zone m.timezone) or (automatic and day_closed_at<=(e.day+1)::timestamp at time zone m.timezone))))
  select count(*),count(*) filter(where exists(select 1 from workout_days w where w.user_id=p_user and w.day=e.day and w.confirmed_at>=c.starts_on::timestamp at time zone m.timezone and w.confirmed_at<(e.day+1)::timestamp at time zone m.timezone and w.confirmed_at<=clock_timestamp() and (c.recording_policy='any' or w.recording_method='timed'))) into planned,done from eligible e;
 else
  planned:=coalesce(m.quota,0);
  select count(distinct day) into done from workout_days where user_id=p_user and day between c.starts_on and least(c.ends_on,today_value) and confirmed_at>=c.starts_on::timestamp at time zone m.timezone and confirmed_at<(c.ends_on+1)::timestamp at time zone m.timezone and confirmed_at<=clock_timestamp() and (c.recording_policy='any' or recording_method='timed');
 end if;
 return jsonb_build_object('completed',done,'planned',planned,'percent',case when c.kind='consistency' then round(100.0*done/nullif(planned,0),1) else null end);
end $$;
create or replace function public.gf_challenge_board(p_challenge uuid) returns jsonb
language sql security definer set search_path=public,pg_temp as $$
 with metrics as (select m.user_id,m.nickname,case when m.user_id is null then '{"completed":0,"planned":0,"percent":null}'::jsonb
  else gf_challenge_metric(p_challenge,m.user_id) end value from gf_challenge_members m where m.challenge_id=p_challenge and m.status='accepted'),
 scores as (select *,case when c.kind='consistency' then (value->>'completed')::numeric/nullif((value->>'planned')::integer,0)
  else (value->>'completed')::numeric end score from metrics cross join gf_challenges c where c.id=p_challenge),
 ranked as (select *,rank() over(order by score desc nulls last) place from scores)
 select coalesce(jsonb_agg(jsonb_build_object('id',user_id,'nickname',nickname,'completed',(value->>'completed')::integer,
  'planned',(value->>'planned')::integer,'percent',value->'percent','place',case when kind='collective' and rule_version=2 then null when score is not null and (value->>'completed')::integer>0 then place end)
  order by place,nickname),'[]') from ranked;
$$;
create function public.arena_v1_settle_challenge(p_id uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare c gf_challenges; board jsonb; finish_at timestamptz; n integer; item jsonb; r gf_rules; amount integer; d date; success boolean;
begin
 -- One settlement lane avoids cross-challenge wallet lock cycles. No account locks acquired here.
 perform pg_advisory_xact_lock(607173021);
 select * into strict c from gf_challenges where id=p_id for update;
 if c.settled_at is not null then return; end if;
 select count(*),max((c.ends_on+1)::timestamp at time zone timezone) into n,finish_at
 from gf_challenge_members where challenge_id=p_id and status='accepted' and user_id is not null;
 if now()<c.invite_until then return; end if;
 if n<2 or (c.kind='collective' and c.target>(select sum(quota) from gf_challenge_members where challenge_id=p_id and status='accepted' and user_id is not null)) then update gf_challenges set settled_at=clock_timestamp(),cancelled=true,results='[]' where id=p_id; return; end if;
 if now()<finish_at then return; end if;
 board:=gf_challenge_board(p_id);
 success:=c.kind='collective' and (select sum((x->>'completed')::integer) from jsonb_array_elements(board) x)>=c.target;
 select * into strict r from gf_rules where singleton;
 for item in select x from jsonb_array_elements(board) x where x->>'id' is not null order by x->>'id' loop
  if (item->>'completed')::integer<1 then continue; end if;
  select (now() at time zone time_zone)::date into d from training_accounts where user_id=(item->>'id')::uuid;
  if (select count(*) from coin_movements where user_id=(item->>'id')::uuid and kind='challenge'
    and activity_day>=date_trunc('month',d)::date and activity_day<(date_trunc('month',d)+interval '1 month')::date)>=r.rewarded_challenges_per_month then continue; end if;
  amount:=(c.rewards->>'participation')::integer + case when success or (c.kind<>'collective' and (item->>'place')::integer=1)
   then (c.rewards->>'winner')::integer else 0 end;
  perform economy_post((item->>'id')::uuid,'challenge:'||c.id,'challenge',
   case when success then 'Desafio coletivo concluído' when (item->>'place')::integer=1 and c.kind<>'collective' then 'Vitória no desafio (empates compartilhados)' else 'Participação no desafio' end,amount,d);
 end loop;
 update gf_challenges set settled_at=clock_timestamp(),results=board where id=p_id;
end $$;
create or replace function gf_settle_challenge(p_id uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare c gf_challenges;finish_at timestamptz;n integer; board jsonb;
begin
 perform pg_advisory_xact_lock(607173021);
 select * into strict c from gf_challenges where id=p_id for update;
 if c.settled_at is not null then return;end if;
 if c.rule_version=1 then perform arena_v1_settle_challenge(p_id);return;end if;
 if clock_timestamp()<c.invite_until then return;end if;
 select count(*),max((c.ends_on+1)::timestamp at time zone timezone) into n,finish_at from gf_challenge_members where challenge_id=p_id and status='accepted' and user_id is not null;
 if n<2 or(c.kind='collective' and c.target>(select sum(quota) from gf_challenge_members where challenge_id=p_id and status='accepted')) then
  update gf_challenges set settled_at=clock_timestamp(),cancelled=true,cancel_reason='insufficient-participants',results='[]' where id=p_id;return;end if;
 if clock_timestamp()<finish_at then return;end if;
 board:=gf_challenge_board(p_id);
 update gf_challenges set settled_at=clock_timestamp(),results=board where id=p_id;
end $$;
alter function get_friend_challenges() rename to arena_v1_friend_challenges;
create function get_friend_challenges() returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare payload jsonb;item jsonb;c gf_challenges;result jsonb:='[]';u uuid:=social_require_profile();
begin
 payload:=arena_v1_friend_challenges();
 for item in select value from jsonb_array_elements(payload) loop
  select * into strict c from gf_challenges where id=(item->>'id')::uuid;
  -- Withdrawn users may consult only their frozen historical membership, never
  -- a changing private board. Old base visibility is narrowed here as well.
  if exists(select 1 from gf_challenge_members where challenge_id=c.id and user_id=u and status='withdrawn') then
   result:=result||jsonb_build_array(item||jsonb_build_object('board','[]'::jsonb,'participants','[]'::jsonb,'closed',true,'cancelled',true,'state','cancelled','cancelReason','friendship-ended','closedAt',(select withdrawn_at from gf_challenge_members where challenge_id=c.id and user_id=u),'ruleVersion',c.rule_version));continue;end if;
  result:=result||jsonb_build_array(item||jsonb_build_object('ruleVersion',c.rule_version,'closedAt',c.settled_at,'state',case when c.cancelled then 'cancelled' when c.settled_at is not null then 'completed' when clock_timestamp()<c.invite_until then 'scheduled' else 'active' end,'cancelReason',c.cancel_reason,'rematchOf',c.rematch_of,
   'participants',(select jsonb_agg(p||jsonb_build_object('frame',(select e.item_id from gf_equipped e join gf_items i on i.id=e.item_id and i.enabled and i.category='frame' where e.user_id=(p->>'id')::uuid and e.category='frame'))) from jsonb_array_elements(item->'participants')p where exists(select 1 from gf_challenge_members m where m.challenge_id=c.id and m.user_id=(p->>'id')::uuid and m.status in('accepted','invited')))));
 end loop;
 return result;
end $$;
-- Approved short social reactions; no invented score, position or workout state.
create table arena_taunt_catalog(id text primary key,body text not null,pose text not null);
insert into arena_taunt_catalog values('doubt','Duvido','suspicious'),('watching','Quero só ver...','judging'),('sure','Sei...','judging');
create table arena_social_preferences(user_id uuid primary key references profiles(id) on delete cascade,muted boolean not null default false,push_taunts boolean not null default false);
create table arena_delivery_rules(singleton boolean primary key default true check(singleton),taunt_push_enabled boolean not null default false);
insert into arena_delivery_rules values(true,false);
create table arena_taunts(id uuid primary key,sender uuid not null references profiles(id) on delete cascade,recipient uuid not null references profiles(id) on delete cascade,message_id text not null references arena_taunt_catalog(id),created_at timestamptz not null default clock_timestamp(),seen_at timestamptz,check(sender<>recipient));
create index arena_taunts_inbox on arena_taunts(recipient,created_at desc);
create table arena_taunt_limits(sender uuid not null references profiles(id) on delete cascade,recipient uuid not null references profiles(id) on delete cascade,day date not null,sent integer not null check(sent between 1 and 3),primary key(sender,recipient,day));
create function send_arena_taunt(p_user uuid,p_message text,p_request uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=social_require_profile();d date; payload jsonb:=jsonb_build_array('taunt',p_user,p_message);old_value jsonb;
begin
 perform pg_advisory_xact_lock(607173021);
 if p_request is null then raise exception 'Identificação da operação obrigatória.';end if;
 select arena_group_receipts.payload into old_value from arena_group_receipts where user_id=u and request_id=p_request;
 if found then if old_value<>payload then raise exception 'Identificação já utilizada.';end if;return;end if;
 if not exists(select 1 from friendships where status='accepted' and least(requester,recipient)=least(u,p_user) and greatest(requester,recipient)=greatest(u,p_user)) then raise exception 'Escolha uma amizade aceita.';end if;
 if exists(select 1 from arena_social_preferences where user_id=p_user and muted) then raise exception 'Esta pessoa silenciou provocações.';end if;
 if not exists(select 1 from arena_taunt_catalog where id=p_message) then raise exception 'Escolha uma frase do catálogo.';end if;
 select (clock_timestamp() at time zone time_zone)::date into d from training_accounts where user_id=u;
 d:=coalesce(d,(clock_timestamp() at time zone 'UTC')::date);
 insert into arena_taunt_limits values(u,p_user,d,1) on conflict(sender,recipient,day) do update set sent=arena_taunt_limits.sent+1 where arena_taunt_limits.sent<3;
 if not found then raise exception 'Você já enviou três provocações para esta pessoa hoje.';end if;
 insert into arena_taunts(id,sender,recipient,message_id) values(p_request,u,p_user,p_message);
 insert into arena_group_receipts(user_id,request_id,payload) values(u,p_request,payload);
 -- Message storage is bounded; rate/receipt rows remain independent of pruning.
 delete from arena_taunts where created_at<clock_timestamp()-interval '30 days' or id in(select id from arena_taunts where recipient=p_user order by created_at desc,id offset 100);
 delete from arena_taunt_limits where day<(clock_timestamp() at time zone 'UTC')::date-3;
end $$;
create function set_arena_social_preferences(p_muted boolean,p_push boolean) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=social_require_profile();
begin
 if p_muted is null or p_push is null then raise exception 'Preferência inválida.';end if;
 insert into arena_social_preferences values(u,p_muted,p_push) on conflict(user_id) do update set muted=excluded.muted,push_taunts=excluded.push_taunts;
end $$;
create function get_arena_inbox() returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=social_require_profile();
begin
 return jsonb_build_object('muted',coalesce((select muted from arena_social_preferences where user_id=u),false),'push',coalesce((select push_taunts from arena_social_preferences where user_id=u),false),
 'messages',coalesce((select jsonb_agg(x order by x->>'createdAt' desc) from(select jsonb_build_object('id',t.id,'sender',t.sender,'nickname',p.nickname,'messageId',t.message_id,'text',c.body,'pose',c.pose,'createdAt',t.created_at,'seen',t.seen_at is not null) x from arena_taunts t join profiles p on p.id=t.sender join arena_taunt_catalog c on c.id=t.message_id where t.recipient=u and t.created_at>=clock_timestamp()-interval '30 days' and exists(select 1 from friendships where status='accepted' and least(requester,recipient)=least(u,t.sender) and greatest(requester,recipient)=greatest(u,t.sender)) order by t.created_at desc limit 20) rows),'[]'));
end $$;
create function acknowledge_arena_taunt(p_id uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin update arena_taunts set seen_at=clock_timestamp() where id=p_id and recipient=social_require_profile() and seen_at is null;end $$;
-- Optional delivery reuses push-dispatch. Disabled until separate activation.
create table arena_taunt_push_jobs(id uuid primary key default gen_random_uuid(),taunt_id uuid not null references arena_taunts(id) on delete cascade,device_id uuid not null references push_devices(id) on delete cascade,state text not null default 'sending',lease uuid not null default gen_random_uuid(),created_at timestamptz not null default clock_timestamp(),unique(taunt_id,device_id));
create function arena_taunt_push_allowed(p_id uuid,p_lease uuid) returns boolean language sql security definer set search_path=public,pg_temp as $$
 select exists(select 1 from arena_taunt_push_jobs j join arena_taunts t on t.id=j.taunt_id join push_devices d on d.id=j.device_id and d.user_id=t.recipient and d.enabled
 join arena_social_preferences p on p.user_id=t.recipient and not p.muted and p.push_taunts cross join arena_delivery_rules r
 where j.id=p_id and j.lease=p_lease and j.state='sending' and r.taunt_push_enabled and t.seen_at is null and t.created_at>clock_timestamp()-interval '15 minutes'
 and (clock_timestamp() at time zone d.time_zone)::time between time '08:00' and time '21:59:59'
 and exists(select 1 from friendships where status='accepted' and least(requester,recipient)=least(t.sender,t.recipient) and greatest(requester,recipient)=greatest(t.sender,t.recipient)));
$$;
create function claim_arena_taunt_push() returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare job_ids uuid[];
begin
 perform pg_advisory_xact_lock(607173021);
 if not (select taunt_push_enabled from arena_delivery_rules) then return '[]';end if;
 -- One provider attempt per event/device: do not replay uncertain deliveries.
 with inserted as(insert into arena_taunt_push_jobs(taunt_id,device_id)
 select distinct on(d.id) t.id,d.id from arena_taunts t join push_devices d on d.user_id=t.recipient and d.enabled
 join arena_social_preferences p on p.user_id=t.recipient and p.push_taunts and not p.muted
 where t.created_at>clock_timestamp()-interval '15 minutes' and t.seen_at is null
 and (clock_timestamp() at time zone d.time_zone)::time between time '08:00' and time '21:59:59'
 and not exists(select 1 from arena_taunt_push_jobs where taunt_id=t.id and device_id=d.id)
 and not exists(select 1 from arena_taunt_push_jobs where device_id=d.id and created_at>clock_timestamp()-interval '1 hour')
 order by d.id,t.created_at desc limit 24 on conflict do nothing returning id) select array_agg(id) into job_ids from inserted;
 return coalesce((select jsonb_agg(jsonb_build_object('job_id',j.id,'lease_id',j.lease,'endpoint',d.endpoint,'p256dh',d.p256dh,'auth',d.auth,'vapid_key',d.vapid_key,'title',p.nickname,'body',c.body,'tag','capibora-taunt-'||t.id)) from arena_taunt_push_jobs j join arena_taunts t on t.id=j.taunt_id join profiles p on p.id=t.sender join arena_taunt_catalog c on c.id=t.message_id join push_devices d on d.id=j.device_id where j.state='sending' and j.id=any(job_ids) and arena_taunt_push_allowed(j.id,j.lease)),'[]');
end $$;
create function finish_arena_taunt_push(p_id uuid,p_lease uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin update arena_taunt_push_jobs set state='attempted' where id=p_id and lease=p_lease and state='sending';end $$;
alter function get_social_state() rename to arena_phase1_social_state;
create function get_social_state() returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin return arena_phase1_social_state()||jsonb_build_object('arenaVersion',2);end $$;
-- All private tables/helpers are reachable only via explicitly granted RPCs.
do $$ declare t text;f regprocedure;begin
 foreach t in array array['arena_taunt_catalog','arena_social_preferences','arena_delivery_rules','arena_taunts','arena_taunt_limits','arena_taunt_push_jobs'] loop execute format('alter table %I enable row level security',t);execute format('revoke all on %I from public,anon,authenticated',t);end loop;
 for f in select oid::regprocedure from pg_proc where pronamespace='public'::regnamespace and (proname like 'arena_%' or proname in('get_social_state','create_arena_challenge','reply_challenge_invite','gf_challenge_metric','gf_settle_challenge','get_friend_challenges','send_arena_taunt','set_arena_social_preferences','get_arena_inbox','acknowledge_arena_taunt','claim_arena_taunt_push','finish_arena_taunt_push')) loop execute format('revoke all on function %s from public,anon,authenticated',f);end loop;
end $$;
grant execute on function get_social_state(),arena_group_command(uuid,text,uuid,text,uuid),create_arena_challenge(uuid,text,text,integer,uuid[],integer,text,text,uuid),reply_challenge_invite(uuid,boolean,text),get_friend_challenges(),send_arena_taunt(uuid,text,uuid),set_arena_social_preferences(boolean,boolean),get_arena_inbox(),acknowledge_arena_taunt(uuid) to authenticated;
grant execute on function claim_arena_taunt_push(),arena_taunt_push_allowed(uuid,uuid),finish_arena_taunt_push(uuid,uuid) to service_role;
notify pgrst,'reload schema';
commit;
