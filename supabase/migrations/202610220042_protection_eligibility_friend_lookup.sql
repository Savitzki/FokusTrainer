-- New protection eligibility and code lookup. No historical rows are rewritten.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
alter table public.economy_rules add column medical_protection_started_at timestamptz not null default clock_timestamp();

-- Read the same confirmed mandatory-day/snapshot classifications as gf_streak.
-- Never call gf_day/gf_streak from daily closing: those settle the account themselves.
create function public.medical_has_streak_before(p_user uuid,p_day date) returns boolean
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare d date; tz text; first_day date; kind_value text; done boolean;
begin
 select time_zone,gf_tracking_start(p_user) into tz,first_day from training_accounts where user_id=p_user;
 if not found or first_day>=p_day then return false;end if;
 d:=p_day-1;
 while d>=first_day loop
  select kind,completed into kind_value,done from gf_days where user_id=p_user and day=d;
  if not found then
   kind_value:=training_day_kind(p_user,d,d::timestamp at time zone tz,(d+1)::timestamp at time zone tz);
   done:=exists(select 1 from workout_days where user_id=p_user and day=d and confirmed_at<(d+1)::timestamp at time zone tz
     and confirmed_at<clock_timestamp()+interval '1 second');
  end if;
  if kind_value in('training','compensatory') then return done;end if;
  d:=d-1;
 end loop;
 return false;
end $$;
create function public.medical_protection_reason(p_user uuid,p_day date) returns text
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if not medical_has_streak_before(p_user,p_day) then return 'Você precisa de uma ofensiva ativa para usar um Kit Médico.';end if;
 if exists(select 1 from medical_kits where user_id=p_user and used_on=p_day-1) then
  return 'Não é possível usar Kits Médicos em dias seguidos.';
 end if;
 return null;
end $$;

create or replace function public.use_medical_kit(p_day date,p_timezone text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid();a training_accounts;k medical_kits;d date;g record;reason text;
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
 reason:=medical_protection_reason(u,d);
 if reason is not null then raise exception '%',reason;end if;
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

create or replace function public.medical_auto_close_account(p_user uuid) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
declare a training_accounts; activation timestamptz; d date; last_day date; batch_end date; closed_at timestamptz; k medical_kits;
begin
 select * into a from training_accounts where user_id=p_user;
 if not found then return true;end if;
 select medical_auto_started_at into activation from economy_rules where singleton;
 last_day:=(clock_timestamp() at time zone a.time_zone)::date-1;
 d:=greatest(a.started_on,(activation at time zone a.time_zone)::date,coalesce(a.medical_checked_through+1,a.started_on));
 if d>last_day then return true;end if;
 select * into a from training_accounts where user_id=p_user for update skip locked;
 if not found then return false;end if;
 -- Recheck after the account lock; another device/cron may have closed the day.
 d:=greatest(a.started_on,(activation at time zone a.time_zone)::date,coalesce(a.medical_checked_through+1,a.started_on));
 batch_end:=least(last_day,d+61);
 while d<=batch_end loop
  closed_at:=(d+1)::timestamp at time zone a.time_zone;
  if training_day_kind(p_user,d,d::timestamp at time zone a.time_zone,closed_at)='training'
    and not exists(select 1 from workout_days where user_id=p_user and day=d)
    and not exists(select 1 from gf_days where user_id=p_user and day=d)
    and (d<(select (medical_protection_started_at at time zone a.time_zone)::date from economy_rules where singleton)
         or medical_protection_reason(p_user,d) is null) then
   perform economy_grant_monthly_kits(p_user,d);
   select * into k from economy_available_kits(p_user,d)
    where purchase_id is null or acquired_at<closed_at
    order by (purchase_id is not null),acquired_at,id limit 1;
   if found then
    update medical_kits set used_on=d,used_at=clock_timestamp(),automatic=true,day_closed_at=closed_at where id=k.id and used_on is null;
    update coin_wallets set revision=revision+1 where user_id=p_user;
    update training_accounts set revision=revision+1 where user_id=p_user;
   end if;
  end if;
  d:=d+1;
 end loop;
 update training_accounts set medical_checked_through=greatest(coalesce(medical_checked_through,batch_end),batch_end) where user_id=p_user;
 return batch_end>=last_day;
end $$;

-- Preserve the complete existing response, including automatic notices and balances.
alter function public.economy_state(uuid) rename to protection_base_economy_state;
create function public.economy_state(p_user uuid) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
 with data as(select protection_base_economy_state(p_user) value),
 eligibility as(select value,medical_protection_reason(p_user,(value->>'today')::date) reason from data)
 select value||jsonb_build_object('kitEligibility',jsonb_build_object('allowed',reason is null,'reason',reason)) from eligibility;
$$;

-- A code is an existing private invitation token. Return exactly the same safe
-- public fields/relationship as nickname lookup, never email or other private data.
create function public.find_friend_by_code(p_code uuid) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare u uuid:=social_require_profile(); n text;
begin
 select nickname into n from profiles where friend_code=p_code;
 if not found then return null;end if;
 return find_friend_by_nickname(n);
end $$;
revoke all on function public.medical_has_streak_before(uuid,date),public.medical_protection_reason(uuid,date),
 public.protection_base_economy_state(uuid),public.economy_state(uuid),public.find_friend_by_code(uuid) from public,anon,authenticated;
grant execute on function public.find_friend_by_code(uuid) to authenticated;
-- Existing use/closing RPC grants are preserved by CREATE OR REPLACE.
notify pgrst,'reload schema';
commit;
