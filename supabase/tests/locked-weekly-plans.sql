\ir gamification-fixture.sql
create function pg_temp.rejects(command text, expected text) returns void language plpgsql as $$
begin
 begin execute command;exception when others then
  if sqlerrm not like '%'||expected||'%' then raise exception 'Unexpected rejection: %',sqlerrm;end if;return;
 end;raise exception 'FAIL accepted forbidden operation: %',command;
end $$;
insert into auth.users(id) values('e0000000-0000-4000-8000-000000000001'),('e0000000-0000-4000-8000-000000000002');
insert into profiles(id,nickname) values('e0000000-0000-4000-8000-000000000001','plans.new'),('e0000000-0000-4000-8000-000000000002','plans.rest');
set request.jwt.claim.sub='e0000000-0000-4000-8000-000000000001';
select pg_temp.check_ok((get_training_state('UTC')->>'planRequired')='true','new account requires plan');
select pg_temp.check_ok(not exists(select 1 from training_plans where user_id=auth.uid()),'no automatic default plan');
select pg_temp.check_ok(training_schedule_kind(auth.uid(),current_date)='unplanned','no implicit seven-day schedule for new account');
select pg_temp.check_ok(get_gamification_state('UTC')->'weekly'->'missions'='[]'::jsonb,'no premature mission cycle');
select pg_temp.rejects($q$select start_workout_session(gen_random_uuid(),'Corrida','UTC')$q$,'Crie seu plano');
select pg_temp.rejects($q$select confirm_manual_workout(gen_random_uuid(),current_date,'Corrida',35,'{"version":1,"questionIds":["real","honest"],"answers":[true,true,true]}','UTC')$q$,'Crie seu plano');
select pg_temp.check_ok(not exists(select 1 from workout_days where user_id=auth.uid()),'blocked attempts do not confirm');
select pg_temp.rejects($q$select save_training_plan(array[1,2,3,4],0,'UTC',false)$q$,'exatamente 5');
select pg_temp.rejects($q$select save_training_plan(array[1,2,3,4,5,6],0,'UTC',false)$q$,'exatamente 5');
select pg_temp.rejects($q$select save_training_plan(array[1,1,3,4,5],0,'UTC',false)$q$,'exatamente 5');
select pg_temp.rejects($q$select save_training_plan(array[1,2,3,4,5],0,'UTC',true)$q$,'primeiro plano');
-- Pick five days including today, whatever day the CI runs.
select save_training_plan(array(select x from generate_series(1,7) x where x<>extract(isodow from current_date+1)::integer and x<>extract(isodow from current_date+2)::integer),0,'UTC',false);
select pg_temp.check_ok((select effective_on=current_date and starts_immediately and cardinality(training_days)=5 from training_plans where user_id=auth.uid()),'first plan starts now');
select pg_temp.check_ok((gf_day(auth.uid(),current_date)).kind='training','immediate first plan applies despite midnight snapshot cutoff');
select confirm_manual_workout('e0000000-0000-4000-8000-000000000010',current_date,'Corrida',35,'{"version":1,"questionIds":["real","honest"],"answers":[true,true,true]}','UTC');
select pg_temp.check_ok((gf_streak(auth.uid())->>'current')='1','first confirmed required workout scores once');
select get_gamification_state('UTC');
create temp table locked_baseline as select
 (select jsonb_agg(to_jsonb(w) order by id) from workout_days w where user_id=auth.uid()) workouts,
 (select jsonb_agg(to_jsonb(p) order by revision) from training_plans p where user_id=auth.uid()) plans,
 (select jsonb_agg(to_jsonb(m) order by id) from coin_movements m where user_id=auth.uid()) coins,
 (select jsonb_agg(to_jsonb(m) order by key) from gf_missions m where user_id=auth.uid()) missions;
