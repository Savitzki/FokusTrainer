-- Fixtures in a disposable database only; never advances the server clock.
begin;
insert into auth.users(id) select ('13131313-1313-4313-8313-'||lpad(i::text,12,'0'))::uuid from generate_series(1,12) i;
insert into profiles(id,nickname) select ('13131313-1313-4313-8313-'||lpad(i::text,12,'0'))::uuid,'swap.arena.'||i from generate_series(1,12) i;
-- Find a live account day with a later Sunday available, on any host weekday.
create temporary table swap_clock as select name zone,(now() at time zone name)::date today
 from pg_timezone_names where extract(isodow from now() at time zone name)<>7 order by name limit 1;
insert into training_accounts(user_id,time_zone,revision,started_on)
 select ('13131313-1313-4313-8313-'||lpad(i::text,12,'0'))::uuid,c.zone,1,c.today-14 from generate_series(1,12) i cross join swap_clock c;
insert into training_plans(user_id,revision,effective_on,training_days,created_at)
 select a.user_id,1,date '2000-01-01',array(select n from generate_series(1,7) n
 where n<>7 and n<>case when extract(isodow from c.today)::int=1 then 2 else 1 end),'2000-01-01'
 from training_accounts a cross join swap_clock c where a.user_id::text like '13131313-%';
insert into streak_groups(id,owner_id,name,time_zone,status,started_on)
 select '14141414-1414-4414-8414-000000000001','13131313-1313-4313-8313-000000000001','Live swap',zone,'active',today from swap_clock;
insert into group_members values
 ('14141414-1414-4414-8414-000000000001','13131313-1313-4313-8313-000000000001','accepted'),
 ('14141414-1414-4414-8414-000000000001','13131313-1313-4313-8313-000000000002','accepted');
insert into workout_days(user_id,day,activity,minutes,confirmed_at)
 select '13131313-1313-4313-8313-000000000002',today,'Fixture',30,now() from swap_clock;
-- Authenticate a fixture account and perform the real RPC, no fixture inserts for this swap.
select set_config('request.jwt.claim.sub','13131313-1313-4313-8313-000000000001',true);
set local role authenticated;
do $$ declare s jsonb; g jsonb; d date; tz text; target date; begin
 s:=get_training_state('UTC'); d:=(s->>'today')::date; tz:=s->>'timezone';
 target:=d+(7-extract(isodow from d)::int);
 perform reschedule_training(d,target,1,tz);
 select value into g from jsonb_array_elements(get_social_state()->'groups') where value->>'id'='14141414-1414-4414-8414-000000000001';
 if not (g->>'completed')::boolean or (g->>'streak')::int<>1 then raise exception 'Resting source blocked the group'; end if;
 if not exists(select 1 from jsonb_array_elements(g->'members') m where m->>'id'=auth.uid()::text
  and (m->>'resting')::boolean and m->>'rescheduledTo'=target::text) then raise exception 'Inconsistent Arena member state'; end if;
 begin perform authorize_extra_rest(tz);raise exception 'Extra consumed on transfer rest';
 exception when raise_exception then if sqlerrm<>'Hoje já é um descanso programado.' then raise; end if;end;
 begin perform use_medical_kit(d,tz);raise exception 'Kit consumed on transfer rest';
 exception when raise_exception then if sqlerrm<>'Hoje já está protegido por um descanso.' then raise; end if;end;
end $$;
reset role;
-- Two independent reasons to freeze a collective date: completed and checked/missed.
insert into streak_groups(id,owner_id,name,time_zone,status,started_on,training_checked_through) values
 ('14141414-1414-4414-8414-000000000002','13131313-1313-4313-8313-000000000003','Frozen complete','UTC','active',current_date,null),
 ('14141414-1414-4414-8414-000000000003','13131313-1313-4313-8313-000000000005','Frozen missed','UTC','active',current_date,date_trunc('week',now())::date+8);
