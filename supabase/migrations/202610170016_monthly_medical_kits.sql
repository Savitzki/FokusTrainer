-- After 015. Review/authorize before production application.
-- Existing balances, purchases, protections and activity history are preserved.
begin;
set local lock_timeout='5s';
set local statement_timeout='45s';

alter table public.economy_rules alter column weekly_kit_limit drop not null;
alter table public.economy_rules alter column weekly_kit_limit set default null;
alter table public.economy_rules alter column kit_price set default 250;
do $$ begin
 if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='economy_rules' and column_name='monthly_free_kits') then
  alter table public.economy_rules add column monthly_free_kits integer not null default 2 check(monthly_free_kits between 0 and 100);
  -- Transition once. Reapplying the migration must not reset later admin settings.
  update public.economy_rules set kit_price=250,weekly_kit_limit=null where singleton;
 end if;
end $$;

alter table public.medical_kits alter column purchase_id drop not null;
alter table public.medical_kits add column if not exists grant_month date;
alter table public.medical_kits add column if not exists grant_slot integer;
do $$ begin
 if not exists(select 1 from pg_constraint where conrelid='public.medical_kits'::regclass and conname='medical_kits_origin') then
  alter table public.medical_kits add constraint medical_kits_origin check(
   (purchase_id is not null and grant_month is null and grant_slot is null) or
   (purchase_id is null and grant_month is not null and grant_month=date_trunc('month',grant_month)::date and grant_slot is not null and grant_slot between 1 and 100));
 end if;
end $$;
create unique index if not exists medical_kits_monthly_grant on public.medical_kits(user_id,grant_month,grant_slot) where grant_month is not null;

-- Expired monthly items remain in the audit history, but cannot be consumed.
create or replace function public.economy_available_kits(p_user uuid,p_day date) returns setof public.medical_kits
language sql stable security definer set search_path=public,pg_temp as $$
 select * from medical_kits where user_id=p_user and used_on is null
 and (purchase_id is not null or grant_month=date_trunc('month',p_day)::date);
$$;

-- Private helper: account -> wallet lock order; unique slots protect retries/devices.
-- p_day is supplied exclusively by server RPCs using the account's fixed timezone.
create or replace function public.economy_grant_monthly_kits(p_user uuid,p_day date) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare quota integer; inserted_count integer;
begin
 if p_day is null then raise exception 'Data mensal inválida.';end if;
 perform 1 from training_accounts where user_id=p_user for update;
 if not found then raise exception 'Configure sua semana antes de consultar os kits.';end if;
 insert into coin_wallets(user_id) values(p_user) on conflict do nothing;
 perform 1 from coin_wallets where user_id=p_user for update;
 select monthly_free_kits into quota from economy_rules where singleton;
 insert into medical_kits(user_id,grant_month,grant_slot)
 select p_user,date_trunc('month',p_day)::date,n from generate_series(1,quota) n on conflict do nothing;
 get diagnostics inserted_count=row_count;
 if inserted_count>0 then update coin_wallets set revision=revision+1 where user_id=p_user;end if;
end $$;

create or replace function public.economy_state(p_user uuid) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
 with account as (
  select w.*,a.time_zone,(now() at time zone a.time_zone)::date today
  from coin_wallets w join training_accounts a using(user_id) where w.user_id=p_user
 ), inventory as (
  select count(*) total,count(*) filter(where purchase_id is null) free_count,
   count(*) filter(where purchase_id is not null) purchased_count
  from economy_available_kits(p_user,(select today from account))
 )
 select jsonb_build_object('revision',a.revision,'balance',a.balance,'kits',i.total,
 'today',a.today,'timezone',a.time_zone,
 -- Old installed clients require a number. Seven is the natural daily maximum,
 -- not an enforced weekly quota. New clients use kitUsageLimit='inventory'.
 'kitsUsedThisWeek',(select count(*) from medical_kits where user_id=p_user and used_on>=date_trunc('week',a.today)::date and used_on<date_trunc('week',a.today)::date+7),
 'monthlyKits',jsonb_build_object('month',date_trunc('month',a.today)::date,
  'renewsOn',(date_trunc('month',a.today)+interval '1 month')::date,'allowance',r.monthly_free_kits,
  'freeAvailable',i.free_count,'purchasedAvailable',i.purchased_count),
 'protections',coalesce((select jsonb_agg(jsonb_build_object('id',id,'day',used_on,'usedAt',used_at) order by used_on desc) from medical_kits where user_id=p_user and used_on is not null),'[]'::jsonb),
 'rules',jsonb_build_object('workoutReward',r.workout_reward,'weightReward',r.weight_reward,'kitPrice',r.kit_price,
  'weeklyKitLimit',coalesce(r.weekly_kit_limit,7),'kitUsageLimit','inventory'),
 'history',economy_history(p_user))
 from account a cross join inventory i cross join economy_rules r where r.singleton;
