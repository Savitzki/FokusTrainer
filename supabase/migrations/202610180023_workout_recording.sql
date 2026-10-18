-- Two registration methods; existing confirmations, reward triggers and snapshots remain canonical.
-- Apply only after 022 and explicit authorization for production.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

create table public.workout_recording_rules (
 singleton boolean primary key default true check(singleton),
 minimum_minutes integer not null default 35 check(minimum_minutes between 1 and 240),
 maximum_session_minutes integer not null default 240 check(maximum_session_minutes between 1 and 1440),
 check(maximum_session_minutes>minimum_minutes)
);
insert into public.workout_recording_rules(singleton) values(true);
create function public.workout_valid_review(p_review jsonb) returns boolean
language sql immutable set search_path=public,pg_temp as $$
 select coalesce(jsonb_typeof(p_review)='object'
  and jsonb_typeof(p_review->'intensity')='number'
  and (p_review->>'intensity') in('1','2','3','4','5')
  and p_review->>'feeling' in('tired','normal','great')
  and p_review->>'completion' in('full','partial','adapted')
  and p_review ?& array['intensity','feeling','completion']
  and (p_review-array['intensity','feeling','completion'])='{}'::jsonb,false);
$$;
alter table public.workout_days
 add column recording_method text not null default 'legacy' check(recording_method in('legacy','manual','timed')),
 add column review jsonb check(review is null or public.workout_valid_review(review)),
 add column request_id uuid,
 add constraint workout_manual_review check(recording_method<>'manual' or review is not null),
 add constraint workout_request_unique unique(user_id,request_id);
create table public.workout_sessions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.training_accounts(user_id) on delete cascade,
 request_id uuid not null,
 activity text not null check(length(trim(activity)) between 1 and 80),
 time_zone text not null,
 started_at timestamptz not null default clock_timestamp(),
 ended_at timestamptz,
 validated_seconds integer,
 minimum_seconds integer not null check(minimum_seconds>0),
 maximum_seconds integer not null check(maximum_seconds>minimum_seconds),
 status text not null default 'active' check(status in('active','completed','cancelled','expired')),
 workout_id uuid unique references public.workout_days(id),
 unique(user_id,request_id),
 check((status='active' and ended_at is null and validated_seconds is null and workout_id is null)
   or (status='completed' and ended_at>=started_at and validated_seconds>=minimum_seconds
       and validated_seconds<maximum_seconds and workout_id is not null)
   or (status in('cancelled','expired') and ended_at>=started_at and validated_seconds is null and workout_id is null))
);
create unique index workout_one_active_session on public.workout_sessions(user_id) where status='active';
create index workout_sessions_account on public.workout_sessions(user_id,started_at desc,id);
-- No client table writes, even with a forged start time or a guessed session ID.
alter table public.workout_recording_rules enable row level security;
alter table public.workout_sessions enable row level security;
revoke all on public.workout_recording_rules,public.workout_sessions from public,anon,authenticated;

create function public.workout_record_json(p_workout public.workout_days) returns jsonb
language sql stable set search_path=public,pg_temp as $$
 select jsonb_build_object('id',p_workout.id,'date',p_workout.day,'activity',p_workout.activity,
  'minutes',p_workout.minutes,'confirmedAt',p_workout.confirmed_at,
  'method',p_workout.recording_method,'review',p_workout.review);
$$;
create function public.workout_expire_sessions(p_user uuid) returns void
language sql security definer set search_path=public,pg_temp as $$
 update workout_sessions set status='expired',ended_at=started_at+make_interval(secs=>maximum_seconds)
 where user_id=p_user and status='active' and clock_timestamp()>=started_at+make_interval(secs=>maximum_seconds);
$$;
create function public.workout_recording_state(p_user uuid,p_session uuid default null) returns jsonb
language sql security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('serverNow',clock_timestamp(),'today',(clock_timestamp() at time zone a.time_zone)::date,
  'timezone',a.time_zone,'minimumMinutes',r.minimum_minutes,'maximumMinutes',r.maximum_session_minutes,
  'session',(select jsonb_build_object('id',s.id,'activity',s.activity,'startedAt',s.started_at,'endedAt',s.ended_at,
    'validatedSeconds',s.validated_seconds,'minimumSeconds',s.minimum_seconds,'maximumSeconds',s.maximum_seconds,
    'status',s.status,'workout',case when s.workout_id is not null then workout_record_json(w) end)
   from workout_sessions s left join workout_days w on w.id=s.workout_id
   where s.user_id=p_user and (p_session is null or s.id=p_session)
   order by (s.status='active') desc,coalesce(s.ended_at,s.started_at) desc,s.id limit 1))
 from training_accounts a cross join workout_recording_rules r where a.user_id=p_user;
