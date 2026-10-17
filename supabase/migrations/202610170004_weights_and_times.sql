-- Apply after migrations 001, 002 and 003. Safe to run again.
begin;
create table if not exists public.weight_logs (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null check (day >= date '2000-01-01'),
  kg numeric(4,1) check (kg between 20 and 500),
  revision bigint not null check (revision > 0),
  mutation_id uuid not null,
  updated_at timestamptz not null default now(),
  primary key (user_id,day)
);
alter table public.weight_logs enable row level security;
revoke all on public.weight_logs from public, anon, authenticated;
-- Null kg is a deletion marker. Retaining it prevents offline devices from
-- resurrecting a deleted entry. Revisions, never client clocks, resolve edits.
create or replace function public.sync_weights(p_user_id uuid, p_changes jsonb, p_timezone text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid := auth.uid(); item jsonb; d date; amount numeric; base bigint; mid uuid;
  row_value weight_logs; accepted jsonb := '[]'::jsonb;
begin
  if u is null or p_user_id is distinct from u then raise exception 'Entre novamente na sua conta.'; end if;
  if not exists(select 1 from pg_timezone_names where name=p_timezone) then raise exception 'Fuso inválido.'; end if;
  if p_changes is null or jsonb_typeof(p_changes)<>'array' or jsonb_array_length(p_changes)>100 then
    raise exception 'Lote de pesos inválido.';
  end if;
  -- Lock in date order, including concurrent first inserts on the same date.
  for item in select value from jsonb_array_elements(p_changes) order by value->>'date' loop
    d := (item->>'date')::date; amount := (item->>'kg')::numeric;
    base := (item->>'baseVersion')::bigint; mid := (item->>'mutationId')::uuid;
    if d is null or d < date '2000-01-01' or d > (now() at time zone p_timezone)::date
       or base is null or base<0 or mid is null or not(item ? 'kg')
       or (amount is not null and (amount<20 or amount>500 or amount<>round(amount,1))) then
      raise exception 'Peso ou data inválidos.';
    end if;
    perform pg_advisory_xact_lock(hashtextextended(u::text || ':' || d::text,0));
    select * into row_value from weight_logs where user_id=u and day=d for update;
    if found then
      if row_value.mutation_id=mid then
        accepted := accepted || to_jsonb(mid::text);
      elsif row_value.revision=base then
        update weight_logs set kg=amount,revision=revision+1,mutation_id=mid,updated_at=clock_timestamp()
          where user_id=u and day=d;
        accepted := accepted || to_jsonb(mid::text);
      end if;
    elsif base=0 then
      insert into weight_logs(user_id,day,kg,revision,mutation_id) values(u,d,amount,1,mid);
      accepted := accepted || to_jsonb(mid::text);
    end if;
  end loop;
  return jsonb_build_object('applied',accepted,'records',coalesce((
    select jsonb_agg(jsonb_build_object('date',day,'kg',kg,'version',revision,'updatedAt',updated_at) order by day)
    from weight_logs where user_id=u),'[]'::jsonb));
end $$;
revoke all on function public.sync_weights(uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.sync_weights(uuid,jsonb,text) to authenticated;

-- The server confirmation time remains immutable and determines group credit.
create or replace function public.get_social_state() returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare u uuid := social_require_profile(); result jsonb;
begin
  select jsonb_build_object(
    'code',(select friend_code from profiles where id=u),
    'workouts',coalesce((select jsonb_agg(jsonb_build_object('id',id,'date',day,'activity',activity,'minutes',minutes,'confirmedAt',confirmed_at) order by day) from workout_days where user_id=u),'[]'::jsonb),
    'friends',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'nickname',p.nickname)) from friendships f join profiles p on p.id=case when f.requester=u then f.recipient else f.requester end where (f.requester=u or f.recipient=u) and f.status='accepted'),'[]'::jsonb),
    'requests',coalesce((select jsonb_agg(jsonb_build_object('id',f.id,'nickname',p.nickname,'incoming',f.recipient=u)) from friendships f join profiles p on p.id=case when f.requester=u then f.recipient else f.requester end where (f.requester=u or f.recipient=u) and f.status='pending'),'[]'::jsonb),
    'groups',coalesce((select jsonb_agg(jsonb_build_object(
      'id',g.id,'name',g.name,'timezone',g.time_zone,'status',g.status,
      'invited',me.status='invited','today',(now() at time zone g.time_zone)::date,
      'streak',social_streak(g.id,(now() at time zone g.time_zone)::date),
      'best',social_streak(g.id,(now() at time zone g.time_zone)::date,true),
      'completed',exists(select 1 from group_days d where d.group_id=g.id and d.day=(now() at time zone g.time_zone)::date),
      'completedAt',(select completed_at from group_days where group_id=g.id and day=(now() at time zone g.time_zone)::date),
      'members',(select jsonb_agg(jsonb_build_object('id',p.id,'nickname',p.nickname,'accepted',m.status='accepted','confirmedAt',(select min(w.confirmed_at) from workout_days w where w.user_id=m.user_id and (w.confirmed_at at time zone g.time_zone)::date=(now() at time zone g.time_zone)::date),'trained',exists(select 1 from workout_days w where w.user_id=m.user_id and (w.confirmed_at at time zone g.time_zone)::date=(now() at time zone g.time_zone)::date))) from group_members m join profiles p on p.id=m.user_id where m.group_id=g.id)
    ) order by g.created_at desc) from streak_groups g join group_members me on me.group_id=g.id and me.user_id=u where g.status<>'archived'),'[]'::jsonb)
  ) into result;
  return result;
end $$;


revoke all on function public.get_social_state() from public,anon,authenticated;
grant execute on function public.get_social_state() to authenticated;
commit;

select 'Pronto! Pesos privados sincronizados e horários dos treinos disponíveis.' as resultado;
