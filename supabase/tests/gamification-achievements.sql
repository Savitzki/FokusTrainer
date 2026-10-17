\ir gamification-fixture.sql
insert into workout_days(user_id,day,activity,minutes,confirmed_at)
 select auth.uid(),date_trunc('week',now())::date-7+x,'Caminhada',30,(date_trunc('week',now())::date-7+x)::timestamp+interval '12 hours' from generate_series(0,4) x;
insert into workout_days(user_id,day,activity,minutes,confirmed_at)
 select auth.uid(),day_value,'Caminhada',30,day_value::timestamp+interval '12 hours' from (
  select x::date day_value from generate_series(current_date-600,current_date-15,interval '1 day') x
  where extract(isodow from x) between 1 and 5 order by x limit 360) history;
do $$ begin perform get_gamification_state('UTC'); end $$;
select pg_temp.check_ok((select historical from gf_badges where user_id=auth.uid() and key='workout-1'),'recognize historical first workout');
select pg_temp.check_ok((select count(*)=5 from gf_badges where user_id=auth.uid() and key like 'workout-%'),'recognize 1/10/30/100/365 milestones');
select pg_temp.check_ok((select count(*)=1 from gf_badges where user_id=auth.uid() and key='week-1'),'recognize historical fulfilled week');
select pg_temp.check_ok((select balance=1000 from coin_wallets where user_id=auth.uid()),'no automatic historic achievement rewards');
select set_featured_medals(array['workout-1','week-1','friend'],false);
set request.jwt.claim.sub='a0000000-0000-4000-8000-000000000002';
select pg_temp.check_ok(jsonb_array_length(get_friend_showcase('a0000000-0000-4000-8000-000000000001')->'badges')=0,'private badges hidden from friends');
set request.jwt.claim.sub='a0000000-0000-4000-8000-000000000001';
select set_featured_medals(array['workout-1','week-1','friend'],true);
do $$ begin
 begin perform set_featured_medals(array['workout-1','week-1','friend','record'],true);raise exception 'four medals accepted'; exception when raise_exception then if sqlerrm='four medals accepted' then raise;end if;end;
 begin perform set_featured_medals(array['record'],true);raise exception 'locked badge accepted'; exception when raise_exception then if sqlerrm='locked badge accepted' then raise;end if;end;
end $$;
set request.jwt.claim.sub='a0000000-0000-4000-8000-000000000002';
select pg_temp.check_ok(jsonb_array_length(get_friend_showcase('a0000000-0000-4000-8000-000000000001')->'badges')=3,'only three highlighted medals shared');
set request.jwt.claim.sub='a0000000-0000-4000-8000-000000000003';
do $$ begin begin perform get_friend_showcase('a0000000-0000-4000-8000-000000000001');raise exception 'stranger accessed profile';exception when raise_exception then if sqlerrm='stranger accessed profile' then raise;end if;end;end $$;
select 'PASS achievements: permanent recognition, zero retroactive coins, three highlights, privacy and isolation';
rollback;