select pg_temp.rejects($q$select save_training_plan(array[1,2,3,4,5],1,'UTC',false)$q$,'Substituir plano');
select save_training_plan(array[1,2,3,4,5],1,'Pacific/Kiritimati',true);
select pg_temp.check_ok((select effective_on=current_date+1 and replaces_revision=1 and not starts_immediately from training_plans where user_id=auth.uid() and revision=2),'replacement starts tomorrow, pinned timezone');
select pg_temp.check_ok(training_day_kind(auth.uid(),current_date)='training' and (gf_streak(auth.uid())->>'current')='1','replacement does not reclassify today or reset streak');
select pg_temp.rejects($q$select save_training_plan(array[1,2,3,4,5],1,'UTC',true)$q$,'outro aparelho');
select save_training_plan(array[2,3,4,5,6],2,'UTC',true);
select pg_temp.check_ok((select count(*)=3 from training_plans where user_id=auth.uid()),'old pending revision preserved');
select pg_temp.check_ok((select replaces_revision=2 and effective_on=current_date+1 from training_plans where user_id=auth.uid() and revision=3),'new pending plan explicitly supersedes old pending plan');
select pg_temp.check_ok((select training_days=array[2,3,4,5,6] from training_plans where user_id=auth.uid() and effective_on<=current_date+1 order by effective_on desc,revision desc limit 1),'single logical effective plan');
select pg_temp.check_ok((select b.workouts=(select jsonb_agg(to_jsonb(w) order by id) from workout_days w where user_id=auth.uid())
 and b.coins=(select jsonb_agg(to_jsonb(m) order by id) from coin_movements m where user_id=auth.uid())
 and b.plans=(select jsonb_agg(to_jsonb(p) order by revision) from training_plans p where user_id=auth.uid() and revision=1)
 and b.missions=(select jsonb_agg(to_jsonb(m) order by key) from gf_missions m where user_id=auth.uid()) from locked_baseline b),'no workout, ledger, historical plan or issued goal rewrite');
set role authenticated;
select pg_temp.rejects($q$update training_plans set training_days=array[1,2,3,4,5]$q$,'permission denied');
select pg_temp.rejects($q$delete from training_plans$q$,'permission denied');
reset role;
-- A first plan with today as rest allows voluntary recording without a point.
set request.jwt.claim.sub='e0000000-0000-4000-8000-000000000002';
select save_training_plan(array(select x from generate_series(1,7) x where x<>extract(isodow from current_date)::integer and x<>extract(isodow from current_date+1)::integer),0,'UTC',false);
select confirm_manual_workout(gen_random_uuid(),current_date,'Voluntário',35,'{"version":1,"questionIds":["real","honest"],"answers":[true,true,true]}','UTC');
select pg_temp.check_ok((gf_streak(auth.uid())->>'current')='0' and (select kind from gf_day(auth.uid(),current_date))='scheduled-rest','first voluntary rest does not score');
-- Mixed-version historical week: both versions have 5 days, effective week has 6.
set request.jwt.claim.sub='a0000000-0000-4000-8000-000000000003';
update training_plans set training_days=array[1,2,3,4,5] where user_id=auth.uid();
insert into training_plans(user_id,revision,effective_on,training_days,created_at,replaces_revision)
 values(auth.uid(),2,date_trunc('week',current_date)::date-4,array[1,2,5,6,7],(date_trunc('week',current_date)::date-5)::timestamp,1);
select pg_temp.check_ok((select count(*)=6 from gf_days_between(auth.uid(),date_trunc('week',current_date)::date-7,date_trunc('week',current_date)::date-1) where kind='training'),'transition week has actual 6 mandatory days');
select pg_temp.check_ok((get_progress_report('week',date_trunc('week',current_date)::date-7,'UTC')->'summary'->>'planned')='6','report uses effective dated plans');
-- Confirmed reschedules reject future plan conflicts and list the offending date.
set request.jwt.claim.sub='a0000000-0000-4000-8000-000000000002';
select reschedule_training(date_trunc('week',current_date)::date+7,date_trunc('week',current_date)::date+12,1,'UTC');
select pg_temp.rejects($q$select save_training_plan(array[2,3,4,5,6],2,'UTC',true)$q$,'reagendamentos nas datas');
select pg_temp.check_ok((select revision=2 from training_accounts where user_id=auth.uid()),'failed replacement leaves current plan and revision intact');
select save_training_plan(array[1,2,3,4,7],2,'UTC',true);
select pg_temp.check_ok(training_schedule_kind(auth.uid(),date_trunc('week',current_date)::date+7)='rescheduled-rest' and training_schedule_kind(auth.uid(),date_trunc('week',current_date)::date+12)='training','valid replacement preserves swap');
select pg_temp.check_ok(not has_function_privilege('anon','save_training_plan(integer[],integer,text,boolean)','EXECUTE') and not has_function_privilege('authenticated','training_has_plan(uuid,date)','EXECUTE'),'authenticated RPC and private helper');
-- Kits and previous extra rests survive replacement without overlap or reuse.
set request.jwt.claim.sub='a0000000-0000-4000-8000-000000000001';
update training_plans set training_days=array(select x from generate_series(1,7) x where x<>extract(isodow from current_date+1)::integer and x<>extract(isodow from current_date+2)::integer) where user_id=auth.uid();
insert into training_extra_rests(user_id,day) values(auth.uid(),current_date-1);
select use_medical_kit(current_date,'UTC');
select save_training_plan(array[1,2,3,4,5],(select revision from training_accounts where user_id=auth.uid()),'UTC',true);
select pg_temp.check_ok(training_day_kind(auth.uid(),current_date)='medical-kit' and training_day_kind(auth.uid(),current_date-1)='extra-rest','replacement preserves kits and authorized rests');
-- An independent fixture guarantees the group is ahead of the account at every
-- UTC hour, without a kit/extra rest from earlier cases neutralizing this check.
insert into auth.users(id) values('e0000000-0000-4000-8000-000000000073');
insert into profiles(id,nickname) values('e0000000-0000-4000-8000-000000000073','plans.frozen');
set request.jwt.claim.sub='e0000000-0000-4000-8000-000000000073';
select (now() at time zone 'Etc/GMT+12')::date+1 as frozen_day \gset
insert into training_accounts(user_id,time_zone,started_on,revision) values(auth.uid(),'Etc/GMT+12',:'frozen_day'::date-1,1);
insert into training_plans(user_id,revision,effective_on,training_days,starts_immediately) values(auth.uid(),1,:'frozen_day'::date-1,array[1,2,3,4,5],true);
insert into streak_groups(id,owner_id,name,time_zone,status,started_on) values('e0000000-0000-4000-8000-000000000070',auth.uid(),'Frozen arena','Pacific/Kiritimati','active',:'frozen_day'::date);
insert into group_members(group_id,user_id,status) values
 ('e0000000-0000-4000-8000-000000000070',auth.uid(),'accepted'),
 ('e0000000-0000-4000-8000-000000000070','a0000000-0000-4000-8000-000000000002','accepted');
