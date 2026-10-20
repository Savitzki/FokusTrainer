-- All fixtures are isolated and rolled back. Never execute on production.
begin;
create function pg_temp.verify(ok boolean,label text) returns void language plpgsql as $$ begin
 if ok is distinct from true then raise exception 'FAIL achievements: %',label;end if;
end $$;
-- Every achievement evaluation must leave financial state unchanged.
create function pg_temp.badge_state(p_user uuid) returns jsonb language plpgsql as $$
declare before_value jsonb;after_value jsonb;result jsonb;
begin
 select jsonb_build_object('wallet',coalesce((select to_jsonb(w) from coin_wallets w where user_id=p_user),'null'::jsonb),
 'ledger',coalesce((select jsonb_agg(to_jsonb(m) order by id) from coin_movements m where user_id=p_user),'[]'::jsonb)) into before_value;
 result:=gf_badges_state(p_user);
 select jsonb_build_object('wallet',coalesce((select to_jsonb(w) from coin_wallets w where user_id=p_user),'null'::jsonb),
 'ledger',coalesce((select jsonb_agg(to_jsonb(m) order by id) from coin_movements m where user_id=p_user),'[]'::jsonb)) into after_value;
 perform pg_temp.verify(before_value=after_value,'badge evaluation cannot modify balances, revisions or ledger');
 return result;
