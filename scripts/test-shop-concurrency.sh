#!/usr/bin/env bash
set -euo pipefail
shop_container=${1:?Disposable PostgreSQL container required}
docker exec -i "$shop_container" psql -U postgres -v ON_ERROR_STOP=1 <<'SQL'
insert into auth.users(id) values('c2600000-0000-4000-8000-000000000001'),('c2600000-0000-4000-8000-000000000002');
insert into profiles(id,nickname) values('c2600000-0000-4000-8000-000000000001','shop.concurrent'),('c2600000-0000-4000-8000-000000000002','shop.friend');
set request.jwt.claim.sub='c2600000-0000-4000-8000-000000000001';
select get_training_state('UTC');
select economy_post(auth.uid(),'shop-fixture','workout','Synthetic fixture',500,current_date);
insert into streak_groups(id,owner_id,name,time_zone,status,started_on) values('c2600000-0000-4000-8000-000000000003',auth.uid(),'Synthetic group','UTC','active',current_date);
insert into group_members(group_id,user_id,status) values('c2600000-0000-4000-8000-000000000003',auth.uid(),'accepted'),('c2600000-0000-4000-8000-000000000003','c2600000-0000-4000-8000-000000000002','accepted');
insert into workout_days(user_id,day,activity,minutes) values('c2600000-0000-4000-8000-000000000002',current_date,'Synthetic walk',35);
SQL
for device in 1 2; do
 docker exec "$shop_container" psql -U postgres -v ON_ERROR_STOP=1 -c "begin;set role authenticated;set request.jwt.claim.sub='c2600000-0000-4000-8000-000000000001';select buy_cosmetic('emoji-fire','UTC');select equip_cosmetic('emoji','emoji-fire','UTC');select set_group_reaction('c2600000-0000-4000-8000-000000000003','c2600000-0000-4000-8000-000000000002','emoji-fire');select pg_sleep(0.1);commit;" >/dev/null &
 if [[ "$device" == 1 ]];then first_device=$!;else second_device=$!;fi
done
wait "$first_device";wait "$second_device"
docker exec -i "$shop_container" psql -U postgres -v ON_ERROR_STOP=1 <<'SQL'
do $$ begin
 if (select balance from coin_wallets where user_id='c2600000-0000-4000-8000-000000000001')<>470
 or(select count(*) from gf_inventory where user_id='c2600000-0000-4000-8000-000000000001')<>1
 or(select count(*) from coin_movements where user_id='c2600000-0000-4000-8000-000000000001' and kind='cosmetic-purchase')<>1
 or(select count(*) from group_workout_reactions where group_id='c2600000-0000-4000-8000-000000000003')<>1
 then raise exception 'Concurrent emoji purchase/reaction duplicated';end if;
end $$;
select 'PASS shop concurrency: two devices, one debit, one emoji, one favorite, one reaction';
SQL
