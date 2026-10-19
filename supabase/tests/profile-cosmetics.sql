begin;
create function pg_temp.check_ok(ok boolean,label text) returns void language plpgsql as $$ begin
 if ok is distinct from true then raise exception 'FAIL: %',label; end if; end $$;
set request.jwt.claim.sub='c3000000-0000-4000-8000-000000000001';
select pg_temp.check_ok((select balance=(select balance from coin_wallets where user_id=auth.uid())
 and inventory=(select jsonb_agg(to_jsonb(v) order by item_id) from gf_inventory v where user_id=auth.uid())
 and movements=(select jsonb_agg(to_jsonb(m) order by id) from coin_movements m where user_id=auth.uid())
 and equipped=(select jsonb_agg(to_jsonb(e) order by category) from gf_equipped e where user_id=auth.uid())
 from profile_cosmetics_legacy_snapshot),'migration preserves balances, exact inventory, equipment records and financial history');
select pg_temp.check_ok((select count(*)=8 from gf_items where enabled)
 and (select count(*)=4 from gf_items where enabled and category='frame')
 and (select count(*)=4 from gf_items where enabled and category='banner'),'exactly eight active profile cosmetics');
select pg_temp.check_ok((select jsonb_object_agg(id,price) from gf_items where enabled)=
 '{"frame-sport-band":80,"frame-water-wave":150,"frame-living-flame":250,"frame-classic":450,"banner-sunset":100,"banner-forest":180,"banner-night":300,"banner-barbecue":250}'::jsonb,'all approved server prices');
select pg_temp.check_ok(not exists(select 1 from jsonb_array_elements(gf_profile_cosmetics_state(auth.uid())) x
 where x->>'id'='frame-energy' and (x->>'equipped')::boolean),'retired equipped frame is suppressed without deleting record');
select pg_temp.check_ok((select count(*)=3 from jsonb_array_elements(gf_profile_cosmetics_state(auth.uid())) x
 where x->>'category' in('share','theme','emoji') and (x->>'equipped')::boolean),'legacy sharing, themes and reactions remain equipped');
select pg_temp.check_ok(not exists(select 1 from jsonb_array_elements(get_gamification_state('UTC',2)->'cosmetics') x where x->>'category'='banner'),'version 2 installed PWA remains parseable');
select pg_temp.check_ok((select count(*)=4 from jsonb_array_elements(get_gamification_state('UTC',3)->'cosmetics') x where x->>'category'='banner'),'version 3 receives banners');
do $$ begin
 begin perform buy_cosmetic('frame-night','UTC');raise exception 'retired item bought';exception when raise_exception then if sqlerrm='retired item bought' then raise;end if;end;
 begin perform equip_cosmetic('frame','frame-energy','UTC');raise exception 'retired frame equipped';exception when raise_exception then if sqlerrm='retired frame equipped' then raise;end if;end;
 begin perform equip_cosmetic('banner','banner-sunset','UTC');raise exception 'unowned banner equipped';exception when raise_exception then if sqlerrm='unowned banner equipped' then raise;end if;end;
end $$;
select buy_cosmetic('frame-sport-band','UTC');
select buy_cosmetic('frame-sport-band','Pacific/Kiritimati');
select buy_cosmetic('banner-sunset','UTC');
select buy_cosmetic('banner-sunset','UTC');
select pg_temp.check_ok((select balance=1140 from coin_wallets where user_id=auth.uid())
 and (select count(*)=6 from gf_inventory where user_id=auth.uid())
 and (select count(*)=6 from coin_movements where user_id=auth.uid() and kind='cosmetic-purchase'),'one charge per purchase including retry');
select equip_cosmetic('frame','frame-sport-band','UTC');
select equip_cosmetic('banner','banner-sunset','UTC');
select pg_temp.check_ok((select count(*)=2 from jsonb_array_elements(get_gamification_state('UTC',3)->'cosmetics') x
 where x->>'id' in('frame-sport-band','banner-sunset') and (x->>'owned')::boolean and (x->>'equipped')::boolean),'reloaded state retains frame and independent profile banner');
