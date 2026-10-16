\set ON_ERROR_STOP on
insert into auth.users(id) values('33333333-3333-4333-8333-333333333333');
insert into public.profiles(id,nickname) values('33333333-3333-4333-8333-333333333333','outsider');
select friend_code as code_b from public.profiles where id='22222222-2222-4222-8222-222222222222' \gset
select friend_code as code_c from public.profiles where id='33333333-3333-4333-8333-333333333333' \gset
set role authenticated;
set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
insert into public.profiles(id,nickname,avatar_style,avatar_color,avatar_photo) values(auth.uid(),'dani.treina','initials','orange',null)
on conflict(id) do update set id=excluded.id,nickname=excluded.nickname,avatar_style=excluded.avatar_style,avatar_color=excluded.avatar_color,avatar_photo=excluded.avatar_photo;
select public.send_friend_request(:'code_b');
do $$ begin
  if jsonb_array_length(public.get_social_state()->'friends')<>0 then raise exception 'Unaccepted friend exposed'; end if;
  begin
    perform public.create_streak_group('forged',array['22222222-2222-4222-8222-222222222222'::uuid],'UTC');
    raise exception 'Unaccepted friend invited';
  exception when raise_exception then if sqlerrm='Unaccepted friend invited' then raise; end if; end;
  begin update public.profiles set friend_code=gen_random_uuid() where id=auth.uid(); raise exception 'Code modified'; exception when insufficient_privilege then null; end;
end $$;
select public.get_social_state()->'requests'->0->>'id' as friend_request \gset
set request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
do $$ begin
  if jsonb_array_length(public.get_social_state()->'requests')<>0 then raise exception 'Requests leaked'; end if;
end $$;
set request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
select public.reply_friend_request(:'friend_request',true);
set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
select public.create_streak_group('Dupla',array['22222222-2222-4222-8222-222222222222'::uuid],'UTC') as group_id \gset
select public.confirm_daily_workout(current_date,'Corrida',30,'UTC');
select public.confirm_daily_workout(current_date,'Tentativa de mudar',99,'UTC');
do $$ begin
  if public.get_social_state()->'groups'->0->>'status'<>'pending' then raise exception 'Group started without consent'; end if;
  begin perform public.confirm_daily_workout(current_date-1,'Corrida',30,'UTC'); raise exception 'Backdate accepted'; exception when raise_exception then if sqlerrm='Backdate accepted' then raise; end if; end;
  begin update public.workout_days set minutes=2; raise exception 'Workout modified'; exception when insufficient_privilege then null; end;
  begin perform public.social_refresh_day(gen_random_uuid()); raise exception 'Private helper exposed'; exception when insufficient_privilege then null; end;
  begin perform public.claim_push_jobs(); raise exception 'Push jobs exposed'; exception when insufficient_privilege then null; end;
end $$;
set request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
select public.reply_group_invite(:'group_id',true);
do $$ begin
  if (public.get_social_state()->'groups'->0->>'completed')::boolean then raise exception 'Single member completed group'; end if;
end $$;
select public.confirm_daily_workout(current_date,'Bike',40,'UTC');
select public.confirm_daily_workout(current_date,'Bike',40,'UTC');
do $$ begin
  if not (public.get_social_state()->'groups'->0->>'completed')::boolean or (public.get_social_state()->'groups'->0->>'streak')::integer<>1 then raise exception 'Group not saved'; end if;
end $$;
set request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
do $$ begin
  if jsonb_array_length(public.get_social_state()->'groups')<>0 then raise exception 'Private group leaked'; end if;
  if jsonb_array_length(public.get_social_state()->'workouts')<>0 then raise exception 'Private workouts leaked'; end if;
  begin select * from public.group_days; raise exception 'Group ledger exposed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
  if (select count(*) from public.group_days)<>1 then raise exception 'Duplicate group day'; end if;
  if (select minutes from public.workout_days where user_id='11111111-1111-4111-8111-111111111111')<>30 then raise exception 'Duplicate changed workout'; end if;
end $$;
-- A full missed day resets the count; record survives.
insert into public.group_days(group_id,day,members_count) values(:'group_id',current_date-3,2),(:'group_id',current_date-4,2),(:'group_id',current_date-5,2);
do $$ declare gid uuid; begin
  select id into gid from public.streak_groups limit 1;
  if public.social_streak(gid,current_date)<>1 or public.social_streak(gid,current_date,true)<>3 or public.social_streak(gid,current_date+2)<>0 then raise exception 'Missed day or record broken'; end if;
end $$;
select name as push_tz from pg_timezone_names where extract(hour from now() at time zone name)=18 order by name limit 1 \gset
set role authenticated;
set request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
do $$ begin
  begin perform public.save_push_device('https://127.0.0.1/private',repeat('A',87),repeat('A',22),repeat('A',87),'UTC',18,'gentle'); raise exception 'Unsafe endpoint allowed'; exception when check_violation then null; end;
end $$;
select public.save_push_device('https://fcm.googleapis.com/test',repeat('A',87),repeat('A',22),repeat('A',87),:'push_tz',18,'dramatic');
reset role;
create temp table claimed as select * from public.claim_push_jobs();
do $$ begin
  if (select count(*) from claimed)<>1 then raise exception 'Due reminder missing'; end if;
  if exists(select 1 from public.claim_push_jobs()) then raise exception 'Concurrent claim duplicate'; end if;
  if not (select public.push_job_allowed(job_id,lease_id) from claimed) then raise exception 'Claim not allowed'; end if;
end $$;
select public.finish_push_job(job_id,lease_id,'retry') from claimed;
truncate claimed;
insert into claimed select * from public.claim_push_jobs();
select public.finish_push_job(job_id,lease_id,'sent') from claimed;
do $$ begin
  if exists(select 1 from public.claim_push_jobs()) then raise exception 'Sent reminder resent'; end if;
end $$;
-- Suppress a job after a workout, including a server-side recheck after claim.
update public.push_jobs set state='queued',attempts=0;
truncate claimed;
insert into claimed select * from public.claim_push_jobs();
insert into public.workout_days(user_id,day,activity,minutes) values('33333333-3333-4333-8333-333333333333',current_date,'Treino',20);
do $$ begin
  if (select public.push_job_allowed(job_id,lease_id) from claimed) then raise exception 'Reminder sent after workout'; end if;
end $$;
set role anon;
do $$ begin
  begin perform public.get_social_state(); raise exception 'Anonymous social access'; exception when insufficient_privilege then null; end;
  begin perform public.save_push_device('bad','bad','bad','bad','UTC',18,'gentle'); raise exception 'Anonymous push access'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'PASS: friendships, consent, immutable workouts, collective day, streak reset, privacy, push queue dedup/retry/suppression and endpoint restrictions' as result;

-- Prepare an active group for two simultaneous confirmations in the shell runner.
delete from public.workout_days where user_id in('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222');
insert into public.streak_groups(id,owner_id,name,time_zone,status,started_on) values('44444444-4444-4444-8444-444444444444','11111111-1111-4111-8111-111111111111','Concurrent','UTC','active',current_date);
insert into public.group_members values('44444444-4444-4444-8444-444444444444','11111111-1111-4111-8111-111111111111','accepted'),('44444444-4444-4444-8444-444444444444','22222222-2222-4222-8222-222222222222','accepted');
