-- Stage 4. Consent, frozen quotas, immutable results and modest capped rewards.
begin;
create table public.gf_challenges (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid references public.profiles(id) on delete set null,
 name text not null check(length(trim(name)) between 1 and 40),
 kind text not null check(kind in('consistency','collective','frequency')),
 starts_on date not null, ends_on date not null, invite_until timestamptz not null,
 target integer not null check(target>0), rewards jsonb not null,
 created_at timestamptz not null default clock_timestamp(),
 settled_at timestamptz, cancelled boolean not null default false, results jsonb,
 check(ends_on-starts_on in(6,29))
);
create table public.gf_challenge_members (
 id uuid primary key default gen_random_uuid(),
 challenge_id uuid not null references public.gf_challenges(id) on delete cascade,
 user_id uuid references public.profiles(id) on delete set null,
 nickname text not null,
 status text not null check(status in('invited','accepted','declined')),
 timezone text, quota integer, accepted_at timestamptz,
 unique(challenge_id,user_id)
);
create index gf_challenge_member_account on public.gf_challenge_members(user_id,challenge_id);
create function public.gf_challenge_metric(p_challenge uuid,p_user uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare c gf_challenges; m gf_challenge_members; d date; done integer; due integer;
begin
 select * into strict c from gf_challenges where id=p_challenge;
 select * into strict m from gf_challenge_members where challenge_id=p_challenge and user_id=p_user and status='accepted';
 d:=(now() at time zone m.timezone)::date;
 select count(*) filter(where kind in('training','compensatory') and completed),
 count(*) filter(where kind in('training','compensatory') and (day<d or completed)) into done,due
 from gf_days_between(p_user,c.starts_on,least(c.ends_on,d));
 -- Consistency follows effective obligations; legitimate future rests never count as misses.
 -- Only volume-based contests need the accepted quota as a cap, never as extra work to do.
 if c.kind<>'consistency' then done:=least(done,m.quota);end if;
 return jsonb_build_object('completed',done,'planned',due,'percent',round(100.0*done/nullif(due,0),1));
end $$;
create function public.gf_challenge_board(p_challenge uuid) returns jsonb
language sql security definer set search_path=public,pg_temp as $$
 with metrics as (select m.user_id,m.nickname,case when m.user_id is null then '{"completed":0,"planned":0,"percent":null}'::jsonb
  else gf_challenge_metric(p_challenge,m.user_id) end value from gf_challenge_members m where m.challenge_id=p_challenge and m.status='accepted'),
 scores as (select *,case when c.kind='consistency' then (value->>'completed')::numeric/nullif((value->>'planned')::integer,0)
  else (value->>'completed')::numeric end score from metrics cross join gf_challenges c where c.id=p_challenge),
 ranked as (select *,rank() over(order by score desc nulls last) place from scores)
 select coalesce(jsonb_agg(jsonb_build_object('id',user_id,'nickname',nickname,'completed',(value->>'completed')::integer,
 'planned',(value->>'planned')::integer,'percent',value->'percent','place',case when score is not null and (value->>'completed')::integer>0 then place end)
 order by place,nickname),'[]') from ranked;
$$;
create function public.gf_settle_challenge(p_id uuid) returns void
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
create function public.create_friend_challenge(p_name text,p_kind text,p_duration integer,p_friends uuid[],p_target integer,p_timezone text) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=social_require_profile(); a training_accounts; d date; first_day date; last_day date; quota integer; id_value uuid; r gf_rules;
begin
 -- Serializes invitation counts across different creators, as well as devices.
 perform pg_advisory_xact_lock(607173021);
 perform get_training_state(p_timezone);
 select * into strict a from training_accounts where user_id=u for update;
 d:=(now() at time zone a.time_zone)::date; first_day:=d+1; last_day:=d+p_duration;
 if p_name is null or length(trim(p_name)) not between 1 and 40 or p_kind not in('consistency','collective','frequency') or p_duration not in(7,30)
  or p_friends is null or cardinality(p_friends) not between 1 and 7 or cardinality(p_friends)<>(select count(distinct x) from unnest(p_friends) x)
  or u=any(p_friends) then raise exception 'Escolha um nome, 7 ou 30 dias e de 1 a 7 amigos.'; end if;
 if exists(select 1 from unnest(p_friends) x where not exists(select 1 from friendships where status='accepted' and ((requester=u and recipient=x) or (recipient=u and requester=x)))) then raise exception 'Convide apenas amizades já aceitas.'; end if;
 -- Keep the starting calendar date in the future for every invited account.
 -- For friends without a pinned timezone yet, UTC+14 is the conservative bound.
 select greatest(d+1,coalesce(max((now() at time zone coalesce(invited.time_zone,'Pacific/Kiritimati'))::date+1),d+1)) into first_day
  from unnest(p_friends) friend_id left join training_accounts invited on invited.user_id=friend_id;
 last_day:=first_day+p_duration-1;
 if exists(select 1 from unnest(p_friends||array[u]) person where (select count(*) from gf_challenge_members m join gf_challenges c on c.id=m.challenge_id where m.user_id=person and m.status<>'declined' and c.settled_at is null)>=10) then raise exception 'Um participante já tem dez desafios em aberto.'; end if;
 if (select count(*) from gf_challenges where owner_id=u and settled_at is null)>=3 then raise exception 'Encerre seus desafios atuais antes de criar outro (limite 3).'; end if;
 select count(*) into quota from generate_series(first_day::timestamp,last_day::timestamp,interval '1 day') x where training_schedule_kind(u,x::date)='training';
 if quota<1 or (p_kind='collective' and (p_target is null or p_target<1 or p_target>quota*(cardinality(p_friends)+1))) then raise exception 'A meta coletiva deve caber no planejamento dos participantes.'; end if;
 select * into strict r from gf_rules where singleton;
 insert into gf_challenges(owner_id,name,kind,starts_on,ends_on,invite_until,target,rewards) values(u,trim(p_name),p_kind,first_day,last_day,
  first_day::timestamp at time zone a.time_zone,case when p_kind='collective' then p_target else quota end,
  jsonb_build_object('participation',r.challenge_participation,'winner',r.challenge_winner)) returning id into id_value;
 insert into gf_challenge_members(challenge_id,user_id,nickname,status,timezone,quota,accepted_at)
  select id_value,u,nickname,'accepted',a.time_zone,quota,clock_timestamp() from profiles where id=u;
 insert into gf_challenge_members(challenge_id,user_id,nickname,status) select id_value,id,nickname,'invited' from profiles where id=any(p_friends);
 return id_value;
end $$;
create function public.reply_challenge_invite(p_id uuid,p_accept boolean,p_timezone text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=social_require_profile(); c gf_challenges; tz text; quota_value integer;
begin
 perform get_training_state(p_timezone);
 select time_zone into strict tz from training_accounts where user_id=u for update;
 select * into strict c from gf_challenges where id=p_id for update;
 if p_accept is null or c.settled_at is not null or now()>=least(c.invite_until,c.starts_on::timestamp at time zone tz)
  then raise exception 'O prazo para aceitar este desafio terminou.'; end if;
 if not exists(select 1 from gf_challenge_members where challenge_id=p_id and user_id=u and status='invited') then raise exception 'Convite indisponível.'; end if;
 select count(*) into quota_value from generate_series(c.starts_on::timestamp,c.ends_on::timestamp,interval '1 day') x where training_schedule_kind(u,x::date)='training';
 if p_accept and quota_value<1 then raise exception 'Configure sua semana antes de aceitar.'; end if;
 update gf_challenge_members set status=case when p_accept then 'accepted' else 'declined' end,timezone=tz,quota=quota_value,accepted_at=case when p_accept then clock_timestamp() end
 where challenge_id=p_id and user_id=u;
end $$;
create function public.get_friend_challenges() returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=social_require_profile(); c gf_challenges; result jsonb:='[]'; item jsonb; person uuid;
begin
 -- Lock order: settlement lane -> all participating accounts (UUID order) -> challenges -> wallets.
 -- An on-time workout transaction must commit before a closed-day snapshot is consolidated.
 perform pg_advisory_xact_lock(607173021);
 for person in select distinct m.user_id from gf_challenge_members m join gf_challenges challenge on challenge.id=m.challenge_id
  where challenge.settled_at is null and m.status='accepted' and m.user_id is not null
  and exists(select 1 from gf_challenge_members own where own.challenge_id=challenge.id and own.user_id=u and own.status<>'declined')
  order by m.user_id loop perform 1 from training_accounts where user_id=person for update;end loop;
 for c in select x.* from gf_challenges x join gf_challenge_members m on m.challenge_id=x.id
  where m.user_id=u and m.status<>'declined' order by x.created_at desc limit 100 loop
  perform gf_settle_challenge(c.id);
  select * into c from gf_challenges where id=c.id;
  item:=jsonb_build_object('id',c.id,'name',c.name,'kind',c.kind,'start',c.starts_on,'end',c.ends_on,
   'inviteUntil',least(c.invite_until,c.starts_on::timestamp at time zone coalesce((select time_zone from training_accounts where user_id=u),'UTC')),'target',c.target,'closed',c.settled_at is not null,'cancelled',c.cancelled,
   'invited',exists(select 1 from gf_challenge_members where challenge_id=c.id and user_id=u and status='invited'),
   'participants',(select jsonb_agg(jsonb_build_object('id',user_id,'nickname',nickname,'accepted',status='accepted')) from gf_challenge_members where challenge_id=c.id and status<>'declined'),
   'board',coalesce(c.results,gf_challenge_board(c.id)));
  result:=result||jsonb_build_array(item);
 end loop;
 return result;
end $$;
create function public.gf_collective_wins(p_user uuid) returns integer
language sql stable security definer set search_path=public,pg_temp as $$
 select count(*)::integer from gf_challenges c join gf_challenge_members m on m.challenge_id=c.id
 where m.user_id=p_user and m.status='accepted' and c.kind='collective' and c.settled_at is not null and not c.cancelled
 and (select sum((x->>'completed')::integer) from jsonb_array_elements(c.results) x)>=c.target;
$$;
do $$ declare t text; f regprocedure; begin
 foreach t in array array['gf_challenges','gf_challenge_members'] loop
  execute format('alter table public.%I enable row level security',t); execute format('revoke all on public.%I from public,anon,authenticated',t);
 end loop;
 for f in select oid::regprocedure from pg_proc where pronamespace='public'::regnamespace and left(proname,3)='gf_' loop execute format('revoke all on function %s from public,anon,authenticated',f); end loop;
end $$;
revoke all on function public.create_friend_challenge(text,text,integer,uuid[],integer,text),public.reply_challenge_invite(uuid,boolean,text),public.get_friend_challenges() from public,anon,authenticated;
grant execute on function public.create_friend_challenge(text,text,integer,uuid[],integer,text),public.reply_challenge_invite(uuid,boolean,text),public.get_friend_challenges() to authenticated;
notify pgrst,'reload schema';
commit;