$$;

create or replace function public.get_economy_state(p_timezone text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid();d date;
begin
 perform get_training_state(p_timezone);
 select (now() at time zone time_zone)::date into d from training_accounts where user_id=u for update;
 perform economy_grant_monthly_kits(u,d);
 return economy_state(u);
end $$;

create or replace function public.buy_medical_kit(p_request_id uuid,p_timezone text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid();price integer;movement_id bigint;d date;
begin
 if p_request_id is null then raise exception 'Identificador de compra inválido.';end if;
 perform get_training_state(p_timezone);
 select (now() at time zone time_zone)::date into d from training_accounts where user_id=u for update;
 perform economy_grant_monthly_kits(u,d);
 -- Retry returns the original purchase, including purchases at the previous price.
 if exists(select 1 from coin_movements where user_id=u and source_key='kit:'||p_request_id::text) then return economy_state(u);end if;
 select kit_price into price from economy_rules where singleton;
 if (select balance from coin_wallets where user_id=u)<price then raise exception 'Saldo insuficiente para comprar o Kit Médico.';end if;
 movement_id:=economy_post(u,'kit:'||p_request_id::text,'kit-purchase','Compra de Kit Médico',-price,d);
 insert into medical_kits(user_id,purchase_id) values(u,movement_id);
 return economy_state(u);
end $$;

create or replace function public.use_medical_kit(p_day date,p_timezone text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid();a training_accounts;k medical_kits;d date;g record;
begin
 perform get_training_state(p_timezone);
 select * into a from training_accounts where user_id=u for update;
 d:=(now() at time zone a.time_zone)::date;
 if p_day is distinct from d then raise exception 'O Kit Médico protege apenas hoje, antes de o dia terminar.';end if;
 if exists(select 1 from medical_kits where user_id=u and used_on=d) then
  perform economy_grant_monthly_kits(u,d);
  return economy_state(u);
 end if;
 if training_day_kind(u,d)<>'training' then raise exception 'Hoje já está protegido por um descanso.';end if;
 if exists(select 1 from workout_days where user_id=u and day=d) then raise exception 'Você já registrou o treino de hoje.';end if;
 perform economy_grant_monthly_kits(u,d);
 -- Consume the expiring monthly allowance before purchased, non-expiring stock.
 select * into k from economy_available_kits(u,d)
  order by (purchase_id is not null),acquired_at,id limit 1;
 if not found then raise exception 'Você não tem um Kit Médico disponível.';end if;
 -- The account/wallet locks serialize consumption with all other device requests.
 update medical_kits set used_on=d,used_at=clock_timestamp() where id=k.id and used_on is null;
 update coin_wallets set revision=revision+1 where user_id=u;
 update training_accounts set revision=revision+1 where user_id=u;
 for g in select group_id from group_members where user_id=u order by group_id loop perform social_refresh_day(g.group_id);end loop;
 return economy_state(u);
end $$;

revoke all on function public.economy_available_kits(uuid,date),public.economy_grant_monthly_kits(uuid,date),public.economy_state(uuid) from public,anon,authenticated;
revoke all on function public.get_economy_state(text),public.buy_medical_kit(uuid,text),public.use_medical_kit(date,text) from public,anon,authenticated;
grant execute on function public.get_economy_state(text),public.buy_medical_kit(uuid,text),public.use_medical_kit(date,text) to authenticated;
notify pgrst,'reload schema';
commit;
