-- Apply after 009. No backfill of rewards or protection of closed days.
begin;
set local lock_timeout='5s';
set local statement_timeout='45s';

-- The server owns all reward/pricing rules. No client may edit this row.
create table if not exists public.economy_rules (
 singleton boolean primary key default true check(singleton),
 workout_reward integer not null default 10 check(workout_reward between 0 and 100000),
 weight_reward integer not null default 2 check(weight_reward between 0 and 100000),
 kit_price integer not null default 50 check(kit_price between 1 and 100000),
 weekly_kit_limit integer not null default 2 check(weekly_kit_limit between 0 and 100)
);
insert into public.economy_rules(singleton) values(true) on conflict do nothing;
create table if not exists public.coin_wallets (
 user_id uuid primary key references auth.users(id) on delete cascade,
 balance bigint not null default 0 check(balance>=0),
 revision bigint not null default 0 check(revision>=0)
);
create table if not exists public.coin_movements (
 id bigint generated always as identity primary key,
 user_id uuid not null references public.coin_wallets(user_id) on delete cascade,
 source_key text not null,
 kind text not null check(kind in('workout','weight','kit-purchase')),
 description text not null,
 amount integer not null check(amount<>0),
 balance_after bigint not null check(balance_after>=0),
 activity_day date not null,
 created_at timestamptz not null default clock_timestamp(),
 unique(user_id,source_key),
 check((kind='kit-purchase' and amount<0) or (kind<>'kit-purchase' and amount>0))
);
create index if not exists coin_movements_history on public.coin_movements(user_id,id desc);
create table if not exists public.medical_kits (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.coin_wallets(user_id) on delete cascade,
 purchase_id bigint not null unique references public.coin_movements(id) on delete cascade,
 acquired_at timestamptz not null default clock_timestamp(),
 used_on date,
 used_at timestamptz,
 check((used_on is null)=(used_at is null)),
 unique(user_id,used_on)
);
create index if not exists medical_kits_inventory on public.medical_kits(user_id,acquired_at,id) where used_on is null;
alter table public.economy_rules enable row level security;
alter table public.coin_wallets enable row level security;
alter table public.coin_movements enable row level security;
alter table public.medical_kits enable row level security;
revoke all on public.economy_rules,public.coin_wallets,public.coin_movements,public.medical_kits from public,anon,authenticated;
revoke all on sequence public.coin_movements_id_seq from public,anon,authenticated;

-- Always lock the wallet before posting. Uniqueness makes retries idempotent.
create or replace function public.economy_post(p_user uuid,p_key text,p_kind text,p_description text,p_amount integer,p_day date)
returns bigint language plpgsql security definer set search_path=public,pg_temp as $$
declare w coin_wallets; movement_id bigint;
begin
 insert into coin_wallets(user_id) values(p_user) on conflict do nothing;
 select * into w from coin_wallets where user_id=p_user for update;
 select id into movement_id from coin_movements where user_id=p_user and source_key=p_key;
 if found then return movement_id; end if;
 if p_amount=0 then return null; end if;
 if w.balance+p_amount<0 then raise exception 'Moedas insuficientes para comprar o Kit Médico.'; end if;
 update coin_wallets set balance=balance+p_amount,revision=revision+1 where user_id=p_user;
 insert into coin_movements(user_id,source_key,kind,description,amount,balance_after,activity_day)
 values(p_user,p_key,p_kind,p_description,p_amount,w.balance+p_amount,p_day) returning id into movement_id;
 return movement_id;
end $$;

-- Only newly inserted, valid records can earn coins. Edits, tombstones,
-- conflicts and import of older dates cannot generate rewards.
create or replace function public.economy_record_reward() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare tz text; reward integer; reward_kind text; label text;
begin
 select time_zone into tz from training_accounts where user_id=new.user_id;
 if tz is null then
   -- Administrative inserts without a schedule use UTC; API calls pin a timezone first.
   tz:='UTC';
   insert into training_accounts(user_id,time_zone,started_on)
   values(new.user_id,tz,(now() at time zone tz)::date) on conflict do nothing;
   select time_zone into tz from training_accounts where user_id=new.user_id;
 end if;
 if new.day<>(now() at time zone tz)::date then return new; end if;
 if tg_table_name='weight_logs' then
   if new.kg is null then return new; end if;
   reward_kind:='weight'; label:='Peso registrado';
   select weight_reward into reward from economy_rules where singleton;
 else
   reward_kind:='workout'; label:='Treino concluído';
   select workout_reward into reward from economy_rules where singleton;
 end if;
 perform economy_post(new.user_id,reward_kind||':'||new.day::text,reward_kind,label,reward,new.day);
 return new;
