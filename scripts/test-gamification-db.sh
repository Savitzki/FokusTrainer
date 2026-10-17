#!/usr/bin/env bash
set -euo pipefail
task_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
task_container=$(docker run --detach --rm --network none --env POSTGRES_HOST_AUTH_METHOD=trust postgres:17-alpine)
trap 'docker rm --force "$task_container" >/dev/null 2>&1 || true' EXIT
for attempt in $(seq 1 120); do
 if docker exec "$task_container" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; then break;fi
 sleep 0.25
done
docker exec "$task_container" pg_isready -h 127.0.0.1 -U postgres >/dev/null
docker exec -i "$task_container" psql -U postgres -v ON_ERROR_STOP=1 < "$task_root/supabase/tests/bootstrap.sql"
docker exec "$task_container" psql -U postgres -c 'alter table auth.users add column email text;'
for file in "$task_root"/supabase/migrations/*.sql; do
 docker exec -i "$task_container" psql -U postgres -v ON_ERROR_STOP=1 < "$file"
done
# psql \ir fixtures resolve relative to the tests' directory in the container.
docker cp "$task_root/supabase/tests" "$task_container:/tmp/fokus-tests"
for file in gamification-missions gamification-achievements gamification-reports gamification-challenges gamification-cosmetics; do
 docker exec "$task_container" psql -U postgres -v ON_ERROR_STOP=1 -f "/tmp/fokus-tests/$file.sql"
done
# Two devices buy the same permanent item concurrently; only one charge/inventory row.
docker exec -i "$task_container" psql -U postgres -v ON_ERROR_STOP=1 <<'SQL'
insert into auth.users(id) values('b0000000-0000-4000-8000-000000000001');
insert into profiles(id,nickname) values('b0000000-0000-4000-8000-000000000001','gamify.concurrent');
set request.jwt.claim.sub='b0000000-0000-4000-8000-000000000001';
select get_training_state('UTC');
update training_accounts set started_on=date_trunc('week',now())::date-7 where user_id=auth.uid();
update training_plans set effective_on=date_trunc('week',now())::date-7,created_at=date_trunc('week',now())-interval '7 days' where user_id=auth.uid();
insert into gf_accounts(user_id) values(auth.uid());
insert into gf_cycles(user_id,week_start,starts_on,planned_days,rewards) values(auth.uid(),date_trunc('week',now())::date-7,date_trunc('week',now())::date-7,array(select date_trunc('week',now())::date-7+x from generate_series(0,4) x),'{"bonus":50}');
insert into gf_missions(user_id,week_start,key,target,reward) values
(auth.uid(),date_trunc('week',now())::date-7,'workouts',3,10),
(auth.uid(),date_trunc('week',now())::date-7,'weight',2,10),
(auth.uid(),date_trunc('week',now())::date-7,'schedule',5,20),
(auth.uid(),date_trunc('week',now())::date-7,'consistency',7,30);
insert into workout_days(user_id,day,activity,minutes,confirmed_at) select auth.uid(),date_trunc('week',now())::date-7+x,'Caminhada',30,(date_trunc('week',now())::date-7+x)::timestamp+interval '12 hours' from generate_series(0,2) x;
select economy_post(auth.uid(),'fixture','workout','Fixture',500,current_date);
SQL
for device in 1 2; do
 docker exec "$task_container" psql -U postgres -v ON_ERROR_STOP=1 -c "begin;set role authenticated;set request.jwt.claim.sub='b0000000-0000-4000-8000-000000000001';select buy_cosmetic('frame-ember','UTC');select get_gamification_state('UTC');select pg_sleep(0.1);commit;" >/dev/null &
 if [[ "$device" == 1 ]]; then first_device=$!;else second_device=$!;fi
done
wait "$first_device";wait "$second_device"
docker exec -i "$task_container" psql -U postgres -v ON_ERROR_STOP=1 <<'SQL'
do $$ begin
 if (select count(*) from gf_inventory where user_id='b0000000-0000-4000-8000-000000000001')<>1 or
  (select balance from coin_wallets where user_id='b0000000-0000-4000-8000-000000000001')<>410 or
  (select count(*) from coin_movements where user_id='b0000000-0000-4000-8000-000000000001' and kind='mission')<>1 then raise exception 'Concurrent purchase or mission duplicated';end if;
end $$;
select 'PASS two concurrent devices: one permanent purchase, one debit and one mission reward';
SQL