insert into group_days(group_id,day,members_count,counts_for_streak) values('e0000000-0000-4000-8000-000000000070',:'frozen_day'::date,2,true);
select pg_temp.rejects(format('select save_training_plan(%L::integer[],%s,''UTC'',true)',
 case when training_schedule_kind(auth.uid(),:'frozen_day'::date)='training'
 then array(select x from generate_series(1,7) x where x<>extract(isodow from :'frozen_day'::date)::integer and x<>extract(isodow from (:'frozen_day'::date+1))::integer)
 else array(select x from generate_series(1,7) x order by case when x=extract(isodow from :'frozen_day'::date)::integer then 0 else 1 end,x limit 5) end,
 (select revision from training_accounts where user_id=auth.uid())),'Arena já consolidou');
select pg_temp.check_ok(exists(select 1 from group_days where group_id='e0000000-0000-4000-8000-000000000070' and day=:'frozen_day'::date and counts_for_streak),'immutable Arena result survives blocked replacement');
set request.jwt.claim.sub='a0000000-0000-4000-8000-000000000001';
-- Missing plans do not act as free rest for a new Arena participant.
insert into auth.users(id) values('e0000000-0000-4000-8000-000000000003');
insert into profiles(id,nickname) values('e0000000-0000-4000-8000-000000000003','plans.arena');
insert into streak_groups(id,owner_id,name,time_zone,status,started_on) values('e0000000-0000-4000-8000-000000000071',auth.uid(),'Plan gate','UTC','active',current_date);
insert into group_members(group_id,user_id,status) values
 ('e0000000-0000-4000-8000-000000000071',auth.uid(),'accepted'),
 ('e0000000-0000-4000-8000-000000000071','a0000000-0000-4000-8000-000000000002','accepted'),
 ('e0000000-0000-4000-8000-000000000071','e0000000-0000-4000-8000-000000000003','accepted');
insert into workout_days(user_id,day,activity,minutes,confirmed_at) values('a0000000-0000-4000-8000-000000000002',current_date,'Arena',35,now());
select social_refresh_day('e0000000-0000-4000-8000-000000000071');
select pg_temp.check_ok(not exists(select 1 from group_days where group_id='e0000000-0000-4000-8000-000000000071'),'unconfigured participant does not save group streak');
set request.jwt.claim.sub='e0000000-0000-4000-8000-000000000003';
select save_training_plan(array(select x from generate_series(1,7) x where x<>extract(isodow from current_date)::integer and x<>extract(isodow from current_date+1)::integer),0,'UTC',false);
select pg_temp.check_ok(exists(select 1 from group_days where group_id='e0000000-0000-4000-8000-000000000071' and day=current_date),'first valid rest plan refreshes unconsolidated group day');
select 'PASS locked plans: no default, both methods gated, exact five, immediate first, tomorrow replacement, pending supersession, immutable history, six-day transition, missions, swaps, ACLs';
rollback;
