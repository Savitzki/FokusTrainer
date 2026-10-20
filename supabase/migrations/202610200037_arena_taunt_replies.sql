-- Short-lived Arena notices and exactly one reply; no chat or financial writes.
begin;
set local lock_timeout='5s';set local statement_timeout='60s';
alter table public.arena_taunt_catalog add column reply_only boolean not null default false;
insert into public.arena_taunt_catalog(id,body,pose,reply_only) values
 ('online','Vai treinar ou só ficar online?','judging',false),
 ('invitation','Vai encarar ou vai fingir que não viu?','suspicious',false),
 ('quiet','Tá quietinho demais... cadê você?','impatient',false),
 ('dare','Bora ver quem aparece no treino?','judging',false),
 ('reply-back','Olha quem fala... quero ver você também','suspicious',true);
alter table public.arena_taunts add column in_reply_to uuid references public.arena_taunts(id) on delete cascade;
alter table public.arena_taunts add column closed_at timestamptz;
create unique index arena_taunts_one_reply on public.arena_taunts(in_reply_to) where in_reply_to is not null;
-- Previously dismissed notices remain dismissed; never reopen an old receipt.
update public.arena_taunts set closed_at=seen_at where seen_at is not null;

create function public.arena_post_taunt(p_user uuid,p_message text,p_request uuid,p_reply_to uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=social_require_profile();d date;payload jsonb;old_value jsonb;original arena_taunts;
begin
 perform pg_advisory_xact_lock(607173021);
 if p_request is null then raise exception 'Identificação da operação obrigatória.';end if;
 payload:=case when p_reply_to is null then jsonb_build_array('taunt',p_user,p_message) else jsonb_build_array('taunt-reply',p_reply_to) end;
 select r.payload into old_value from arena_group_receipts r where r.user_id=u and r.request_id=p_request;
 if found then if old_value<>payload then raise exception 'Identificação já utilizada.';end if;return;end if;
 if p_reply_to is not null then
  select * into original from arena_taunts where id=p_reply_to for update;
  if not found or original.recipient<>u or original.in_reply_to is not null or original.seen_at is not null
   or original.closed_at is not null or original.created_at<clock_timestamp()-interval '30 days'
   or exists(select 1 from arena_taunts where in_reply_to=original.id)
  then raise exception 'Esta provocação já foi encerrada ou revidada.';end if;
  p_user:=original.sender;p_message:='reply-back';
 end if;
 if not exists(select 1 from friendships where status='accepted' and least(requester,recipient)=least(u,p_user) and greatest(requester,recipient)=greatest(u,p_user)) then raise exception 'Escolha uma amizade aceita.';end if;
 if exists(select 1 from arena_social_preferences where user_id=p_user and muted) then raise exception 'Esta pessoa silenciou provocações.';end if;
 if not exists(select 1 from arena_taunt_catalog where id=p_message and reply_only=(p_reply_to is not null)) then raise exception 'Escolha uma frase do catálogo.';end if;
 select (clock_timestamp() at time zone time_zone)::date into d from training_accounts where user_id=u;
 d:=coalesce(d,(clock_timestamp() at time zone 'UTC')::date);
 insert into arena_taunt_limits values(u,p_user,d,1) on conflict(sender,recipient,day) do update set sent=arena_taunt_limits.sent+1 where arena_taunt_limits.sent<3;
 if not found then raise exception 'Você já enviou três provocações para esta pessoa hoje.';end if;
 insert into arena_taunts(id,sender,recipient,message_id,in_reply_to) values(p_request,u,p_user,p_message,p_reply_to);
 if p_reply_to is not null then update arena_taunts set seen_at=clock_timestamp() where id=p_reply_to;end if;
 insert into arena_group_receipts(user_id,request_id,payload) values(u,p_request,payload);
 delete from arena_taunts where created_at<clock_timestamp()-interval '30 days' or id in(select id from arena_taunts where recipient=p_user order by created_at desc,id offset 100);
 delete from arena_taunt_limits where day<(clock_timestamp() at time zone 'UTC')::date-3;
end $$;
create or replace function public.send_arena_taunt(p_user uuid,p_message text,p_request uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin perform arena_post_taunt(p_user,p_message,p_request,null);end $$;
create function public.reply_arena_taunt(p_id uuid,p_request uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if p_id is null then raise exception 'Escolha uma provocação recebida.';end if;
 perform arena_post_taunt(null,null,p_request,p_id);
end $$;
create or replace function public.acknowledge_arena_taunt(p_id uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=social_require_profile();t arena_taunts;
begin
 perform pg_advisory_xact_lock(607173021);
 select * into t from arena_taunts where id=p_id and recipient=u for update;
 if not found or t.seen_at is not null then return;end if;
 update arena_taunts set seen_at=clock_timestamp(),closed_at=clock_timestamp() where id=t.id;
 if t.in_reply_to is not null then update arena_taunts set closed_at=clock_timestamp() where id=t.in_reply_to;end if;
end $$;
create function public.arena_taunt_open(p_id uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from arena_taunts t where t.id=p_id and t.seen_at is null and t.closed_at is null
  and t.created_at>=clock_timestamp()-interval '30 days'
  and (t.in_reply_to is null or exists(select 1 from arena_taunts r where r.id=t.in_reply_to and r.closed_at is null)));
$$;
create function public.get_arena_inbox(p_version integer) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=social_require_profile();muted_value boolean;
begin
 if p_version is null or p_version not in(1,2) then raise exception 'Versão de provocações inválida.';end if;
 select coalesce((select muted from arena_social_preferences where user_id=u),false) into muted_value;
 return jsonb_build_object('version',p_version,'muted',muted_value,'push',coalesce((select push_taunts from arena_social_preferences where user_id=u),false),
 'messages',coalesce((select jsonb_agg(x order by x->>'createdAt',x->>'id') from (
  select jsonb_build_object('id',t.id,'sender',t.sender,'nickname',p.nickname,'messageId',t.message_id,'text',c.body,'pose',c.pose,
   'createdAt',t.created_at,'seen',false,'replyTo',t.in_reply_to,'canReply',t.in_reply_to is null) x
  from arena_taunts t join profiles p on p.id=t.sender join arena_taunt_catalog c on c.id=t.message_id
  where t.recipient=u and not muted_value and arena_taunt_open(t.id)
   and (p_version=2 or t.message_id in('doubt','watching','sure'))
   and exists(select 1 from friendships where status='accepted' and least(requester,recipient)=least(u,t.sender) and greatest(requester,recipient)=greatest(u,t.sender))
  order by t.created_at,t.id limit 20) rows),'[]'));
end $$;

-- Old PWAs keep their original catalog/shape; new clients opt into version 2.
create or replace function public.get_arena_inbox() returns jsonb
language sql security definer set search_path=public,pg_temp as $$
 select get_arena_inbox(1);
$$;

-- Avatar photos are independent of buying/equipping a frame. The helper stays private.
create or replace function public.gf_social_appearance(p_user uuid) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce((select jsonb_build_object('avatar',jsonb_build_object('nickname',p.nickname,'color',p.avatar_color,'style',p.avatar_style,'photo',p.avatar_photo))
  ||coalesce((select jsonb_build_object('frame',i.id) from gf_equipped e join gf_items i on i.id=e.item_id and i.enabled and i.category='frame'
    where e.user_id=p.id and e.category='frame'),'{}'::jsonb)
  from profiles p where p.id=p_user),'{}'::jsonb);
$$;
create or replace function public.get_social_state() returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
begin return arena_phase1_social_state()||jsonb_build_object('arenaVersion',2,'tauntNotices',true);end $$;

-- Only replies use optional push; original notices live inside the Arena.
-- Keep service enablement, opt-in, quiet hours, one-hour cap and at-most-once delivery.
create or replace function public.arena_taunt_push_allowed(p_id uuid,p_lease uuid) returns boolean
language sql security definer set search_path=public,pg_temp as $$
 select exists(select 1 from arena_taunt_push_jobs j join arena_taunts t on t.id=j.taunt_id join push_devices d on d.id=j.device_id and d.user_id=t.recipient and d.enabled
 join arena_social_preferences p on p.user_id=t.recipient and not p.muted and p.push_taunts cross join arena_delivery_rules r
 where j.id=p_id and j.lease=p_lease and j.state='sending' and r.taunt_push_enabled and t.in_reply_to is not null and arena_taunt_open(t.id)
 and t.created_at>clock_timestamp()-interval '15 minutes' and (clock_timestamp() at time zone d.time_zone)::time between time '08:00' and time '21:59:59'
 and exists(select 1 from friendships where status='accepted' and least(requester,recipient)=least(t.sender,t.recipient) and greatest(requester,recipient)=greatest(t.sender,t.recipient)));
$$;
create or replace function public.claim_arena_taunt_push() returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare job_ids uuid[];
begin
 perform pg_advisory_xact_lock(607173021);
 if not (select taunt_push_enabled from arena_delivery_rules) then return '[]';end if;
 with inserted as(insert into arena_taunt_push_jobs(taunt_id,device_id)
 select distinct on(d.id) t.id,d.id from arena_taunts t join push_devices d on d.user_id=t.recipient and d.enabled
 join arena_social_preferences p on p.user_id=t.recipient and p.push_taunts and not p.muted
 where t.in_reply_to is not null and t.created_at>clock_timestamp()-interval '15 minutes' and arena_taunt_open(t.id)
 and (clock_timestamp() at time zone d.time_zone)::time between time '08:00' and time '21:59:59'
 and exists(select 1 from friendships where status='accepted' and least(requester,recipient)=least(t.sender,t.recipient) and greatest(requester,recipient)=greatest(t.sender,t.recipient))
 and not exists(select 1 from arena_taunt_push_jobs where taunt_id=t.id and device_id=d.id)
 and not exists(select 1 from arena_taunt_push_jobs where device_id=d.id and created_at>clock_timestamp()-interval '1 hour')
 order by d.id,t.created_at desc,t.id limit 24 on conflict do nothing returning id) select array_agg(id) into job_ids from inserted;
 return coalesce((select jsonb_agg(jsonb_build_object('job_id',j.id,'lease_id',j.lease,'endpoint',d.endpoint,'p256dh',d.p256dh,'auth',d.auth,'vapid_key',d.vapid_key,
  'title','@'||p.nickname||' revidou','body',c.body,'tag','capibora-taunt-'||t.id)) from arena_taunt_push_jobs j join arena_taunts t on t.id=j.taunt_id
  join profiles p on p.id=t.sender join arena_taunt_catalog c on c.id=t.message_id join push_devices d on d.id=j.device_id
  where j.state='sending' and j.id=any(job_ids) and arena_taunt_push_allowed(j.id,j.lease)),'[]');
end $$;
revoke all on function public.arena_post_taunt(uuid,text,uuid,uuid),public.arena_taunt_open(uuid),public.reply_arena_taunt(uuid,uuid),public.get_arena_inbox(integer) from public,anon,authenticated;
grant execute on function public.reply_arena_taunt(uuid,uuid),public.get_arena_inbox(integer) to authenticated;
-- No flag/preference is activated and no push is sent by this migration.
notify pgrst,'reload schema';
commit;