end $$;
drop trigger if exists economy_workout_reward on public.workout_days;
create trigger economy_workout_reward after insert on public.workout_days for each row execute function public.economy_record_reward();
drop trigger if exists economy_weight_reward on public.weight_logs;
create trigger economy_weight_reward after insert on public.weight_logs for each row execute function public.economy_record_reward();

-- Retain the existing weight-sync contract, adding only canonical timezone setup.
do $$ begin
 if to_regprocedure('public.economy_base_sync_weights(uuid,jsonb,text)') is null then
   alter function public.sync_weights(uuid,jsonb,text) rename to economy_base_sync_weights;
 end if;
end $$;
create or replace function public.sync_weights(p_user_id uuid,p_changes jsonb,p_timezone text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); tz text;
begin
 if u is null or p_user_id is distinct from u then raise exception 'Entre novamente na sua conta.'; end if;
 perform get_training_state(p_timezone);
 select time_zone into tz from training_accounts where user_id=u for update;
 return economy_base_sync_weights(p_user_id,p_changes,tz);
end $$;

create or replace function public.economy_history(p_user uuid,p_before bigint default null) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
 with page as (select * from coin_movements where user_id=p_user and (p_before is null or id<p_before) order by id desc limit 20)
 select jsonb_build_object('entries',coalesce((select jsonb_agg(jsonb_build_object(
 'id',id::text,'kind',kind,'description',description,'amount',amount,'balanceAfter',balance_after,
 'requestId',case when kind='kit-purchase' then substr(source_key,5) else null end,
 'day',activity_day,'createdAt',created_at) order by id desc) from page),'[]'::jsonb),
 'hasMore',exists(select 1 from coin_movements where user_id=p_user and id<(select min(id) from page)));
$$;
create or replace function public.economy_state(p_user uuid) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('revision',w.revision,'balance',w.balance,
 'kits',(select count(*) from medical_kits where user_id=p_user and used_on is null),
 'today',(now() at time zone a.time_zone)::date,'timezone',a.time_zone,
 'kitsUsedThisWeek',(select count(*) from medical_kits where user_id=p_user and used_on>=date_trunc('week',now() at time zone a.time_zone)::date and used_on<date_trunc('week',now() at time zone a.time_zone)::date+7),
 'protections',coalesce((select jsonb_agg(jsonb_build_object('id',id,'day',used_on,'usedAt',used_at) order by used_on desc) from medical_kits where user_id=p_user and used_on is not null),'[]'::jsonb),
 'rules',(select jsonb_build_object('workoutReward',workout_reward,'weightReward',weight_reward,'kitPrice',kit_price,'weeklyKitLimit',weekly_kit_limit) from economy_rules where singleton),
 'history',economy_history(p_user))
 from coin_wallets w join training_accounts a using(user_id) where w.user_id=p_user;
