#!/usr/bin/env bash
# Disposable PostgreSQL only; account and wallet locks must work across devices.
set -euo pipefail
task_db="$1"
task_logs=$(mktemp -d)
trap 'rm -rf "$task_logs"' EXIT
docker exec --interactive "$task_db" psql -U postgres -v ON_ERROR_STOP=1 <<'SQL'
insert into auth.users(id) select ('27272727-2727-4727-8727-'||lpad(n::text,12,'0'))::uuid from generate_series(1,3) n;
insert into profiles(id,nickname) select ('27272727-2727-4727-8727-'||lpad(n::text,12,'0'))::uuid,'monthly.race.'||n from generate_series(1,3) n;
insert into training_accounts(user_id,time_zone,started_on) select ('27272727-2727-4727-8727-'||lpad(n::text,12,'0'))::uuid,'UTC',current_date from generate_series(1,3) n;
select economy_post(('27272727-2727-4727-8727-'||lpad(n::text,12,'0'))::uuid,'seed','workout','Fixture',250,current_date) from generate_series(2,3) n;
SQL
run_as() {
 local task_user="$1" task_sql="$2"
 docker exec "$task_db" psql -U postgres -v ON_ERROR_STOP=1 -c "begin; set role authenticated; set request.jwt.claim.sub='$task_user'; $task_sql select pg_sleep(0.1); commit;"
}
for task_index in 1 2; do
 run_as '27272727-2727-4727-8727-000000000001' "select get_economy_state('Pacific/Kiritimati');" >"$task_logs/grant-$task_index" 2>&1 &
 if [[ "$task_index" == 1 ]];then first_task=$!;else second_task=$!;fi
done
wait "$first_task" || { cat "$task_logs/grant-1";exit 1; }
wait "$second_task" || { cat "$task_logs/grant-2";exit 1; }
for task_index in 1 2; do
 run_as '27272727-2727-4727-8727-000000000002' "select buy_medical_kit('28282828-2828-4828-8828-00000000000$task_index','UTC');" >"$task_logs/buy-$task_index" 2>&1 &
 if [[ "$task_index" == 1 ]];then first_task=$!;else second_task=$!;fi
done
task_success=0
if wait "$first_task";then task_success=$((task_success+1));fi
if wait "$second_task";then task_success=$((task_success+1));fi
if [[ "$task_success" != 1 ]];then cat "$task_logs/buy-1" "$task_logs/buy-2";exit 1;fi
for task_index in 1 2; do
 run_as '27272727-2727-4727-8727-000000000003' "select buy_medical_kit('28282828-2828-4828-8828-000000000003','UTC'); select use_medical_kit(current_date,'UTC');" >"$task_logs/retry-$task_index" 2>&1 &
 if [[ "$task_index" == 1 ]];then first_task=$!;else second_task=$!;fi
done
wait "$first_task" || { cat "$task_logs/retry-1";exit 1; }
wait "$second_task" || { cat "$task_logs/retry-2";exit 1; }
docker exec --interactive "$task_db" psql -U postgres -v ON_ERROR_STOP=1 <<'SQL'
do $$ declare u uuid;begin
 for u in select id from auth.users where id::text like '27272727-%' loop
  if (select count(*) from medical_kits where user_id=u and grant_month=date_trunc('month',current_date)::date)<>2 then raise exception 'Concurrent devices duplicated monthly grant';end if;
 end loop;
 if (select revision from coin_wallets where user_id='27272727-2727-4727-8727-000000000001')<>1 then raise exception 'Repeated grant changed revision';end if;
 for u in select id from auth.users where id in('27272727-2727-4727-8727-000000000002','27272727-2727-4727-8727-000000000003') loop
  if (select balance from coin_wallets where user_id=u)<>0 or (select count(*) from medical_kits where user_id=u and purchase_id is not null)<>1
  or (select count(*) from coin_movements where user_id=u and kind='kit-purchase')<>1 then raise exception 'Purchase raced into negative balance or duplicate inventory';end if;
 end loop;
 if (select count(*) from medical_kits where user_id='27272727-2727-4727-8727-000000000003' and used_on=current_date)<>1
 or (select count(*) from medical_kits where user_id='27272727-2727-4727-8727-000000000003' and purchase_id is not null and used_on is null)<>1 then raise exception 'Concurrent uses consumed twice or spent paid kit first';end if;
end $$;
select 'PASS: concurrent monthly grants, 250-coin purchases, retries, free-first consumption and one protection per day' as result;
SQL
