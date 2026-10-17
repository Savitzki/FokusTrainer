-- Incremental, no data backfill. Apply only after 011 and explicit production authorization.
begin;
set local lock_timeout='5s';
set local statement_timeout='45s';
create table if not exists public.training_reschedules (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.training_accounts(user_id) on delete cascade,
 original_day date not null,
 target_day date not null,
 week_start date not null,
 created_at timestamptz not null default clock_timestamp(),
 revision integer not null check(revision>0),
 unique(user_id,original_day),
 unique(user_id,target_day),
 check(week_start=original_day-(extract(isodow from original_day)::integer-1)),
 check(target_day>original_day and target_day<week_start+7)
);
create index if not exists training_reschedules_week on public.training_reschedules(user_id,week_start);
alter table public.training_reschedules enable row level security;
revoke all on public.training_reschedules from public,anon,authenticated;
create or replace function public.training_reschedule_limit() returns integer
language sql immutable set search_path=public,pg_temp as $$ select 2; $$;
-- Schedule alone, before extra rest / kits. Compensation remains 'training' in SQL
-- so the existing group scoring, protection and push functions keep their contract.
create or replace function public.training_schedule_kind(p_user uuid,p_day date,
 p_plan_cutoff timestamptz default 'infinity',p_swap_cutoff timestamptz default 'infinity')
returns text language sql stable security definer set search_path=public,pg_temp as $$
 select case
 when exists(select 1 from training_reschedules where user_id=p_user and original_day=p_day and created_at<p_swap_cutoff) then 'rescheduled-rest'
 when exists(select 1 from training_reschedules where user_id=p_user and target_day=p_day and created_at<p_swap_cutoff) then 'training'
 when extract(isodow from p_day)::integer=any(coalesce((select training_days from training_plans
  where user_id=p_user and effective_on<=p_day and created_at<=p_plan_cutoff order by effective_on desc,revision desc limit 1),array[1,2,3,4,5,6,7])) then 'training'
 else 'scheduled-rest' end;
$$;
create or replace function public.training_day_kind(p_user uuid,p_day date,
 p_plan_cutoff timestamptz default 'infinity',p_rest_cutoff timestamptz default 'infinity')
returns text language sql stable security definer set search_path=public,pg_temp as $$
 select case
 when exists(select 1 from medical_kits where user_id=p_user and used_on=p_day and used_at<p_rest_cutoff) then 'medical-kit'
 when exists(select 1 from training_extra_rests where user_id=p_user and day=p_day and authorized_at<p_rest_cutoff) then 'extra-rest'
 else training_schedule_kind(p_user,p_day,p_plan_cutoff,p_rest_cutoff) end;
$$;
create or replace function public.training_state(p_user uuid) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('revision',a.revision,'timezone',a.time_zone,'today',(now() at time zone a.time_zone)::date,
 'startedOn',a.started_on,'weeklyExtraLimit',training_extra_rest_limit(),'weeklyRescheduleLimit',training_reschedule_limit(),
 'plans',coalesce((select jsonb_agg(jsonb_build_object('revision',p.revision,'effectiveFrom',p.effective_on,'trainingDays',p.training_days) order by p.revision) from training_plans p where p.user_id=a.user_id),'[]'::jsonb),
 'extraRests',coalesce((select jsonb_agg(r.day order by r.day) from training_extra_rests r where r.user_id=a.user_id),'[]'::jsonb),
 'medicalRests',coalesce((select jsonb_agg(k.used_on order by k.used_on) from medical_kits k where k.user_id=a.user_id and k.used_on is not null),'[]'::jsonb),
 'reschedules',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'originalDay',r.original_day,'targetDay',r.target_day,'weekStart',r.week_start,'createdAt',r.created_at,'revision',r.revision) order by r.original_day) from training_reschedules r where r.user_id=a.user_id),'[]'::jsonb))
 from training_accounts a where a.user_id=p_user;
