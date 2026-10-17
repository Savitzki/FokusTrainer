-- Independent immutable weigh-ins; old daily rows remain intact for audit.
begin;
set local lock_timeout='5s';
set local statement_timeout='45s';
create table if not exists public.weight_entries (
 user_id uuid not null references auth.users(id) on delete cascade,
 id uuid not null,
 day date not null check(day>=date '2000-01-01'),
 kg numeric(4,1) not null check(kg between 20 and 500),
 recorded_at timestamptz not null,
 confirmed_at timestamptz not null default clock_timestamp(),
 legacy_day date,
 primary key(user_id,id),
 unique(user_id,legacy_day),
 check(legacy_day is null or legacy_day=day)
);
create index if not exists weight_entries_history on public.weight_entries(user_id,day,recorded_at,id);
alter table public.weight_entries enable row level security;
revoke all on public.weight_entries from public,anon,authenticated;
create or replace function public.legacy_weight_id(p_day date) returns uuid
language sql immutable set search_path=public,pg_temp as $$
 select ('00000000-0000-4000-8000-'||to_char(p_day,'YYYYMMDD')||'0000')::uuid;
$$;
-- A legacy row has only the last saved timestamp, not its original measurement time.
-- Install rewards AFTER this copy, and exclude legacy rows on every reapplication.
insert into public.weight_entries(user_id,id,day,kg,recorded_at,confirmed_at,legacy_day)
 select user_id,legacy_weight_id(day),day,kg,updated_at,updated_at,day from public.weight_logs where kg is not null
 on conflict do nothing;

create or replace function public.economy_weight_entry_reward() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare tz text; reward integer;
begin
 if new.legacy_day is not null then return new; end if;
 select time_zone into tz from training_accounts where user_id=new.user_id;
 if tz is null or new.day<>(now() at time zone tz)::date then return new; end if;
 -- Existing daily records/imports already represent that day's first weigh-in.
 if exists(select 1 from weight_logs where user_id=new.user_id and day=new.day)
 or exists(select 1 from weight_entries where user_id=new.user_id and legacy_day=new.day) then return new; end if;
 select weight_reward into reward from economy_rules where singleton;
 perform economy_post(new.user_id,'weight:'||new.day::text,'weight','Peso registrado',reward,new.day);
 return new;
end $$;
drop trigger if exists economy_weight_entry_reward on public.weight_entries;
create trigger economy_weight_entry_reward after insert on public.weight_entries for each row execute function public.economy_weight_entry_reward();

create or replace function public.sync_weight_entries(p_user_id uuid,p_entries jsonb,p_timezone text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); item jsonb; d date; amount numeric; entry_id uuid; stamp timestamptz;
 tz text; saved weight_entries; accepted jsonb:='[]'; is_legacy boolean;
begin
 if u is null or p_user_id is distinct from u then raise exception 'Entre novamente na sua conta.'; end if;
 if p_entries is null or jsonb_typeof(p_entries)<>'array' or jsonb_array_length(p_entries)>100 then raise exception 'Lote de pesagens inválido.'; end if;
 perform get_training_state(p_timezone);
 -- Same lock order as rewards/kits. Two devices may append independently.
 select time_zone into tz from training_accounts where user_id=u for update;
 for item in select value from jsonb_array_elements(p_entries) loop
  entry_id:=(item->>'id')::uuid; d:=(item->>'date')::date;
  amount:=(item->>'kg')::numeric; stamp:=(item->>'recordedAt')::timestamptz;
  if entry_id is null or d is null or d<date '2000-01-01' or d>(now() at time zone tz)::date
   or amount is null or amount<20 or amount>500 or amount<>round(amount,1)
   or stamp is null or not isfinite(stamp) or stamp<timestamptz '2000-01-01' or stamp>clock_timestamp()+interval '5 minutes'
  then raise exception 'Peso, data ou horário inválidos. Confira o relógio do aparelho.'; end if;
  select * into saved from weight_entries where user_id=u and id=entry_id;
  if found then
   -- A repeated identifier may acknowledge, but never update, a saved value.
   if saved.day=d and saved.kg=amount and (saved.recorded_at=stamp or saved.legacy_day is not null)
    then accepted:=accepted||to_jsonb(entry_id::text); end if;
   continue;
  end if;
  -- Recognize an old request that succeeded before the migration but lost its response.
  if exists(select 1 from weight_logs where user_id=u and day=d and mutation_id=entry_id and kg=amount) then
   accepted:=accepted||to_jsonb(entry_id::text); continue;
  end if;
  is_legacy:=entry_id=legacy_weight_id(d);
  -- Do not resurrect legacy deletion markers when importing an old offline cache.
  if is_legacy and exists(select 1 from weight_logs where user_id=u and day=d and kg is null) then
   accepted:=accepted||to_jsonb(entry_id::text); continue;
  end if;
  insert into weight_entries(user_id,id,day,kg,recorded_at,legacy_day)
   values(u,entry_id,d,amount,stamp,case when is_legacy then d end);
  accepted:=accepted||to_jsonb(entry_id::text);
 end loop;
 return jsonb_build_object('applied',accepted,'records',coalesce((select jsonb_agg(jsonb_build_object(
  'id',id,'date',day,'kg',kg,'recordedAt',recorded_at,'confirmedAt',confirmed_at) order by day,recorded_at,id)
  from weight_entries where user_id=u),'[]'::jsonb));
end $$;

-- Old installed clients may read their legacy cache, but cannot edit/delete rows.
create or replace function public.sync_weights(p_user_id uuid,p_changes jsonb,p_timezone text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null or p_user_id is distinct from auth.uid() then raise exception 'Entre novamente na sua conta.'; end if;
 if p_changes is null or jsonb_typeof(p_changes)<>'array' then raise exception 'Lote de pesos inválido.'; end if;
 if jsonb_array_length(p_changes)>0 then raise exception 'Os pesos agora são registros independentes e não podem ser alterados. Atualize o app para sincronizar suas pesagens.'; end if;
 return economy_base_sync_weights(p_user_id,p_changes,p_timezone);
end $$;
revoke all on function public.legacy_weight_id(date),public.economy_weight_entry_reward() from public,anon,authenticated;
revoke all on function public.sync_weight_entries(uuid,jsonb,text),public.sync_weights(uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.sync_weight_entries(uuid,jsonb,text),public.sync_weights(uuid,jsonb,text) to authenticated;
notify pgrst, 'reload schema';
commit;
