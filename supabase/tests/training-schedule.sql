-- Disposable database only; every fixture is rolled back.
begin;
insert into auth.users(id) select ('aaaaaaaa-aaaa-4aaa-8aaa-'||lpad(i::text,12,'0'))::uuid from generate_series(1,6) i;
insert into public.profiles(id,nickname) select ('aaaaaaaa-aaaa-4aaa-8aaa-'||lpad(i::text,12,'0'))::uuid,'schedule.'||i from generate_series(1,6) i;
set local role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-000000000001',true);
do $$ declare r jsonb; begin
 r:=public.get_training_state('UTC');
 if r->>'timezone'<>'UTC' or (r->>'weeklyExtraLimit')::int<>2 then raise exception 'Wrong default settings'; end if;
 r:=public.save_training_plan(array[1,3,5],0,'UTC');
 if (r#>>'{plans,0,effectiveFrom}')::date<>current_date+1 then raise exception 'Schedule changed today or the past'; end if;
 begin perform public.save_training_plan(array[2,4],0,'UTC'); raise exception 'Stale revision accepted';
 exception when raise_exception then if sqlerrm='Stale revision accepted' then raise; end if; end;
 begin perform public.save_training_plan(array[1,1],1,'UTC'); raise exception 'Duplicate days accepted';
 exception when raise_exception then if sqlerrm='Duplicate days accepted' then raise; end if; end;
 begin perform public.save_training_plan(array[0,8],1,'UTC'); raise exception 'Invalid weekdays accepted';
 exception when raise_exception then if sqlerrm='Invalid weekdays accepted' then raise; end if; end;
 r:=public.get_training_state('Pacific/Kiritimati');
 if r->>'timezone'<>'UTC' then raise exception 'Device timezone reset account timezone'; end if;
 begin perform * from public.training_plans; raise exception 'Direct plan access allowed'; exception when insufficient_privilege then null; end;
 begin perform public.training_state('aaaaaaaa-aaaa-4aaa-8aaa-000000000002'); raise exception 'Internal helper exposed'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-000000000002',true);
do $$ begin
 if jsonb_array_length(public.get_training_state('UTC')->'plans')<>0 then raise exception 'Schedules leaked across accounts'; end if;
end $$;
set local role anon;
do $$ begin
 begin perform public.get_training_state('UTC'); raise exception 'Anonymous schedule access allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
insert into public.training_accounts(user_id,time_zone,started_on)
 select ('aaaaaaaa-aaaa-4aaa-8aaa-'||lpad(i::text,12,'0'))::uuid,'UTC',current_date from generate_series(3,6) i;
-- Historical fixtures predate the group's midnight snapshot.
insert into public.training_plans(user_id,revision,effective_on,training_days,created_at) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-000000000002',1,current_date-10,array(select i from generate_series(1,7) i where i<>extract(isodow from current_date)::int),'2000-01-01'),
 ('aaaaaaaa-aaaa-4aaa-8aaa-000000000003',1,current_date-10,array(select i from generate_series(1,7) i where i<>extract(isodow from current_date)::int),'2000-01-01');
update public.training_accounts set revision=1 where user_id in('aaaaaaaa-aaaa-4aaa-8aaa-000000000002','aaaaaaaa-aaaa-4aaa-8aaa-000000000003');
insert into public.streak_groups(id,owner_id,name,time_zone,status,started_on) values
 ('bbbbbbbb-bbbb-4bbb-8bbb-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-000000000001','Mixed day','UTC','active',current_date-1),
 ('bbbbbbbb-bbbb-4bbb-8bbb-000000000002','aaaaaaaa-aaaa-4aaa-8aaa-000000000002','Rest day','UTC','active',current_date-1);
insert into public.group_members values
 ('bbbbbbbb-bbbb-4bbb-8bbb-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-000000000001','accepted'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-000000000002','accepted'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-000000000002','aaaaaaaa-aaaa-4aaa-8aaa-000000000002','accepted'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-000000000002','aaaaaaaa-aaaa-4aaa-8aaa-000000000003','accepted');
insert into public.group_days(group_id,day,members_count) values('bbbbbbbb-bbbb-4bbb-8bbb-000000000002',current_date-1,2);
set local role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-000000000001',true);
select public.confirm_daily_workout(current_date,'Scheduled training',30,'UTC');
do $$ declare r jsonb; g jsonb; begin
 r:=public.get_social_state();
 select value into g from jsonb_array_elements(r->'groups') where value->>'id'='bbbbbbbb-bbbb-4bbb-8bbb-000000000001';
 if not (g->>'completed')::boolean or (g->>'streak')::int<>1 then raise exception 'Resting member blocked the collective day'; end if;
 if not exists(select 1 from jsonb_array_elements(g->'members') m where m->>'id'='aaaaaaaa-aaaa-4aaa-8aaa-000000000002' and (m->>'resting')::boolean) then raise exception 'Missing resting member state'; end if;
end $$;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-000000000002',true);
do $$ declare r jsonb; g jsonb; begin
 begin perform public.authorize_extra_rest('UTC'); raise exception 'Spent an extra on scheduled rest';
 exception when raise_exception then if sqlerrm='Spent an extra on scheduled rest' then raise; end if; end;
 perform public.confirm_daily_workout(current_date,'Voluntary training',20,'UTC');
 r:=public.get_social_state();
 select value into g from jsonb_array_elements(r->'groups') where value->>'id'='bbbbbbbb-bbbb-4bbb-8bbb-000000000002';
 if not (g->>'completed')::boolean or not (g->>'resting')::boolean or (g->>'streak')::int<>1 then raise exception 'All-rest day added points or broke the sequence'; end if;
end $$;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-000000000004',true);
do $$ declare a jsonb; b jsonb; begin
 a:=public.authorize_extra_rest('UTC'); b:=public.authorize_extra_rest('Pacific/Kiritimati');
 if (a->>'revision')::int<>1 or a<>b or jsonb_array_length(a->'extraRests')<>1 then raise exception 'Rest retry consumed another allowance'; end if;
 perform public.confirm_daily_workout(current_date,'Voluntary after extra',20,'UTC');
 begin perform public.confirm_daily_workout(current_date-1,'Past',20,'UTC'); raise exception 'Past training accepted';
 exception when raise_exception then if sqlerrm='Past training accepted' then raise; end if; end;
end $$;
reset role;
-- Artificial quota fixtures exercise the weekly boundary on any weekday.
insert into public.training_extra_rests(user_id,day)
 select 'aaaaaaaa-aaaa-4aaa-8aaa-000000000005',d::date from generate_series(
   (current_date-(extract(isodow from current_date)::int-1))::timestamp,
   (current_date-(extract(isodow from current_date)::int-1)+6)::timestamp,interval '1 day') d
 where d::date<>current_date limit 2;
insert into public.training_extra_rests(user_id,day) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-000000000006',current_date-(extract(isodow from current_date)::int-1)-1),
 ('aaaaaaaa-aaaa-4aaa-8aaa-000000000006',current_date-(extract(isodow from current_date)::int-1)-2);
set local role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-000000000005',true);
do $$ begin
 begin perform public.authorize_extra_rest('UTC'); raise exception 'Weekly allowance exceeded';
 exception when raise_exception then if sqlerrm='Weekly allowance exceeded' then raise; end if; end;
end $$;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-000000000006',true);
select public.authorize_extra_rest('UTC');
reset role;
do $$ begin
 if public.training_day_kind('aaaaaaaa-aaaa-4aaa-8aaa-000000000004',current_date)<>'extra-rest' then raise exception 'Voluntary workout removed authorized rest'; end if;
 if (select count(*) from public.training_extra_rests where user_id='aaaaaaaa-aaaa-4aaa-8aaa-000000000006' and day=current_date)<>1 then raise exception 'Weekly allowance did not reset'; end if;
 if (select counts_for_streak from public.group_days where group_id='bbbbbbbb-bbbb-4bbb-8bbb-000000000002' and day=current_date) then raise exception 'Rest day counted as training'; end if;
end $$;
-- A plan created after the group's midnight cannot reclassify that day.
do $$ declare zone text; device uuid; job uuid; lease_value uuid; i integer; permitted boolean; begin
 select name into zone from pg_timezone_names where extract(hour from now() at time zone name) between 10 and 15 order by name limit 1;
 foreach i in array array[3,5] loop
  insert into public.push_devices(user_id,endpoint,p256dh,auth,vapid_key,time_zone,reminder_hour,tone)
   values(('aaaaaaaa-aaaa-4aaa-8aaa-'||lpad(i::text,12,'0'))::uuid,'https://fcm.googleapis.com/rest-check-'||i,repeat('a',87),repeat('b',22),repeat('c',87),zone,8,'dramatic') returning id into device;
  lease_value:=gen_random_uuid();
  insert into public.push_jobs(device_id,day,slot,state,attempts,lease) values(device,(now() at time zone zone)::date,'reminder','sending',1,lease_value) returning id into job;
  permitted:=public.push_job_allowed(job,lease_value);
  if permitted is distinct from (i=5) then raise exception 'Scheduled push did not respect valid rest days'; end if;
 end loop;
end $$;
insert into public.training_plans(user_id,revision,effective_on,training_days) values('aaaaaaaa-aaaa-4aaa-8aaa-000000000002',2,current_date,array[1,2,3,4,5,6,7]);
do $$ begin
 if public.training_day_kind('aaaaaaaa-aaaa-4aaa-8aaa-000000000002',current_date,current_date::timestamp at time zone 'UTC',(current_date+1)::timestamp at time zone 'UTC')<>'scheduled-rest' then raise exception 'Late plan changed group midnight snapshot'; end if;
 perform public.social_refresh_day('bbbbbbbb-bbbb-4bbb-8bbb-000000000002');
 if public.social_streak('bbbbbbbb-bbbb-4bbb-8bbb-000000000002',current_date)<>1 then raise exception 'Historical group score changed'; end if;
end $$;
-- Lazy backfill of unopened rest days must bridge an existing streak.
insert into public.training_plans(user_id,revision,effective_on,training_days,created_at) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-000000000002',3,current_date-3,array[extract(isodow from current_date+3)::integer],'2000-01-01'),
 ('aaaaaaaa-aaaa-4aaa-8aaa-000000000003',2,current_date-3,array[extract(isodow from current_date+3)::integer],'2000-01-01');
insert into public.streak_groups(id,owner_id,name,time_zone,status,started_on) values
 ('bbbbbbbb-bbbb-4bbb-8bbb-000000000003','aaaaaaaa-aaaa-4aaa-8aaa-000000000002','Unopened rest days','UTC','active',current_date-3);
insert into public.group_members values
 ('bbbbbbbb-bbbb-4bbb-8bbb-000000000003','aaaaaaaa-aaaa-4aaa-8aaa-000000000002','accepted'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-000000000003','aaaaaaaa-aaaa-4aaa-8aaa-000000000003','accepted');
insert into public.group_days(group_id,day,members_count) values('bbbbbbbb-bbbb-4bbb-8bbb-000000000003',current_date-3,2);
do $$ begin
 perform public.social_refresh_day('bbbbbbbb-bbbb-4bbb-8bbb-000000000003');
 if public.social_streak('bbbbbbbb-bbbb-4bbb-8bbb-000000000003',current_date)<>1 then raise exception 'Unopened rest days broke the group streak'; end if;
end $$;
rollback;
select 'PASS: schedule isolation, future versions, conflict checks, fixed timezone, rest quota/retries, voluntary training, group rest protection, midnight snapshots and lazy rest backfill' as result;