end $$;
do $$ declare t record;digest_value text;begin
 for t in select * from achievement_catalog_legacy_baseline loop
  execute format('select md5(coalesce(string_agg(v::text,''|'' order by v::text),'''')) from (select to_jsonb(x)-''achievement_catalog_seen_at'' v from public.%I x) rows',t.table_name) into digest_value;
  if digest_value is distinct from t.digest then raise exception '032 modified existing rows: %',t.table_name;end if;
 end loop;
end $$;
select pg_temp.verify((select count(*)=28 from gf_badge_catalog),'exactly 28 medals');
select pg_temp.verify((select count(*)=28 from jsonb_array_elements(pg_read_file('/tmp/fokus-tests/achievement-catalog.json')::jsonb) x
 join gf_badge_catalog c on c.key=x->>'key' and c.name=x->>'name' and c.description=x->>'description'
 and c.rarity=x->>'rarity' and c.category=x->>'category' and c.metric=x->>'metric' and c.goal=(x->>'goal')::integer
 and c.medal_key=x->>'medalKey'),'approved texts, IDs, categories, rarities, goals and visual keys');
select pg_temp.verify((select count(*)=12 and min(earned_at)='2026-01-01T12:00:00Z' and max(earned_at)='2026-01-01T12:00:00Z'
 from gf_badges where user_id='c3200000-0000-4000-8000-000000000001'),'12 legacy unlock dates preserved');
select pg_temp.badge_state('c3200000-0000-4000-8000-000000000001');
select pg_temp.verify((select record_baseline=99 and featured=array['workout-100','record','collective'] and show_badges
 from gf_accounts where user_id='c3200000-0000-4000-8000-000000000001'),'baseline, three equipped medals, privacy retained');
select pg_temp.verify(not exists(select 1 from gf_badges where user_id='c3200000-0000-4000-8000-000000000001' and key='group-streak-7'),'old seven-point group does not grant participation medal');
select pg_temp.verify(not exists(select 1 from gf_badge_group_points),'no fabricated historical participation');

create function pg_temp.account(n integer,start_on date,days integer[] default array[1,2,3,4,5,6,7],tz text default 'UTC') returns uuid language plpgsql as $$
declare u uuid:=('c3200000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid;
begin
 insert into auth.users(id) values(u);insert into profiles(id,nickname) values(u,'achievements.fixture.'||n);
 insert into training_accounts(user_id,time_zone,started_on) values(u,tz,start_on);
 insert into training_plans(user_id,revision,effective_on,training_days,created_at,starts_immediately) values(u,1,start_on,days,start_on,true);
 insert into gf_accounts(user_id) values(u);insert into coin_wallets(user_id) values(u);return u;
end $$;
-- Every workout milestone, intermediate 24/25, historical confirmation and dedup.
do $$ declare n integer;u uuid;s jsonb;again jsonb;b jsonb;index_value integer:=10;begin
 foreach n in array array[0,1,5,10,24,25,30,50,100,200,365] loop
  index_value:=index_value+1;u:=pg_temp.account(index_value,current_date-2*greatest(n,1)-1);
  insert into workout_days(user_id,day,activity,minutes,confirmed_at)
   select u,current_date-2*x,'Corrida',35,(current_date-2*x)::timestamp+interval '12 hours' from generate_series(1,n) x;
  s:=pg_temp.badge_state(u);again:=pg_temp.badge_state(u);
  perform pg_temp.verify(s=again,'idempotent unlock dates and state');
  for b in select value from jsonb_array_elements(s->'badges') where value->>'category'='frequency' loop
   perform pg_temp.verify((b->>'progress')::integer=least(n,(b->>'goal')::integer),'mandatory workout progress');
   perform pg_temp.verify((b->>'earnedAt' is not null)=(n>=(b->>'goal')::integer),'each cumulative workout threshold');
  end loop;
  perform pg_temp.verify(not exists(select 1 from gf_badges where user_id=u and key='record'),'old record alone does not unlock record medal');
  perform pg_temp.verify((select balance=0 from coin_wallets where user_id=u),'historical recognition never pays');
 end loop;
end $$;

-- Every weekly milestone; alternate fulfilled/missed weeks prove non-consecutive accumulation.
do $$ declare n integer;u uuid;start_on date;monday date:=date_trunc('week',now())::date;s jsonb;b jsonb;begin
 foreach n in array array[1,2,4,8,10,20] loop
  start_on:=monday-14*n;u:=pg_temp.account(100+n,start_on,array[1]);
  insert into workout_days(user_id,day,activity,minutes,confirmed_at)
   select u,start_on+14*x,'Yoga',35,(start_on+14*x)::timestamp+interval '12 hours' from generate_series(0,n-1) x;
  s:=pg_temp.badge_state(u);
  for b in select value from jsonb_array_elements(s->'badges') where value->>'category'='consistency' loop
   perform pg_temp.verify((b->>'progress')::integer=least(n,(b->>'goal')::integer),'accumulated closed weeks');
   perform pg_temp.verify((b->>'earnedAt' is not null)=(n>=(b->>'goal')::integer),'each consistency threshold');
  end loop;
 end loop;
end $$;

-- Same standard for 1 or 7 days. Kits do not make lost obligations fulfilled;
-- extra rest and rescheduling retain the existing valid calendar semantics.
do $$ declare u uuid;v uuid;w uuid;monday date:=date_trunc('week',now())::date-7;s jsonb;begin
 u:=pg_temp.account(201,monday,array[1]);v:=pg_temp.account(202,monday);w:=pg_temp.account(203,monday,array[1,2]);
 insert into workout_days(user_id,day,activity,minutes,confirmed_at) values(u,monday,'Yoga',35,monday::timestamp+interval '12 hours');
 insert into workout_days(user_id,day,activity,minutes,confirmed_at) select v,monday+x,'Yoga',35,(monday+x)::timestamp+interval '12 hours' from generate_series(0,6) x;
 perform pg_temp.badge_state(u);perform pg_temp.badge_state(v);
 perform pg_temp.verify((select count(*)=2 from gf_badges where user_id in(u,v) and key='week-1'),'same week criterion across plan quantities');
 insert into workout_days(user_id,day,activity,minutes,confirmed_at) values(w,monday,'Yoga',35,monday::timestamp+interval '12 hours');
 perform economy_grant_monthly_kits(w,monday+1);
 update medical_kits set used_on=monday+1,used_at=(monday+1)::timestamp+interval '12 hours' where user_id=w and grant_slot=1;
 s:=pg_temp.badge_state(w);
 perform pg_temp.verify((select fulfilled from gf_weeks where user_id=w and week_start=monday),'weekly snapshot is not rewritten');
 perform pg_temp.verify(not exists(select 1 from gf_badges where user_id=w and key='week-1'),'kit without training is not a completed achievement week');
 u:=pg_temp.account(204,monday,array[1,2]);
 insert into workout_days(user_id,day,activity,minutes,confirmed_at) values(u,monday,'Yoga',35,monday::timestamp+interval '12 hours');
 insert into training_extra_rests(user_id,day,authorized_at) values(u,monday+1,monday::timestamp);
 perform pg_temp.badge_state(u);
 perform pg_temp.verify(exists(select 1 from gf_badges where user_id=u and key='week-1'),'authorized extra rest stays valid');
 u:=pg_temp.account(205,monday,array[1,2]);
 insert into training_reschedules(user_id,original_day,target_day,week_start,revision,created_at) values(u,monday,monday+2,monday,2,monday::timestamp+interval '1 hour');
 insert into workout_days(user_id,day,activity,minutes,confirmed_at) select u,monday+x,'Yoga',35,(monday+x)::timestamp+interval '12 hours' from unnest(array[1,2]) x;
 perform pg_temp.badge_state(u);
 perform pg_temp.verify(exists(select 1 from gf_badges where user_id=u and key='week-1'),'compensatory completion counts');
end $$;

-- Every official streak threshold: one weekly point with six neutral days.
do $$ declare n integer;u uuid;start_on date;monday date:=date_trunc('week',now())::date;s jsonb;b jsonb;begin
 foreach n in array array[3,7,14,30] loop
  start_on:=monday-7*n;u:=pg_temp.account(300+n,start_on,array[1]);
  insert into workout_days(user_id,day,activity,minutes,confirmed_at)
   select u,start_on+7*x,'Yoga',35,(start_on+7*x)::timestamp+interval '12 hours' from generate_series(0,n-1) x;
  s:=pg_temp.badge_state(u);
  for b in select value from jsonb_array_elements(s->'badges') where value->>'category'='streak' loop
   perform pg_temp.verify((b->>'progress')::integer=least(n,(b->>'goal')::integer),'streak points, not elapsed calendar days');
   perform pg_temp.verify((b->>'earnedAt' is not null)=(n>=(b->>'goal')::integer),'each best-streak milestone');
  end loop;
 end loop;
 -- Existing reference 2 really improves to 3; the reference itself is immutable.
 u:=pg_temp.account(350,current_date-5);update gf_accounts set record_baseline=2 where user_id=u;
 insert into workout_days(user_id,day,activity,minutes,confirmed_at) select u,current_date-5+x,'Yoga',35,(current_date-5+x)::timestamp+interval '12 hours' from generate_series(0,2) x;
 s:=pg_temp.badge_state(u);
 perform pg_temp.verify(exists(select 1 from gf_badges where user_id=u and key='record'),'real record improvement');
 perform pg_temp.verify((select record_baseline=2 from gf_accounts where user_id=u),'record baseline not reset');
 perform pg_temp.verify((gf_streak(u)->>'current')::integer=0 and (gf_streak(u)->>'best')::integer=3,'historical best remains after missing a day');
end $$;

-- Weight milestones use distinct server-accepted local dates, including legacy
-- data, never the weight amount or number of records on the same date.
do $$ declare n integer;u uuid;s jsonb;b jsonb;begin
 foreach n in array array[1,6,7,30] loop
  u:=pg_temp.account(400+n,current_date-40);
  insert into weight_entries(user_id,id,day,kg,recorded_at,confirmed_at)
   select u,gen_random_uuid(),current_date-x,75,(current_date-x)::timestamp+interval '12 hours',(current_date-x)::timestamp+interval '12 hours' from generate_series(1,n) x;
  insert into weight_entries(user_id,id,day,kg,recorded_at,confirmed_at)
   select u,gen_random_uuid(),current_date-1,80,(current_date-1)::timestamp+interval '13 hours',(current_date-1)::timestamp+interval '13 hours' from generate_series(1,10);
  insert into weight_logs(user_id,day,kg,revision,mutation_id) values(u,current_date-1,75,1,gen_random_uuid());
  s:=pg_temp.badge_state(u);
  for b in select value from jsonb_array_elements(s->'badges') where value->>'category'='weight' loop
   perform pg_temp.verify((b->>'progress')::integer=least(n,(b->>'goal')::integer),'distinct weight dates across old and new tables');
   perform pg_temp.verify((b->>'earnedAt' is not null)=(n>=(b->>'goal')::integer),'each weight milestone');
  end loop;
 end loop;
end $$;

-- Accepted relations and distinct, settled, successful collective challenges only.
do $$ declare u uuid:=pg_temp.account(500,current_date-60);v uuid:=pg_temp.account(501,current_date-60);g uuid:=gen_random_uuid();c uuid;s jsonb;n integer;begin
 insert into friendships(requester,recipient,status) values(u,v,'pending');
 insert into streak_groups(id,owner_id,name,time_zone,status,started_on) values(g,v,'Pending member','UTC','active',current_date-1);
 insert into group_members(group_id,user_id,status) values(g,u,'invited'),(g,v,'accepted');
 s:=pg_temp.badge_state(u);
 perform pg_temp.verify(not exists(select 1 from gf_badges where user_id=u and key in('friend','group')),'pending invitations do not count');
 update friendships set status='accepted' where requester=u and recipient=v;
 update group_members set status='accepted' where group_id=g and user_id=u;
 for n in 1..6 loop
  c:=gen_random_uuid();
  insert into gf_challenges(id,owner_id,name,kind,starts_on,ends_on,invite_until,target,rewards,settled_at,cancelled,results)
   values(c,u,'Collective fixture','collective',current_date-14,current_date-8,current_date-15,2,'{}',
    case when n<>4 then now()-interval '7 days' end,n=5,
    jsonb_build_array(jsonb_build_object('completed',case when n=6 then 1 else 2 end)));
  insert into gf_challenge_members(challenge_id,user_id,nickname,status) values(c,u,'Fixture',case when n=3 then 'invited' else 'accepted' end);
 end loop;
 s:=pg_temp.badge_state(u);
 perform pg_temp.verify(gf_collective_wins(u)=2,'ignore invitation, unsettled, cancelled and unfulfilled challenges');
 perform pg_temp.verify(exists(select 1 from gf_badges where user_id=u and key='collective') and not exists(select 1 from gf_badges where user_id=u and key='collective-3'),'first collective criterion retained');
 c:=gen_random_uuid();
 insert into gf_challenges(id,owner_id,name,kind,starts_on,ends_on,invite_until,target,rewards,settled_at,results)
 values(c,u,'Third valid','collective',current_date-14,current_date-8,current_date-15,2,'{}',now()-interval '7 days','[{"completed":2}]');
 insert into gf_challenge_members(challenge_id,user_id,nickname,status) values(c,u,'Fixture','accepted');
 s:=pg_temp.badge_state(u);perform pg_temp.badge_state(u);
 perform pg_temp.verify((select count(*)=4 from gf_badges where user_id=u and key in('friend','group','collective','collective-3')),'all four social medals');
 delete from friendships where requester=u and recipient=v;delete from group_members where group_id=g and user_id=u;
 perform pg_temp.badge_state(u);
 perform pg_temp.verify((select count(*)=4 from gf_badges where user_id=u and key in('friend','group','collective','collective-3')),'social medals permanent after leaving');
end $$;

-- A new membership never inherits an old group record. The old accepted member
-- is also seeded only at activation; backfilled earlier group days are unproven.
do $$ declare u uuid:=pg_temp.account(510,current_date-30);g uuid:='c3210000-0000-4000-8000-000000000001';begin
 insert into group_members(group_id,user_id,status) values(g,u,'accepted');
 perform pg_temp.badge_state(u);
 perform pg_temp.verify(gf_badge_group_progress(u)=0,'joining an old seven-point group grants no progress');
 insert into group_days(group_id,day,members_count,counts_for_streak) values(g,current_date-1,2,true);
 perform pg_temp.verify(gf_badge_group_progress(u)=0,'late snapshot before acceptance is not proof');
end $$;

-- Seven witnessed points within one membership and official run; neutral rests
-- bridge the run, missing days and leaving/rejoining do not.
do $$ declare u uuid;v uuid;g uuid;d date:=current_date-12;n integer;scenario integer;begin
 for scenario in 1..3 loop
  u:=pg_temp.account(520+scenario,d);v:=pg_temp.account(530+scenario,d);g:=gen_random_uuid();
  insert into streak_groups(id,owner_id,name,time_zone,status,started_on) values(g,u,'Participation fixture','UTC','active',d);
  insert into group_members(group_id,user_id,status) values(g,u,'accepted'),(g,v,'invited');
  -- Simulate elapsed days in this disposable fixture; no production clock edit.
  update gf_badge_memberships set accepted_at=d::timestamp where user_id=u and group_id=g;
  for n in 0..7 loop
   if scenario=2 and n=4 then continue;end if;
   if scenario=3 and n=4 then
    delete from group_members where group_id=g and user_id=u;
    insert into group_members(group_id,user_id,status) values(g,u,'accepted');
    update gf_badge_memberships set accepted_at=(d+4)::timestamp where user_id=u and group_id=g and left_at is null;
   end if;
   insert into group_days(group_id,day,members_count,counts_for_streak) values(g,d+n,2,n<>3);
   if n=6 then perform pg_temp.verify(not exists(select 1 from gf_badges where user_id=u and key='group-streak-7'),'six witnessed points are not seven');end if;
  end loop;
  if scenario=1 then delete from streak_groups where id=g;end if;
  perform pg_temp.badge_state(u);
  perform pg_temp.verify(exists(select 1 from gf_badges where user_id=u and key='group-streak-7')=(scenario=1),'one membership/run, seven scoring points, valid rest bridges');
  perform pg_temp.verify(not exists(select 1 from gf_badge_group_points where user_id=v),'unaccepted member never gets participation evidence');
  if scenario=1 then
   perform pg_temp.verify(gf_badge_group_progress(u)=7,'neutral day does not add a point');
   perform pg_temp.verify(exists(select 1 from gf_badges b join gf_badge_group_qualifications q using(user_id) where user_id=u and b.key='group-streak-7' and b.earned_at=q.qualified_at),'real qualification time and permanent proof survive deletion before first read');
  end if;
 end loop;
end $$;

-- One voluntary workout on scheduled rest is neither mandatory count nor a point.
do $$ declare u uuid:=pg_temp.account(550,current_date-7,array[extract(isodow from current_date)::integer]);s jsonb;begin
 insert into workout_days(user_id,day,activity,minutes,confirmed_at) values(u,current_date-1,'Voluntary',35,(current_date-1)::timestamp+interval '12 hours');
 s:=pg_temp.badge_state(u);
 perform pg_temp.verify(not exists(select 1 from gf_badges where user_id=u and key like 'workout-%'),'voluntary rest workout excluded');
end $$;

-- Fixed account date, not the device's new timezone or amount of weight.
do $$ declare u uuid;d date:=(now() at time zone 'Pacific/Kiritimati')::date;s jsonb;begin
 u:=pg_temp.account(560,d-10,array[1,2,3,4,5,6,7],'Pacific/Kiritimati');
 insert into weight_entries(user_id,id,day,kg,recorded_at) values(u,gen_random_uuid(),d,80,now());
 perform set_config('request.jwt.claim.sub',u::text,true);
 s:=get_training_state('Pacific/Pago_Pago');
 perform pg_temp.verify(s->>'timezone'='Pacific/Kiritimati','timezone remains fixed');
 perform pg_temp.badge_state(u);
 perform pg_temp.verify(exists(select 1 from gf_badges where user_id=u and key='weight-1'),'valid account local date is accepted');
end $$;

-- Selected old/new medals remain limited to three and sharing stays opt-in.
set local request.jwt.claim.sub='c3200000-0000-4000-8000-000000000011';
-- Account 11 has no training medal; use the preserved old account instead.
set local request.jwt.claim.sub='c3200000-0000-4000-8000-000000000001';
select set_featured_medals(array['workout-100','record','collective'],false);
do $$ declare friend_id uuid:='c3200000-0000-4000-8000-000000000012';stranger uuid:='c3200000-0000-4000-8000-000000000013';s jsonb;begin
 insert into friendships(requester,recipient,status) values(auth.uid(),friend_id,'accepted');
 perform set_config('request.jwt.claim.sub',friend_id::text,true);
 s:=get_friend_showcase('c3200000-0000-4000-8000-000000000001');
 perform pg_temp.verify(s->'badges'='[]'::jsonb,'private medals hidden');
 perform set_config('request.jwt.claim.sub','c3200000-0000-4000-8000-000000000001',true);
 perform set_featured_medals(array['workout-100','record','collective'],true);
 begin perform set_featured_medals(array['workout-1','workout-10','record','collective'],true);raise exception 'four accepted';exception when raise_exception then if sqlerrm='four accepted' then raise;end if;end;
 begin perform set_featured_medals(array['group-streak-7'],true);raise exception 'locked accepted';exception when raise_exception then if sqlerrm='locked accepted' then raise;end if;end;
 perform set_config('request.jwt.claim.sub',friend_id::text,true);
 s:=get_friend_showcase('c3200000-0000-4000-8000-000000000001');
 perform pg_temp.verify(jsonb_array_length(s->'badges')=3,'three shared highlighted medals');
 perform pg_temp.verify(s->'badges'->0->>'medalKey'='workout-100' and s->'badges'->0->>'rarity'='legendary','shared medal metadata retains IDs and order');
 perform pg_temp.verify(not exists(select 1 from jsonb_array_elements(s->'badges') b where b ? 'progress' or b ? 'kg' or b ? 'weights'),'no private progression or weight data shared');
 perform set_config('request.jwt.claim.sub',stranger::text,true);
 begin perform get_friend_showcase('c3200000-0000-4000-8000-000000000001');raise exception 'stranger accepted';exception when raise_exception then if sqlerrm='stranger accepted' then raise;end if;end;
end $$;

set local role authenticated;
do $$ begin
 begin perform gf_badges_state(auth.uid());raise exception 'private helper exposed';exception when insufficient_privilege then null;end;
 begin perform gf_badge_group_progress(auth.uid());raise exception 'private progress exposed';exception when insufficient_privilege then null;end;
 begin insert into gf_badges(user_id,key,historical) values(auth.uid(),'group-streak-7',false);raise exception 'direct mint allowed';exception when insufficient_privilege then null;end;
 begin select count(*) from gf_badge_memberships;raise exception 'audit data exposed';exception when insufficient_privilege then null;end;
 begin select count(*) from gf_badge_group_points;raise exception 'audit points exposed';exception when insufficient_privilege then null;end;
 begin select count(*) from gf_badge_group_qualifications;raise exception 'qualifications exposed';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$ begin
 perform pg_temp.verify((select bool_and(reward_amount=0) from gf_badge_catalog),'no badge economy activated');
 perform pg_temp.verify(not exists(select 1 from coin_movements where source_key like 'badge:%' or kind not in('workout','weight','kit-purchase','mission','weekly-bonus','challenge','cosmetic-purchase')),'no unexpected badge payouts');
 perform pg_temp.verify((select kit_price=350 and monthly_free_kits=2 from economy_rules),'kit policy unchanged');
end $$;
rollback;
select 'PASS: 28 approved medals, all thresholds, intermediate progress, legacy IDs/dates/baseline, genuine history, calendar/streak/weight rules, social consent/results, audited group participation, privacy and zero badge rewards' as result;
