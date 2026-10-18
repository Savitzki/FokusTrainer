do $$declare b locked_plans_baseline;begin
 select * into strict b from locked_plans_baseline;
 if b.plans is distinct from (select jsonb_agg(to_jsonb(p)-array['replaces_revision','starts_immediately'] order by user_id,revision) from training_plans p where user_id<>'e0000000-0000-4000-8000-000000000099')
  or b.workouts is distinct from (select jsonb_agg(to_jsonb(w) order by id) from workout_days w)
  or b.coins is distinct from (select jsonb_agg(to_jsonb(m) order by id) from coin_movements m)
  or b.groups is distinct from (select jsonb_agg(to_jsonb(g) order by group_id,day) from group_days g)
  or b.days is distinct from (select jsonb_agg(to_jsonb(g) order by user_id,day) from gf_days g)
 then raise exception '025 changed historical plans, workouts, coins or snapshots';end if;
 if not exists(select 1 from training_plans where user_id='e0000000-0000-4000-8000-000000000099' and training_days=array[1,2,3,4,5,6,7])
 or training_schedule_kind('e0000000-0000-4000-8000-000000000099',current_date-1)<>'training'
 then raise exception 'Legacy implicit calendar lost';end if;
end $$;
drop table locked_plans_baseline;
select 'PASS 025 migration: existing plans, workouts, balances, snapshots and implicit legacy calendar preserved';
