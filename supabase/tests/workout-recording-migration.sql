do $$ declare b recording_test_baseline;begin
 select * into strict b from recording_test_baseline;
 if b.workouts is distinct from (select jsonb_agg(to_jsonb(w)-array['recording_method','review','request_id'] order by id) from workout_days w)
  or b.movements is distinct from (select jsonb_agg(to_jsonb(m) order by id) from coin_movements m)
  or b.wallets is distinct from (select jsonb_agg(to_jsonb(w) order by user_id) from coin_wallets w)
  or b.groups is distinct from (select jsonb_agg(to_jsonb(g) order by group_id,day) from group_days g)
  or b.days is distinct from (select jsonb_agg(to_jsonb(g) order by user_id,day) from gf_days g)
  or exists(select 1 from workout_days where recording_method<>'legacy' or review is not null or request_id is not null)
 then raise exception 'Migration rewrote historical workouts, coins or snapshots';end if;
end $$;
drop table recording_test_baseline;
select 'PASS migration 023: historical workouts, coins and frozen snapshots preserved';