$$;
create or replace function public.get_economy_state(p_timezone text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid();
begin
 perform get_training_state(p_timezone);
 insert into coin_wallets(user_id) values(u) on conflict do nothing;
 return economy_state(u);
end $$;
create or replace function public.get_economy_history(p_before bigint default null) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid();
begin
 if u is null then raise exception 'Entre para consultar suas moedas.'; end if;
 return economy_history(u,p_before);
end $$;
create or replace function public.buy_medical_kit(p_request_id uuid,p_timezone text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); price integer; movement_id bigint; d date;
begin
 if p_request_id is null then raise exception 'Identificador de compra inválido.'; end if;
 perform get_training_state(p_timezone);
 select (now() at time zone time_zone)::date into d from training_accounts where user_id=u for update;
 -- Retry returns the original purchase, even after a price change.
 if exists(select 1 from coin_movements where user_id=u and source_key='kit:'||p_request_id::text) then return economy_state(u); end if;
 select kit_price into price from economy_rules where singleton;
 movement_id:=economy_post(u,'kit:'||p_request_id::text,'kit-purchase','Compra de Kit Médico',-price,d);
 insert into medical_kits(user_id,purchase_id) values(u,movement_id);
 return economy_state(u);
end $$;

-- Protection shares the same day/cutoff rules as authorized extra rest.
create or replace function public.training_day_kind(p_user uuid,p_day date,
 p_plan_cutoff timestamptz default 'infinity',p_rest_cutoff timestamptz default 'infinity')
returns text language sql stable security definer set search_path=public,pg_temp as $$
 select case
 when exists(select 1 from medical_kits where user_id=p_user and used_on=p_day and used_at<p_rest_cutoff) then 'medical-kit'
 when exists(select 1 from training_extra_rests where user_id=p_user and day=p_day and authorized_at<p_rest_cutoff) then 'extra-rest'
 when extract(isodow from p_day)::integer=any(coalesce((
   select training_days from training_plans where user_id=p_user and effective_on<=p_day and created_at<=p_plan_cutoff
   order by effective_on desc,revision desc limit 1),array[1,2,3,4,5,6,7])) then 'training'
 else 'scheduled-rest' end;
$$;
create or replace function public.training_state(p_user uuid) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('revision',a.revision,'timezone',a.time_zone,'today',(now() at time zone a.time_zone)::date,
 'startedOn',a.started_on,'weeklyExtraLimit',training_extra_rest_limit(),
 'plans',coalesce((select jsonb_agg(jsonb_build_object('revision',p.revision,'effectiveFrom',p.effective_on,'trainingDays',p.training_days) order by p.revision)
  from training_plans p where p.user_id=a.user_id),'[]'::jsonb),
 'extraRests',coalesce((select jsonb_agg(r.day order by r.day) from training_extra_rests r where r.user_id=a.user_id),'[]'::jsonb),
 'medicalRests',coalesce((select jsonb_agg(k.used_on order by k.used_on) from medical_kits k where k.user_id=a.user_id and k.used_on is not null),'[]'::jsonb))
 from training_accounts a where a.user_id=p_user;
$$;
create or replace function public.use_medical_kit(p_day date,p_timezone text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); a training_accounts; k medical_kits; d date; monday date; quota integer; g record;
begin
 perform get_training_state(p_timezone);
 select * into a from training_accounts where user_id=u for update;
 d:=(now() at time zone a.time_zone)::date;
 if p_day is distinct from d then raise exception 'O Kit Médico protege apenas hoje, antes de o dia terminar.'; end if;
 if exists(select 1 from medical_kits where user_id=u and used_on=d) then return economy_state(u); end if;
 if training_day_kind(u,d)<>'training' then raise exception 'Hoje já está protegido por um descanso.'; end if;
 if exists(select 1 from workout_days where user_id=u and day=d) then raise exception 'Você já registrou o treino de hoje.'; end if;
 monday:=d-(extract(isodow from d)::integer-1);
 select weekly_kit_limit into quota from economy_rules where singleton;
 if (select count(*) from medical_kits where user_id=u and used_on>=monday and used_on<monday+7)>=quota
 then raise exception 'Você já usou o limite de kits desta semana.'; end if;
 -- Lock order: account -> wallet -> item. A purchase/confirmation uses the same order.
 perform 1 from coin_wallets where user_id=u for update;
 select * into k from medical_kits where user_id=u and used_on is null order by acquired_at,id limit 1 for update;
 if not found then raise exception 'Você não tem um Kit Médico disponível.'; end if;
 update medical_kits set used_on=d,used_at=clock_timestamp() where id=k.id;
 update coin_wallets set revision=revision+1 where user_id=u;
 update training_accounts set revision=revision+1 where user_id=u;
 for g in select group_id from group_members where user_id=u order by group_id loop perform social_refresh_day(g.group_id); end loop;
 return economy_state(u);
end $$;

revoke all on function public.economy_post(uuid,text,text,text,integer,date),public.economy_record_reward(),public.economy_base_sync_weights(uuid,jsonb,text),public.economy_history(uuid,bigint),public.economy_state(uuid),public.training_day_kind(uuid,date,timestamptz,timestamptz),public.training_state(uuid) from public,anon,authenticated;
revoke all on function public.get_economy_state(text),public.get_economy_history(bigint),public.buy_medical_kit(uuid,text),public.use_medical_kit(date,text),public.sync_weights(uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.get_economy_state(text),public.get_economy_history(bigint),public.buy_medical_kit(uuid,text),public.use_medical_kit(date,text),public.sync_weights(uuid,jsonb,text) to authenticated;
notify pgrst, 'reload schema';
commit;