$$;
-- Only genuinely new accounts get a default 5/2 plan. Existing rows/versions stay unchanged.
create or replace function public.get_training_state(p_timezone text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); inserted_user uuid; d date;
begin
 if u is null then raise exception 'Entre na conta para configurar sua semana.'; end if;
 if not exists(select 1 from pg_timezone_names where name=p_timezone) then raise exception 'Fuso inválido.'; end if;
 d:=(now() at time zone p_timezone)::date;
 insert into training_accounts(user_id,time_zone,started_on) values(u,p_timezone,d) on conflict do nothing returning user_id into inserted_user;
 if inserted_user is not null then
  insert into training_plans(user_id,revision,effective_on,training_days) values(u,1,d+1,array[1,2,3,4,5]);
  update training_accounts set revision=1 where user_id=u;
 end if;
 return training_state(u);
end $$;
create or replace function public.save_training_plan(p_training_days integer[],p_revision integer,p_timezone text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); a training_accounts; today_value date; monday date; before_count integer; after_count integer;
begin
 perform get_training_state(p_timezone);
 select * into a from training_accounts where user_id=u for update;
 if p_revision is distinct from a.revision then raise exception 'Sua programação mudou em outro aparelho. Atualize e tente novamente.'; end if;
 if p_training_days is null or cardinality(p_training_days)<>5 or
  (select count(distinct d) from unnest(p_training_days) d where d between 1 and 7)<>5
 then raise exception 'Escolha exatamente 5 dias de treino e 2 de descanso.'; end if;
 today_value:=(clock_timestamp() at time zone a.time_zone)::date;
 monday:=today_value-(extract(isodow from today_value)::integer-1);
 -- Confirmed swaps cannot be invalidated by a later permanent edit.
 if exists(select 1 from training_reschedules r where r.user_id=u and (
  (r.original_day>today_value and not extract(isodow from r.original_day)::integer=any(p_training_days)) or
  (r.target_day>today_value and extract(isodow from r.target_day)::integer=any(p_training_days))))
 then raise exception 'Essa programação conflita com um reagendamento confirmado. Preserve os dias envolvidos.'; end if;
 select count(*) into before_count from generate_series(0,6) n where training_schedule_kind(u,monday+n)='training';
 select count(*) into after_count from generate_series(0,6) n where case
  when exists(select 1 from training_reschedules r where r.user_id=u and r.original_day=monday+n) then false
  when exists(select 1 from training_reschedules r where r.user_id=u and r.target_day=monday+n) then true
  when monday+n>today_value then extract(isodow from monday+n)::integer=any(p_training_days)
  else training_schedule_kind(u,monday+n)='training' end;
 -- Legacy/first partial weeks are preserved, never retroactively normalized.
 if before_count=5 and after_count<>5 then
  raise exception 'A mudança deixaria esta semana com % treinos. Preserve os dias já passados ou use Reagendar treino.',after_count;
 end if;
 insert into training_plans(user_id,revision,effective_on,training_days)
 values(u,a.revision+1,today_value+1,array(select d from unnest(p_training_days) d order by d));
 update training_accounts set revision=revision+1 where user_id=u;
 return training_state(u);