$$;
create function public.get_workout_recording_state(p_timezone text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=social_require_profile();
begin
 perform get_training_state(p_timezone);
 perform 1 from training_accounts where user_id=u for update;
 perform workout_expire_sessions(u);
 return workout_recording_state(u);
end $$;
create function public.start_workout_session(p_request_id uuid,p_activity text,p_timezone text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=social_require_profile(); a training_accounts; s workout_sessions; r workout_recording_rules; t timestamptz;
begin
 perform get_training_state(p_timezone);
 select * into strict a from training_accounts where user_id=u for update;
 perform workout_expire_sessions(u);
 if p_request_id is null or p_activity is null or length(trim(p_activity)) not between 1 and 80 then
  raise exception 'Escolha uma atividade válida.';end if;
 select * into s from workout_sessions where user_id=u and request_id=p_request_id;
 if found then return workout_recording_state(u,s.id);end if;
 select * into s from workout_sessions where user_id=u and status='active';
 if found then return workout_recording_state(u,s.id);end if;
 t:=clock_timestamp();
 if exists(select 1 from workout_days where user_id=u and day=(t at time zone a.time_zone)::date) then
  raise exception 'O treino de hoje já foi confirmado.';end if;
 select * into strict r from workout_recording_rules where singleton;
 insert into workout_sessions(user_id,request_id,activity,time_zone,started_at,minimum_seconds,maximum_seconds)
 values(u,p_request_id,trim(p_activity),a.time_zone,t,r.minimum_minutes*60,r.maximum_session_minutes*60) returning * into s;
 return workout_recording_state(u,s.id);
end $$;

-- The definitive insert still invokes the existing, unique daily coin reward trigger.
create function public.workout_confirm(p_user uuid,p_day date,p_activity text,p_minutes integer,
 p_method text,p_review jsonb,p_request uuid,p_confirmed timestamptz) returns public.workout_days
language plpgsql security definer set search_path=public,pg_temp as $$
declare w workout_days; g record;
begin
 -- A transaction waiting on a lock over midnight must retry rather than straddle
 -- the server-day assumptions in the existing reward/snapshot pipeline.
 if p_day is distinct from (now() at time zone (select time_zone from training_accounts where user_id=p_user))::date then
  raise exception 'O dia mudou durante a confirmação. Atualize e tente novamente.';end if;
 if exists(select 1 from workout_days where user_id=p_user and day=p_day) then
  raise exception 'O treino de hoje já foi confirmado e não pode ser alterado.';end if;
 insert into workout_days(user_id,day,activity,minutes,recording_method,review,request_id,confirmed_at)
 values(p_user,p_day,trim(p_activity),p_minutes,p_method,p_review,p_request,p_confirmed) returning * into w;
 for g in select group_id from group_members where user_id=p_user order by group_id loop
  perform social_refresh_day(g.group_id);
 end loop;
 return w;
end $$;
create function public.confirm_manual_workout(p_request_id uuid,p_day date,p_activity text,p_minutes integer,p_review jsonb,p_timezone text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=social_require_profile(); a training_accounts; w workout_days; r workout_recording_rules; t timestamptz;
begin
 perform get_training_state(p_timezone);
 select * into strict a from training_accounts where user_id=u for update;
 select * into w from workout_days where user_id=u and request_id=p_request_id and recording_method='manual';
 if found then return workout_record_json(w);end if;
 perform workout_expire_sessions(u);
 t:=clock_timestamp();
 select * into strict r from workout_recording_rules where singleton;
 if p_request_id is null or p_day is distinct from (t at time zone a.time_zone)::date then
  raise exception 'Só é possível confirmar o treino de hoje.';end if;
 if p_activity is null or length(trim(p_activity)) not between 1 and 80 or p_minutes is null
  or p_minutes<r.minimum_minutes or p_minutes>1440 then
  raise exception 'Informe uma atividade e pelo menos % minutos inteiros.',r.minimum_minutes;end if;
 if not workout_valid_review(p_review) then raise exception 'Responda às três perguntas para confirmar o treino manual.';end if;
 if exists(select 1 from workout_sessions where user_id=u and status='active') then
  raise exception 'Finalize ou cancele o treino em andamento antes de registrar manualmente.';end if;
 w:=workout_confirm(u,p_day,p_activity,p_minutes,'manual',p_review,p_request_id,t);
 return workout_record_json(w);
end $$;
create function public.finish_workout_session(p_id uuid,p_timezone text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=social_require_profile(); a training_accounts; s workout_sessions; w workout_days; t timestamptz; elapsed integer;
begin
 perform get_training_state(p_timezone);
 select * into strict a from training_accounts where user_id=u for update;
 perform workout_expire_sessions(u);
 select * into s from workout_sessions where id=p_id and user_id=u for update;
 if not found then raise exception 'Treino em andamento não encontrado nesta conta.';end if;
 -- Return the original result after timeouts, including on the following day.
 if s.status<>'active' then return workout_recording_state(u,s.id);end if;
 t:=clock_timestamp();elapsed:=floor(extract(epoch from t-s.started_at));
 if elapsed>=s.maximum_seconds then
  update workout_sessions set status='expired',ended_at=s.started_at+make_interval(secs=>s.maximum_seconds) where id=s.id;
  return workout_recording_state(u,s.id);end if;
 if elapsed<s.minimum_seconds then raise exception 'O tempo mínimo deste treino é de % minutos.',s.minimum_seconds/60;end if;
 if exists(select 1 from workout_days where user_id=u and day=(t at time zone a.time_zone)::date) then
  update workout_sessions set status='cancelled',ended_at=t where id=s.id;
  return workout_recording_state(u,s.id);end if;
 w:=workout_confirm(u,(t at time zone a.time_zone)::date,s.activity,elapsed/60,'timed',null,s.request_id,t);
 update workout_sessions set status='completed',ended_at=t,validated_seconds=elapsed,workout_id=w.id where id=s.id;
 return workout_recording_state(u,s.id);
end $$;
create function public.cancel_workout_session(p_id uuid,p_timezone text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=social_require_profile();
begin
 perform get_training_state(p_timezone);
 perform 1 from training_accounts where user_id=u for update;
 perform workout_expire_sessions(u);
 if not exists(select 1 from workout_sessions where id=p_id and user_id=u) then
  raise exception 'Treino em andamento não encontrado nesta conta.';end if;
 update workout_sessions set status='cancelled',ended_at=clock_timestamp() where id=p_id and user_id=u and status='active';
 return workout_recording_state(u,p_id);
end $$;
create function public.submit_workout_review(p_id uuid,p_review jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=social_require_profile(); w workout_days;
begin
 perform 1 from training_accounts where user_id=u for update;
 select * into w from workout_days where id=p_id and user_id=u for update;
 if not found or w.recording_method<>'timed' then raise exception 'Treino cronometrado não encontrado nesta conta.';end if;
 if not workout_valid_review(p_review) then raise exception 'Responda às três perguntas ou escolha Agora não.';end if;
 if w.review is not null and w.review is distinct from p_review then raise exception 'Esta avaliação já foi salva.';end if;
 update workout_days set review=p_review where id=w.id returning * into w;
 return workout_record_json(w);
end $$;
-- Old clients cannot bypass the minimum duration or mandatory manual review.
create or replace function public.confirm_daily_workout(p_day date,p_activity text,p_minutes integer,p_timezone text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin raise exception 'Atualize o app para escolher o método de registro e avaliar seu treino.';end $$;

alter function public.get_social_state() rename to workout_base_social_state;
create function public.get_social_state() returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=social_require_profile(); result jsonb;
begin
 result:=workout_base_social_state();
 return jsonb_set(result,'{workouts}',coalesce((select jsonb_agg(workout_record_json(w) order by w.day)
  from workout_days w where user_id=u),'[]'::jsonb));
end $$;
alter function public.get_progress_report(text,date,text) rename to workout_base_progress_report;
create function public.get_progress_report(p_period text,p_start date,p_timezone text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); result jsonb; metrics jsonb;
begin
 result:=workout_base_progress_report(p_period,p_start,p_timezone);
 select jsonb_build_object('manual',count(*) filter(where recording_method='manual'),
  'timed',count(*) filter(where recording_method='timed'),'legacy',count(*) filter(where recording_method='legacy'),
  'minutes',coalesce(sum(minutes),0),'evaluated',count(*) filter(where review is not null),
  'averageIntensity',round(avg((review->>'intensity')::numeric),1),
  'feelings',jsonb_build_object('tired',count(*) filter(where review->>'feeling'='tired'),
   'normal',count(*) filter(where review->>'feeling'='normal'),'great',count(*) filter(where review->>'feeling'='great')),
  'completion',jsonb_build_object('full',count(*) filter(where review->>'completion'='full'),
   'partial',count(*) filter(where review->>'completion'='partial'),'adapted',count(*) filter(where review->>'completion'='adapted')))
 into metrics from workout_days where user_id=u and day between p_start and least((result->>'end')::date,(result->>'today')::date);
 return result||jsonb_build_object('recording',metrics);
end $$;

-- Existing challenges accept every confirmed method, including legacy records.
alter table public.gf_challenges add column recording_policy text not null default 'any' check(recording_policy in('any','timed'));
create function public.create_recording_challenge(p_name text,p_kind text,p_duration integer,p_friends uuid[],p_target integer,p_timezone text,p_recording_policy text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare id_value uuid;
begin
 if p_recording_policy is null or p_recording_policy not in('any','timed') then raise exception 'Escolha quais treinos o desafio aceita.';end if;
 id_value:=create_friend_challenge(p_name,p_kind,p_duration,p_friends,p_target,p_timezone);
 update gf_challenges set recording_policy=p_recording_policy where id=id_value;
 return id_value;
end $$;
alter function public.gf_challenge_metric(uuid,uuid) rename to workout_base_challenge_metric;
create function public.gf_challenge_metric(p_challenge uuid,p_user uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare c gf_challenges; m gf_challenge_members; d date; done integer; due integer;
begin
 select * into strict c from gf_challenges where id=p_challenge;
 if c.recording_policy='any' then return workout_base_challenge_metric(p_challenge,p_user);end if;
 select * into strict m from gf_challenge_members where challenge_id=p_challenge and user_id=p_user and status='accepted';
 d:=(clock_timestamp() at time zone m.timezone)::date;
 select count(*) filter(where kind in('training','compensatory') and completed and exists(
   select 1 from workout_days w where w.user_id=p_user and w.day=x.day and recording_method='timed')),
  count(*) filter(where kind in('training','compensatory') and (day<d or completed)) into done,due
 from gf_days_between(p_user,c.starts_on,least(c.ends_on,d)) x;
 if c.kind<>'consistency' then done:=least(done,m.quota);end if;
 return jsonb_build_object('completed',done,'planned',due,'percent',round(100.0*done/nullif(due,0),1));
end $$;
-- Rebind the SQL board to the new metric, including already warmed database pools.
create or replace function public.gf_challenge_board(p_challenge uuid) returns jsonb
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
alter function public.get_friend_challenges() rename to workout_base_friend_challenges;
create function public.get_friend_challenges() returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 result:=workout_base_friend_challenges();
 return coalesce((select jsonb_agg(x||jsonb_build_object('recordingPolicy',c.recording_policy) order by ordinal)
  from jsonb_array_elements(result) with ordinality a(x,ordinal) join gf_challenges c on c.id=(x->>'id')::uuid),'[]'::jsonb);
end $$;

do $$ declare f regprocedure;begin
 for f in select oid::regprocedure from pg_proc where pronamespace='public'::regnamespace
  and (left(proname,8)='workout_' or proname in('get_workout_recording_state','start_workout_session','finish_workout_session',
    'cancel_workout_session','confirm_manual_workout','submit_workout_review','create_recording_challenge',
    'get_social_state','get_progress_report','get_friend_challenges','gf_challenge_metric'))
 loop execute format('revoke all on function %s from public,anon,authenticated',f);end loop;
end $$;
grant execute on function public.get_workout_recording_state(text),public.start_workout_session(uuid,text,text),
 public.finish_workout_session(uuid,text),public.cancel_workout_session(uuid,text),
 public.confirm_manual_workout(uuid,date,text,integer,jsonb,text),public.submit_workout_review(uuid,jsonb),
 public.get_social_state(),public.get_progress_report(text,date,text),public.get_friend_challenges(),
 public.create_recording_challenge(text,text,integer,uuid[],integer,text,text) to authenticated;
notify pgrst,'reload schema';
commit;
