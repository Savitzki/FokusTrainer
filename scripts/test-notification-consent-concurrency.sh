#!/usr/bin/env bash
set -euo pipefail
task_container=${1:?Disposable PostgreSQL container required}
docker exec "$task_container" psql -U postgres -v ON_ERROR_STOP=1 -c "insert into auth.users(id) values('d8000000-0000-4000-8000-000000000004');insert into profiles(id,nickname) values('d8000000-0000-4000-8000-000000000004','notify.concurrent');" >/dev/null
for device in 1 2;do
 docker exec "$task_container" psql -U postgres -v ON_ERROR_STOP=1 -c "begin;set local role authenticated;set local request.jwt.claim.sub='d8000000-0000-4000-8000-000000000004';select enable_push_notifications('d8000000-0000-4000-8000-000000000014','https://fcm.googleapis.com/consent-concurrent',repeat('A',87),repeat('A',22),repeat('A',87),'UTC');select pg_sleep(0.1);commit;" >/dev/null &
 if [[ "$device" == 1 ]];then first_device=$!;else second_device=$!;fi
done
wait "$first_device";wait "$second_device"
docker exec -i "$task_container" psql -U postgres -v ON_ERROR_STOP=1 <<'SQL'
do $$ begin
 if(select count(*) from notification_consents where user_id='d8000000-0000-4000-8000-000000000004')<>1 or
 (select count(*) from push_devices where user_id='d8000000-0000-4000-8000-000000000004')<>1 then raise exception 'Concurrent consent duplicated';end if;
end $$;
select 'PASS simultaneous enrollment: one consent and one subscription';
SQL