end $$;
create or replace function public.reschedule_training(p_original_day date,p_target_day date,p_revision integer,p_timezone text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); a training_accounts; today_value date; monday date; planned integer; g streak_groups; d date;
begin
 perform get_training_state(p_timezone);
 select * into a from training_accounts where user_id=u for update;
 -- Repeating the identical successful request is safe after a lost response.
 if exists(select 1 from training_reschedules where user_id=u and original_day=p_original_day and target_day=p_target_day) then return training_state(u); end if;
 if p_revision is distinct from a.revision then raise exception 'Sua programação mudou em outro aparelho. Atualize e tente novamente.'; end if;
 today_value:=(clock_timestamp() at time zone a.time_zone)::date;
 monday:=p_original_day-(extract(isodow from p_original_day)::integer-1);
 if p_original_day is null or p_target_day is null or p_original_day<today_value or p_target_day<=p_original_day or p_target_day>=monday+7
 then raise exception 'Escolha um descanso posterior ao treino, na mesma semana, antes de encerrar o dia original.'; end if;
 if (select count(*) from training_reschedules where user_id=u and week_start=monday)>=training_reschedule_limit()
 then raise exception 'Você já usou os 2 reagendamentos desta semana.'; end if;
 if exists(select 1 from training_reschedules where user_id=u and (original_day in(p_original_day,p_target_day) or target_day in(p_original_day,p_target_day)))
 then raise exception 'Uma dessas datas já participa de um reagendamento.'; end if;
 select count(*) into planned from generate_series(0,6) n where training_schedule_kind(u,monday+n)='training';
 if planned<>5 then raise exception 'Configure uma semana com 5 treinos e 2 descansos antes de reagendar.'; end if;
 if training_day_kind(u,p_original_day)<>'training' or training_day_kind(u,p_target_day)<>'scheduled-rest'
 then raise exception 'Troque um treino obrigatório por um descanso programado disponível.'; end if;
 if exists(select 1 from workout_days where user_id=u and day in(p_original_day,p_target_day))
 then raise exception 'Uma dessas datas já tem treino confirmado.'; end if;
 -- Lock groups in the same order as confirmation/rest RPCs. Freeze completed,
 -- checked and closed dates, including groups whose timezone has already advanced.
 for g in select s.* from streak_groups s join group_members m on m.group_id=s.id
  where m.user_id=u and m.status='accepted' and s.status='active' order by s.id for update of s loop
  foreach d in array array[p_original_day,p_target_day] loop
   if exists(select 1 from group_days where group_id=g.id and day=d)
    or d<=g.training_checked_through
    or clock_timestamp()>=((d+1)::timestamp at time zone g.time_zone)
    or exists(select 1 from workout_days w where w.user_id=u and (w.confirmed_at at time zone g.time_zone)::date=d)
   then raise exception 'Uma dessas datas já encerrou ou foi consolidada na Arena. O resultado do grupo será preservado.'; end if;
  end loop;
 end loop;
 insert into training_reschedules(user_id,original_day,target_day,week_start,revision)
  values(u,p_original_day,p_target_day,monday,a.revision+1);
 update training_accounts set revision=revision+1 where user_id=u;
 for g in select s.* from streak_groups s join group_members m on m.group_id=s.id
  where m.user_id=u and m.status='accepted' and s.status='active' order by s.id loop perform social_refresh_day(g.id); end loop;
 return training_state(u);
end $$;

do $$ begin
 if to_regprocedure('public.reschedule_base_social_state()') is null then
  alter function public.get_social_state() rename to reschedule_base_social_state;
 end if;
end $$;
create or replace function public.get_social_state() returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=social_require_profile(); payload jsonb; groups_value jsonb:='[]'; item jsonb; g streak_groups; d date; members_value jsonb;
begin
 payload:=reschedule_base_social_state();
 for item in select value from jsonb_array_elements(payload->'groups') loop
  select * into g from streak_groups where id=(item->>'id')::uuid;
  d:=(now() at time zone g.time_zone)::date;
  select coalesce(jsonb_agg(m||jsonb_build_object(
   'rescheduledTo',(select target_day from training_reschedules where user_id=(m->>'id')::uuid and original_day=d and (m->>'accepted')::boolean and g.status='active' and created_at<((d+1)::timestamp at time zone g.time_zone)),
   'rescheduledFrom',(select original_day from training_reschedules where user_id=(m->>'id')::uuid and target_day=d and (m->>'accepted')::boolean and g.status='active' and created_at<((d+1)::timestamp at time zone g.time_zone)))),'[]')
   into members_value from jsonb_array_elements(item->'members') m;
  groups_value:=groups_value||jsonb_build_array(item||jsonb_build_object('members',members_value));
 end loop;
 return jsonb_set(payload,'{groups}',groups_value);
end $$;
revoke all on function public.training_reschedule_limit(),public.training_schedule_kind(uuid,date,timestamptz,timestamptz),public.reschedule_base_social_state(),public.training_state(uuid),public.training_day_kind(uuid,date,timestamptz,timestamptz) from public,anon,authenticated;
revoke all on function public.reschedule_training(date,date,integer,text),public.get_social_state(),public.get_training_state(text),public.save_training_plan(integer[],integer,text) from public,anon,authenticated;
grant execute on function public.reschedule_training(date,date,integer,text),public.get_social_state(),public.get_training_state(text),public.save_training_plan(integer[],integer,text) to authenticated;
notify pgrst, 'reload schema';
commit;