insert into group_members values
 ('14141414-1414-4414-8414-000000000002','13131313-1313-4313-8313-000000000003','accepted'),
 ('14141414-1414-4414-8414-000000000002','13131313-1313-4313-8313-000000000004','accepted'),
 ('14141414-1414-4414-8414-000000000003','13131313-1313-4313-8313-000000000005','accepted'),
 ('14141414-1414-4414-8414-000000000003','13131313-1313-4313-8313-000000000006','accepted');
insert into group_days(group_id,day,members_count) values('14141414-1414-4414-8414-000000000002',date_trunc('week',now())::date+8,2);
-- Use deterministic Tue->Thu schedules for these frozen-day fixtures.
update training_plans set training_days=array[1,2,3,5,6] where user_id in('13131313-1313-4313-8313-000000000003','13131313-1313-4313-8313-000000000005');
set local role authenticated;
do $$ declare u text; m date:=date_trunc('week',now())::date+7; begin
 foreach u in array array['13131313-1313-4313-8313-000000000003','13131313-1313-4313-8313-000000000005'] loop
  perform set_config('request.jwt.claim.sub',u,true);
  begin perform reschedule_training(m+1,m+3,1,'UTC');raise exception 'Consolidated group rewritten';
  exception when raise_exception then if sqlerrm<>'Uma dessas datas já encerrou ou foi consolidada na Arena. O resultado do grupo será preservado.' then raise; end if;end;
 end loop;
end $$;
reset role;
-- A group 25 hours ahead may have closed an account's still-current day.
update training_accounts set time_zone='Pacific/Pago_Pago' where user_id='13131313-1313-4313-8313-000000000007';
insert into streak_groups(id,owner_id,name,time_zone,status,started_on) values
 ('14141414-1414-4414-8414-000000000004','13131313-1313-4313-8313-000000000007','Timezone closure','Pacific/Kiritimati','active',current_date-2);
insert into group_members values
 ('14141414-1414-4414-8414-000000000004','13131313-1313-4313-8313-000000000007','accepted'),
 ('14141414-1414-4414-8414-000000000004','13131313-1313-4313-8313-000000000008','accepted');
update training_plans set training_days=array(select n from generate_series(1,7) n where n<>7
 and n<>case when extract(isodow from now() at time zone 'Pacific/Pago_Pago')::int=1 then 2 else 1 end)
 where user_id='13131313-1313-4313-8313-000000000007';
select set_config('request.jwt.claim.sub','13131313-1313-4313-8313-000000000007',true);
set local role authenticated;
do $$ declare d date:=(now() at time zone 'Pacific/Pago_Pago')::date; begin
 -- On Sundays the same-week rule already prevents any forward move.
 if extract(isodow from d)::int<>7 then
  begin perform reschedule_training(d,d+(7-extract(isodow from d)::int),1,'UTC');raise exception 'Closed group timezone accepted';
  exception when raise_exception then if sqlerrm<>'Uma dessas datas já encerrou ou foi consolidada na Arena. O resultado do grupo será preservado.' then raise; end if;end;
 end if;
end $$;
reset role;
-- Historical, disposable swaps exercise completed/missed compensation during lazy evaluation.
update training_plans set training_days=array[1,2,3,5,6] where user_id::text like '13131313-%' and right(user_id::text,2)::int between 9 and 12;
insert into training_reschedules(user_id,original_day,target_day,week_start,created_at,revision)
 select ('13131313-1313-4313-8313-'||lpad(i::text,12,'0'))::uuid,m+1,m+3,m,(m+1)::timestamp at time zone 'UTC',2
 from generate_series(9,12) i cross join lateral (select date_trunc('week',now())::date-7 m) x;
