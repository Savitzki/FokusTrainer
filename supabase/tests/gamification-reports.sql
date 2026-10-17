\ir gamification-fixture.sql
-- Last week: Monday completed; Tuesday extra; Wednesday kit; Thursday moved to Saturday; Friday missed.
insert into workout_days(user_id,day,activity,minutes,confirmed_at) select auth.uid(),date_trunc('week',now())::date-7,'Caminhada',30,date_trunc('week',now())-interval '6 days 12 hours';
insert into workout_days(user_id,day,activity,minutes,confirmed_at) select auth.uid(),date_trunc('week',now())::date-10,'Caminhada',30,date_trunc('week',now())-interval '9 days 12 hours';
insert into training_extra_rests(user_id,day,authorized_at) values(auth.uid(),date_trunc('week',now())::date-6,date_trunc('week',now())-interval '6 days');
insert into medical_kits(user_id,grant_month,grant_slot,used_on,used_at) values(auth.uid(),date_trunc('month',date_trunc('week',now())-interval '5 days')::date,1,date_trunc('week',now())::date-5,date_trunc('week',now())-interval '5 days');
insert into training_reschedules(user_id,original_day,target_day,week_start,created_at,revision) values(auth.uid(),date_trunc('week',now())::date-4,date_trunc('week',now())::date-2,date_trunc('week',now())::date-7,date_trunc('week',now())-interval '4 days',2);
select pg_temp.check_ok((get_progress_report('week',date_trunc('week',now())::date-7,'UTC')->'summary'->>'planned')::integer=3,'effective obligations exclude extra and kit');
select pg_temp.check_ok((get_progress_report('week',date_trunc('week',now())::date-7,'UTC')->'summary'->>'compliance')::numeric=33.3,'reagents count once; missing compensation breaks compliance');
select pg_temp.check_ok((get_progress_report('week',date_trunc('week',now())::date-7,'UTC')->'streak'->>'current')::integer=0,'unprotected miss breaks streak');
select pg_temp.check_ok((get_progress_report('week',date_trunc('week',now())::date-7,'UTC')->'streak'->>'best')::integer=2,'valid weekend preserves run across weeks');
select pg_temp.check_ok((select kind='rescheduled-rest' from gf_days where user_id=auth.uid() and day=date_trunc('week',now())::date-4),'reschedule original neutralized');
select pg_temp.check_ok((select kind='compensatory' from gf_days where user_id=auth.uid() and day=date_trunc('week',now())::date-2),'destination marked compensatory');
-- Late administrative changes to original records cannot rewrite closed derived results.
update workout_days set minutes=60 where user_id=auth.uid();
select pg_temp.check_ok((get_progress_report('week',date_trunc('week',now())::date-7,'UTC')->'summary'->>'minutes')::integer=30,'closed snapshots immutable');
select pg_temp.check_ok((get_progress_report('week',date_trunc('week',now())::date,'UTC')->'summary'->'average')='null'::jsonb,'empty averages are null');
set request.jwt.claim.sub='a0000000-0000-4000-8000-000000000002';
select pg_temp.check_ok((get_progress_report('week',date_trunc('week',now())::date-7,'UTC')->'summary'->>'completed')::integer=0,'reports isolate accounts');
select 'PASS reports: effective schedule, rests, kits, compensation, missed days, immutable history, no misleading averages, privacy';
rollback;
