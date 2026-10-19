#!/usr/bin/env bash
set -euo pipefail
shop_container=${1:?Disposable PostgreSQL container required}
for device in 1 2; do
 docker exec "$shop_container" psql -U postgres -v ON_ERROR_STOP=1 -c "begin;set role authenticated;set request.jwt.claim.sub='c3000000-0000-4000-8000-000000000001';select buy_cosmetic('banner-night','UTC');select equip_cosmetic('banner','banner-night','UTC');select pg_sleep(0.1);commit;" >/dev/null &
 if [[ "$device" == 1 ]];then first_device=$!;else second_device=$!;fi
done
wait "$first_device";wait "$second_device"
docker exec -i "$shop_container" psql -U postgres -v ON_ERROR_STOP=1 <<'SQL'
do $$ begin
 if (select balance from coin_wallets where user_id='c3000000-0000-4000-8000-000000000001')<>1020
 or(select count(*) from gf_inventory where user_id='c3000000-0000-4000-8000-000000000001' and item_id='banner-night')<>1
 or(select count(*) from coin_movements where user_id='c3000000-0000-4000-8000-000000000001' and source_key='cosmetic:banner-night')<>1
 or(select item_id from gf_equipped where user_id='c3000000-0000-4000-8000-000000000001' and category='banner')<>'banner-night'
 then raise exception 'Concurrent banner purchase/equipment inconsistent';end if;
end $$;
select 'PASS profile shop concurrency: two devices, one banner, one debit, persistent equipment';
SQL