select pg_temp.check_ok((gf_social_appearance(auth.uid())->>'frame')='frame-sport-band','Arena uses the same current frame');
insert into auth.users(id) values('c3000000-0000-4000-8000-000000000003');
insert into profiles(id,nickname) values('c3000000-0000-4000-8000-000000000003','profile.friend');
insert into friendships(requester,recipient,status) values(auth.uid(),'c3000000-0000-4000-8000-000000000003','accepted');
insert into streak_groups(id,owner_id,name,time_zone,status,started_on) values('c3000000-0000-4000-8000-000000000004',auth.uid(),'Synthetic profile group','UTC','active',current_date);
insert into group_members(group_id,user_id,status) values('c3000000-0000-4000-8000-000000000004',auth.uid(),'accepted'),('c3000000-0000-4000-8000-000000000004','c3000000-0000-4000-8000-000000000003','accepted');
insert into workout_days(user_id,day,activity,minutes) values('c3000000-0000-4000-8000-000000000003',current_date,'Synthetic walk',35);
select set_group_reaction('c3000000-0000-4000-8000-000000000004','c3000000-0000-4000-8000-000000000003','emoji-fire');
select pg_temp.check_ok((get_group_reactions('c3000000-0000-4000-8000-000000000004')->0->>'itemId')='emoji-fire','owned retired emojis still react to group workouts');
select pg_temp.check_ok(exists(select 1 from jsonb_array_elements(get_social_state()->'groups') g,
 jsonb_array_elements(g->'members') m where m->>'id'=auth.uid()::text and m->>'frame'='frame-sport-band'
 and m->'avatar'->>'nickname'='profile.legacy'),'Arena group members receive equipped frame and actual avatar');
set request.jwt.claim.sub='c3000000-0000-4000-8000-000000000003';
select pg_temp.check_ok(exists(select 1 from jsonb_array_elements(get_social_state()->'friends') f
 where f->>'id'='c3000000-0000-4000-8000-000000000001' and f->>'frame'='frame-sport-band'),'accepted friends see equipped frame');
set request.jwt.claim.sub='c3000000-0000-4000-8000-000000000001';
select equip_cosmetic('banner',null,'UTC');
select equip_cosmetic('frame',null,'UTC');
select pg_temp.check_ok((select count(*)=6 from gf_inventory where user_id=auth.uid())
 and (select balance=1140 from coin_wallets where user_id=auth.uid()),'unequipping neither deletes purchases nor debits wallet');
select economy_post(auth.uid(),'test-spend','cosmetic-purchase','Synthetic test debit',-1140,current_date);
do $$ begin begin perform buy_cosmetic('banner-night','UTC');raise exception 'insufficient funds accepted';exception when raise_exception then if sqlerrm='insufficient funds accepted' then raise;end if;end;end $$;
select pg_temp.check_ok((select balance=0 from coin_wallets where user_id=auth.uid())
 and not exists(select 1 from gf_inventory where user_id=auth.uid() and item_id='banner-night'),'insufficient funds rolls back inventory and money');
select pg_temp.check_ok(not has_function_privilege('authenticated','gf_profile_cosmetics_state(uuid)','EXECUTE')
 and not has_function_privilege('authenticated','gf_social_appearance(uuid)','EXECUTE')
 and not has_function_privilege('authenticated','profile_base_social_state()','EXECUTE')
 and not has_function_privilege('anon','get_social_state()','EXECUTE')
 and not has_table_privilege('authenticated','gf_inventory','INSERT,UPDATE,DELETE')
 and not has_table_privilege('authenticated','gf_equipped','INSERT,UPDATE,DELETE'),'private helpers, authenticated RPCs, server-owned inventory and RLS');
insert into auth.users(id) values('c3000000-0000-4000-8000-000000000002');
insert into profiles(id,nickname) values('c3000000-0000-4000-8000-000000000002','profile.other');
set request.jwt.claim.sub='c3000000-0000-4000-8000-000000000002';
select pg_temp.check_ok(not exists(select 1 from jsonb_array_elements(get_gamification_state('UTC',3)->'cosmetics') x where (x->>'owned')::boolean),'account inventory isolation');
select pg_temp.check_ok(not exists(select 1 from jsonb_array_elements(get_social_state()->'friends') x where x->>'id'='c3000000-0000-4000-8000-000000000001'),'no unrelated user appearance exposed');
select 'PASS profile cosmetics: exact catalog, migration preservation, server prices, retired items, banner, reload, isolation, insufficient funds, legacy compatibility';
rollback;
