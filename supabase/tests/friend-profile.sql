-- Synthetic accounts only; all changes roll back in disposable PostgreSQL.
begin;
create function pg_temp.profile_check(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',label;end if;end $$;
insert into auth.users(id,raw_user_meta_data) values
 ('d3600000-0000-4000-8000-000000000001','{}'),
 ('d3600000-0000-4000-8000-000000000002','{"display_name":"Beatriz","email":"secret@example.invalid","weight":70,"sex":"private"}'),
 ('d3600000-0000-4000-8000-000000000003','{}');
insert into profiles(id,nickname,avatar_style,avatar_color,avatar_photo) values
 ('d3600000-0000-4000-8000-000000000001','friend.viewer','initials','orange',null),
 ('d3600000-0000-4000-8000-000000000002','friend.bia','runner','forest','data:image/png;base64,YQ=='),
 ('d3600000-0000-4000-8000-000000000003','friend.stranger','initials','orange',null);
insert into training_accounts(user_id,time_zone,started_on,revision)
 select id,'America/Sao_Paulo',(now() at time zone 'America/Sao_Paulo')::date-5,1
 from profiles where id::text like 'd3600000-%';
insert into training_plans(user_id,revision,effective_on,training_days,starts_immediately,created_at)
 select user_id,1,started_on,array[1,2,3,4,5,6,7],true,started_on::timestamp at time zone time_zone
 from training_accounts where user_id::text like 'd3600000-%';
insert into gf_accounts(user_id) select user_id from training_accounts where user_id::text like 'd3600000-%';
insert into coin_wallets(user_id) select user_id from training_accounts where user_id::text like 'd3600000-%';
select economy_post('d3600000-0000-4000-8000-000000000002','friend-profile-fixture','workout','Fixture',1000,current_date);
set request.jwt.claim.sub='d3600000-0000-4000-8000-000000000002';
select buy_cosmetic('frame-water-wave','America/Sao_Paulo');
select buy_cosmetic('banner-forest','America/Sao_Paulo');
select equip_cosmetic('frame','frame-water-wave','America/Sao_Paulo');
select equip_cosmetic('banner','banner-forest','America/Sao_Paulo');
insert into workout_days(user_id,day,activity,minutes,confirmed_at)
 select auth.uid(),(now() at time zone 'America/Sao_Paulo')::date-x,'Corrida',35,
 (((now() at time zone 'America/Sao_Paulo')::date-x)::timestamp+interval '12 hours') at time zone 'America/Sao_Paulo'
 from unnest(array[5,4,2]) x;
insert into training_extra_rests(user_id,day,authorized_at)
 values(auth.uid(),(now() at time zone 'America/Sao_Paulo')::date-3,now()-interval '5 days');
-- Existing protection uses the same day semantics as the official calculation.
select economy_grant_monthly_kits(auth.uid(),(now() at time zone 'America/Sao_Paulo')::date);
update medical_kits set used_on=(now() at time zone 'America/Sao_Paulo')::date-1,used_at=now()-interval '1 day'
 where user_id=auth.uid() and grant_slot=1;
insert into gf_badges(user_id,key,earned_at,historical)
 select auth.uid(),x,'2026-01-01T12:00:00Z',true from unnest(array['workout-1','friend','group']) x;
update gf_accounts set featured=array['workout-1','friend','group'],show_badges=true where user_id=auth.uid();
create temporary table profile_wallet_before as select * from coin_wallets;
create temporary table profile_movements_before as select * from coin_movements;
create temporary table profile_badges_before as select * from gf_badges;
create temporary table profile_training_before as select * from workout_days;
set request.jwt.claim.sub='d3600000-0000-4000-8000-000000000001';
-- A pending invitation is not a friendship. Authorization precedes all reads.
insert into friendships(requester,recipient) values(auth.uid(),'d3600000-0000-4000-8000-000000000002');
do $$ begin
 begin perform get_friend_showcase('d3600000-0000-4000-8000-000000000002');raise exception 'pending accepted';
 exception when raise_exception then if sqlerrm='pending accepted' then raise;end if;end;
end $$;
update friendships set status='accepted' where requester=auth.uid();
-- Real authenticated role has only the RPC, no direct access to the target account.
set local role authenticated;
do $$ declare v jsonb;begin
 v:=get_friend_showcase('d3600000-0000-4000-8000-000000000002');
 perform pg_temp.profile_check(v->>'displayName'='Beatriz' and v->>'nickname'='friend.bia','display name and immutable nickname');
 perform pg_temp.profile_check(v->'avatar'->>'style'='runner' and v->'avatar'->>'photo'='data:image/png;base64,YQ==','real avatar and photo');
 perform pg_temp.profile_check(v->>'frame'='frame-water-wave' and v->>'banner'='banner-forest','equipped active cosmetics');
 perform pg_temp.profile_check(v->'streak'='{"current":3,"best":3}'::jsonb,'official points; rest and protection do not add points');
 perform pg_temp.profile_check(jsonb_array_length(v->'badges')=3 and v->'badges'->0->>'key'='workout-1','only three featured medals in order');
 perform pg_temp.profile_check(not(v ?| array['email','weight','sex','balance','progress','user_metadata']),'no private account fields');
 perform pg_temp.profile_check(v=get_friend_showcase('d3600000-0000-4000-8000-000000000002'),'idempotent profile read');
end $$;
reset role;
update gf_accounts set show_badges=false where user_id='d3600000-0000-4000-8000-000000000002';
select pg_temp.profile_check(jsonb_array_length(get_friend_showcase('d3600000-0000-4000-8000-000000000002')->'badges')=0,'private medals stay private');
-- Removing cosmetics or disabling old products keeps the free appearance valid.
update gf_items set enabled=false where id='frame-water-wave';
delete from gf_equipped where user_id='d3600000-0000-4000-8000-000000000002' and category='banner';
select pg_temp.profile_check(get_friend_showcase('d3600000-0000-4000-8000-000000000002')->'frame'='null'::jsonb
 and get_friend_showcase('d3600000-0000-4000-8000-000000000002')->'banner'='null'::jsonb,'unequipped/retired cosmetics never leak into rendering');
select pg_temp.profile_check(get_friend_showcase('d3600000-0000-4000-8000-000000000002')->'avatar'->>'photo'='data:image/png;base64,YQ==','avatar independent of frame');
update friendships set status='declined' where requester=auth.uid();
do $$ begin
 begin perform get_friend_showcase('d3600000-0000-4000-8000-000000000002');raise exception 'removed accepted';
 exception when raise_exception then if sqlerrm='removed accepted' then raise;end if;end;
end $$;
set request.jwt.claim.sub='d3600000-0000-4000-8000-000000000003';
do $$ begin
 begin perform get_friend_showcase('d3600000-0000-4000-8000-000000000002');raise exception 'stranger accepted';
 exception when raise_exception then if sqlerrm='stranger accepted' then raise;end if;end;
end $$;
set request.jwt.claim.sub='';
do $$ begin
 begin perform get_friend_showcase('d3600000-0000-4000-8000-000000000002');raise exception 'anonymous accepted';
 exception when raise_exception then if sqlerrm='anonymous accepted' then raise;end if;end;
end $$;
select pg_temp.profile_check(not has_function_privilege('anon','public.get_friend_showcase(uuid)','EXECUTE'),'anonymous RPC denied');
select pg_temp.profile_check(not exists((select * from coin_wallets except select * from profile_wallet_before)
 union all (select * from profile_wallet_before except select * from coin_wallets)),'no wallet changes');
select pg_temp.profile_check(not exists((select * from coin_movements except select * from profile_movements_before)
 union all (select * from profile_movements_before except select * from coin_movements)),'no currency or purchases awarded');
select pg_temp.profile_check(not exists((select * from gf_badges except select * from profile_badges_before)
 union all (select * from profile_badges_before except select * from gf_badges)),'no badge changes');
select pg_temp.profile_check(not exists((select * from workout_days except select * from profile_training_before)
 union all (select * from profile_training_before except select * from workout_days)),'workout history unchanged');
select 'PASS friend profile: authentication, friendship/privacy gates, official streak, cosmetics, idempotency and no new rewards';
rollback;
