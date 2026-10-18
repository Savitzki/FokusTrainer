-- Replace only manual self-report validation. Apply after 023 with production authorization.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

create function public.workout_valid_manual_confirmation(p_confirmation jsonb) returns boolean
language plpgsql immutable set search_path=public,pg_temp as $$
declare ids text[]:=array['real','happened','earned','honest','witness','truth','effort','not-invented','outside-head','flame'];
begin
 if jsonb_typeof(p_confirmation) is distinct from 'object'
  or jsonb_typeof(p_confirmation->'questionIds') is distinct from 'array' then return false;end if;
 return coalesce(p_confirmation->'version'='1'::jsonb
  and jsonb_array_length(p_confirmation->'questionIds')=2
  and jsonb_typeof(p_confirmation->'questionIds'->0)='string'
  and jsonb_typeof(p_confirmation->'questionIds'->1)='string'
  and (p_confirmation->'questionIds'->>0)=any(ids)
  and (p_confirmation->'questionIds'->>1)=any(ids)
  and (p_confirmation->'questionIds'->>0)<>(p_confirmation->'questionIds'->>1)
  and p_confirmation->'answers'='[true,true,true]'::jsonb
  and (p_confirmation-array['version','questionIds','answers'])='{}'::jsonb,false);
end $$;

-- One essential fact; no negative answers, raw prompts or fabricated intensity scores.
alter table public.workout_days
 add column manual_confirmed boolean not null default false,
 drop constraint workout_manual_review,
 add constraint workout_manual_confirmation check(recording_method<>'manual' or review is not null or manual_confirmed),
 add constraint workout_manual_confirmation_method check(not manual_confirmed or recording_method='manual');

create or replace function public.workout_record_json(p_workout public.workout_days) returns jsonb
language sql stable set search_path=public,pg_temp as $$
 select jsonb_build_object('id',p_workout.id,'date',p_workout.day,'activity',p_workout.activity,
  'minutes',p_workout.minutes,'confirmedAt',p_workout.confirmed_at,
  'method',p_workout.recording_method,'review',p_workout.review,'manualConfirmed',p_workout.manual_confirmed);
$$;

-- Same canonical confirmation, reward trigger and group refresh. Only the new metadata
-- column is populated for a manual confirmation without a historical assessment.
-- This helper stays private; the public RPC below validates the declaration first.
create or replace function public.workout_confirm(p_user uuid,p_day date,p_activity text,p_minutes integer,
 p_method text,p_review jsonb,p_request uuid,p_confirmed timestamptz) returns public.workout_days
language plpgsql security definer set search_path=public,pg_temp as $$
declare w workout_days; g record;
begin
 if p_day is distinct from (now() at time zone (select time_zone from training_accounts where user_id=p_user))::date then
  raise exception 'O dia mudou durante a confirmação. Atualize e tente novamente.';end if;
 if exists(select 1 from workout_days where user_id=p_user and day=p_day) then
  raise exception 'O treino de hoje já foi confirmado e não pode ser alterado.';end if;
 insert into workout_days(user_id,day,activity,minutes,recording_method,review,request_id,confirmed_at,manual_confirmed)
 values(p_user,p_day,trim(p_activity),p_minutes,p_method,p_review,p_request,p_confirmed,p_method='manual' and p_review is null) returning * into w;
 for g in select group_id from group_members where user_id=p_user order by group_id loop
  perform social_refresh_day(g.group_id);
 end loop;
 return w;
end $$;

-- Replace the named payload, with no legacy overload accepting the old questionnaire.
drop function public.confirm_manual_workout(uuid,date,text,integer,jsonb,text);
create function public.confirm_manual_workout(p_request_id uuid,p_day date,p_activity text,p_minutes integer,p_confirmation jsonb,p_timezone text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=social_require_profile(); a training_accounts; w workout_days; r workout_recording_rules; t timestamptz;
begin
 if not workout_valid_manual_confirmation(p_confirmation) then
  raise exception 'Responda Sim às três perguntas para confirmar o treino manual.';end if;
 perform get_training_state(p_timezone);
 select * into strict a from training_accounts where user_id=u for update;
 -- Same request can be retried after a timeout or on another device/day.
 select * into w from workout_days where user_id=u and request_id=p_request_id and recording_method='manual';
 if found then return workout_record_json(w);end if;
 perform workout_expire_sessions(u);
 t:=clock_timestamp();
 select * into strict r from workout_recording_rules where singleton;
 if p_request_id is null or p_day is distinct from (t at time zone a.time_zone)::date then
  raise exception 'Só é possível confirmar o treino de hoje.';end if;
 if p_activity is null or length(trim(p_activity)) not between 1 and 80 or p_minutes is null
  or p_minutes<greatest(35,r.minimum_minutes) or p_minutes>1440 then
  raise exception 'Informe uma atividade e pelo menos % minutos inteiros.',greatest(35,r.minimum_minutes);end if;
 if exists(select 1 from workout_sessions where user_id=u and status='active') then
  raise exception 'Finalize ou cancele o treino em andamento antes de registrar manualmente.';end if;
 w:=workout_confirm(u,p_day,p_activity,p_minutes,'manual',null,p_request_id,t);
 return workout_record_json(w);
end $$;
revoke all on function public.workout_valid_manual_confirmation(jsonb),public.confirm_manual_workout(uuid,date,text,integer,jsonb,text) from public,anon,authenticated;
grant execute on function public.confirm_manual_workout(uuid,date,text,integer,jsonb,text) to authenticated;
-- Existing helper ACLs, RLS, timer functions, snapshots and rewards remain unchanged.
notify pgrst,'reload schema';
commit;
