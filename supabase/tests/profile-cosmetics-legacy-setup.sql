-- Synthetic account in disposable database only, before catalog migration.
insert into auth.users(id) values('c3000000-0000-4000-8000-000000000001');
insert into profiles(id,nickname) values('c3000000-0000-4000-8000-000000000001','profile.legacy');
set request.jwt.claim.sub='c3000000-0000-4000-8000-000000000001';
select get_training_state('UTC');
select economy_post(auth.uid(),'fixture','workout','Synthetic legacy fixture',2000,current_date);
select buy_cosmetic('frame-energy','UTC');
select buy_cosmetic('share-night','UTC');
select buy_cosmetic('theme-progress','UTC');
select buy_cosmetic('emoji-fire','UTC');
select equip_cosmetic('frame','frame-energy','UTC');
select equip_cosmetic('share','share-night','UTC');
select equip_cosmetic('theme','theme-progress','UTC');
select equip_cosmetic('emoji','emoji-fire','UTC');
create table profile_cosmetics_legacy_snapshot as select
 (select balance from coin_wallets where user_id=auth.uid()) as balance,
 (select jsonb_agg(to_jsonb(v) order by item_id) from gf_inventory v where user_id=auth.uid()) as inventory,
 (select jsonb_agg(to_jsonb(m) order by id) from coin_movements m where user_id=auth.uid()) as movements,
 (select jsonb_agg(to_jsonb(e) order by category) from gf_equipped e where user_id=auth.uid()) as equipped;