insert into streak_groups(id,owner_id,name,time_zone,status,started_on)
 select ('14141414-1414-4414-8414-'||lpad(i::text,12,'0'))::uuid,
 ('13131313-1313-4313-8313-'||lpad((case i when 5 then 9 else 11 end)::text,12,'0'))::uuid,
 'Compensation fixture','UTC','active',date_trunc('week',now())::date-6 from generate_series(5,6) i;
insert into group_members select '14141414-1414-4414-8414-000000000005',('13131313-1313-4313-8313-'||lpad(i::text,12,'0'))::uuid,'accepted' from generate_series(9,10) i;
insert into group_members select '14141414-1414-4414-8414-000000000006',('13131313-1313-4313-8313-'||lpad(i::text,12,'0'))::uuid,'accepted' from generate_series(11,12) i;
insert into workout_days(user_id,day,activity,minutes,confirmed_at)
 select ('13131313-1313-4313-8313-'||lpad(i::text,12,'0'))::uuid,m+offset_value,'Fixture',30,((m+offset_value)::timestamp at time zone 'UTC')+interval '12 hours'
 from generate_series(9,12) i cross join (values(2),(3)) offsets(offset_value)
 cross join lateral (select date_trunc('week',now())::date-7 m) x where not(i=12 and offset_value=3);
do $$ declare g uuid; m date:=date_trunc('week',now())::date-7; begin
 foreach g in array array['14141414-1414-4414-8414-000000000005'::uuid,'14141414-1414-4414-8414-000000000006'::uuid] loop
  perform social_refresh_day(g);
  if not exists(select 1 from group_days where group_id=g and day=m+1 and not counts_for_streak) then raise exception 'All transferred rest did not preserve group'; end if;
 end loop;
 if not exists(select 1 from group_days where group_id='14141414-1414-4414-8414-000000000005' and day=m+3 and counts_for_streak)
 or exists(select 1 from group_days where group_id='14141414-1414-4414-8414-000000000006' and day=m+3)
 then raise exception 'Compensation completion/miss not respected by Arena'; end if;
 if social_streak('14141414-1414-4414-8414-000000000005',m+3)<>2 then raise exception 'Compensation counted twice or rest scored'; end if;
end $$;
-- Actual push delivery guard, no network/send. A stale job is denied after a swap.
do $$ declare zone text; device uuid; job uuid; lease_value uuid; u uuid; d date; begin
 select name into zone from pg_timezone_names where extract(hour from now() at time zone name) between 10 and 15 order by name limit 1;
 u:='13131313-1313-4313-8313-000000000001';
 insert into push_devices(user_id,endpoint,p256dh,auth,vapid_key,time_zone,reminder_hour,tone)
 values(u,'https://fcm.googleapis.com/swap-fixture',repeat('a',87),repeat('b',22),repeat('c',87),zone,8,'dramatic') returning id into device;
 lease_value:=gen_random_uuid();
 insert into push_jobs(device_id,day,slot,state,attempts,lease) values(device,(now() at time zone zone)::date,'reminder','sending',1,lease_value) returning id into job;
 if push_job_allowed(job,lease_value) then raise exception 'Stale push charged transferred rest'; end if;
 -- A fixture compensatory day must be allowed, regardless of permanent rest.
 u:='13131313-1313-4313-8313-000000000008'; d:=(now() at time zone zone)::date;
 update training_accounts set time_zone=zone where user_id=u;
 if extract(isodow from d)::int<>1 then
 insert into training_reschedules(user_id,original_day,target_day,week_start,revision,created_at)
 values(u,d-1,d,d-1-(extract(isodow from d-1)::int-1),2,now()-interval '1 day');
 -- On Monday no legitimate compensatory day can exist; TS tests cover it deterministically.
 update push_devices set user_id=u where id=device;
 if not push_job_allowed(job,lease_value) then raise exception 'Compensatory push suppressed'; end if;
 end if;
end $$;
rollback;
select 'PASS: live Arena swap, frozen outcomes, group timezone closure, compensatory completion/miss and push delivery guards' result;
