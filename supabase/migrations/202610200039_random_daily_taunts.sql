-- One random original per friend/account day. Replies remain unique and independent.
-- Existing quota rows remain spent until their original day ends; never reset live allowances.
begin;
set local lock_timeout='5s'; set local statement_timeout='60s';
-- Serialize with both old clients and ongoing replies before switching the rule.
select pg_advisory_xact_lock(607173021);
alter table public.arena_taunt_catalog add column original_eligible boolean not null default false;
insert into public.arena_taunt_catalog(id,body,pose,original_eligible) values
('gossip-defense','Eu tentei te defender, mas teu amigo perguntou quando foi a última vez que vc treinou...','suspicious',true),('gossip-photo','não quero me envolver, mas tão falando que vc só vai pra academia pra tirar foto','judging',true),('gossip-streak','EU NÃO TENHO NADA A VER COM ISSO, MAAAAS teu amigo disse que sua ofensiva é igual relacionamento ruim: nunca dura!','impatient',true),('gossip-fork','Tão falando que vc só faz levantamento de garfo','suspicious',true),('gossip-water','Ó, não fui eu que falei tá? Mas tem alguém aí dizendo que vc só vai pra academia pra beber água','judging',true);

create or replace function public.arena_post_taunt(p_user uuid,p_message text,p_request uuid,p_reply_to uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=social_require_profile();d date;payload jsonb;old_value jsonb;original arena_taunts;
begin
 perform pg_advisory_xact_lock(607173021);
 if p_request is null then raise exception 'Identificação da operação obrigatória.';end if;
 payload:=case when p_reply_to is null then jsonb_build_array('taunt',p_user,p_message) else jsonb_build_array('taunt-reply',p_reply_to) end;
 select r.payload into old_value from arena_group_receipts r where r.user_id=u and r.request_id=p_request;
 if found then if old_value<>payload and not coalesce((p_reply_to is null and old_value->>0='taunt' and old_value->>1=p_user::text),false) then raise exception 'Identificação já utilizada.';end if;return;end if;
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
 if p_reply_to is null then
  select id into p_message from arena_taunt_catalog where original_eligible and not reply_only order by random() limit 1;
  if p_message is null then raise exception 'Provocações indisponíveis no momento.';end if;
 end if;
 select (clock_timestamp() at time zone time_zone)::date into d from training_accounts where user_id=u;
 d:=coalesce(d,(clock_timestamp() at time zone 'UTC')::date);
 if p_reply_to is null then
  insert into arena_taunt_limits values(u,p_user,d,1) on conflict(sender,recipient,day) do nothing;
  if not found then raise exception 'Você já provocou esta pessoa hoje.';end if;
 end if;
 insert into arena_taunts(id,sender,recipient,message_id,in_reply_to) values(p_request,u,p_user,p_message,p_reply_to);
 if p_reply_to is not null then update arena_taunts set seen_at=clock_timestamp() where id=p_reply_to;end if;
 insert into arena_group_receipts(user_id,request_id,payload) values(u,p_request,payload);
 delete from arena_taunts where created_at<clock_timestamp()-interval '30 days' or id in(select id from arena_taunts where recipient=p_user order by created_at desc,id offset 100);
 delete from arena_taunt_limits where day<(clock_timestamp() at time zone 'UTC')::date-3;
end $$;

create or replace function public.get_arena_inbox(p_version integer) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=social_require_profile();muted_value boolean;
begin
 if p_version is null or p_version not in(1,2,3) then raise exception 'Versão de provocações inválida.';end if;
 select coalesce((select muted from arena_social_preferences where user_id=u),false) into muted_value;
 return jsonb_build_object('version',p_version,'muted',muted_value,'push',coalesce((select push_taunts from arena_social_preferences where user_id=u),false),
 'messages',coalesce((select jsonb_agg(x order by x->>'createdAt',x->>'id') from (
  select jsonb_build_object('id',t.id,'sender',t.sender,'nickname',p.nickname,'messageId',t.message_id,'text',c.body,'pose',c.pose,
   'createdAt',t.created_at,'seen',false,'replyTo',t.in_reply_to,'canReply',t.in_reply_to is null) x
  from arena_taunts t join profiles p on p.id=t.sender join arena_taunt_catalog c on c.id=t.message_id
  where t.recipient=u and not muted_value and arena_taunt_open(t.id)
   and (p_version=3 or (p_version=2 and not c.original_eligible) or t.message_id in('doubt','watching','sure'))
   and exists(select 1 from friendships where status='accepted' and least(requester,recipient)=least(u,t.sender) and greatest(requester,recipient)=greatest(u,t.sender))
  order by t.created_at,t.id limit 20) rows),'[]'));
end $$;


-- The authenticated social snapshot is the only source of outgoing allowance state.
-- Keep the existing version/contracts and all accepted-friend privacy checks.
create or replace function public.get_social_state() returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=social_require_profile(); tz text; stamp timestamptz:=clock_timestamp(); d date;
begin
 select time_zone into tz from training_accounts where user_id=u;
 tz:=coalesce(tz,'UTC'); d:=(stamp at time zone tz)::date;
 return arena_phase1_social_state()||jsonb_build_object('arenaVersion',2,'tauntNotices',true,
 'tauntAllowance',jsonb_build_object('day',d,'checkedAt',stamp,'resetsAt',(d+1)::timestamp at time zone tz,
 'sentTo',coalesce((select jsonb_agg(l.recipient) from arena_taunt_limits l where l.sender=u and l.day=d),'[]'::jsonb)));
end $$;
-- Old clients cannot pick a phrase: the same send RPC now ignores p_message for selection.
-- Existing SECURITY DEFINER search paths, RLS, grants, receipts, inbox and push remain unchanged.
notify pgrst,'reload schema';
commit;
