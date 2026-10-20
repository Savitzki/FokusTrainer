#!/usr/bin/env bash
# Disposable PostgreSQL only: independent connections represent devices/worker.
set -euo pipefail
task_db="$1"
task_logs=$(mktemp -d)
trap 'rm -rf "$task_logs"' EXIT
docker exec -i "$task_db" psql -U postgres -v ON_ERROR_STOP=1 <<'SQL'
update economy_rules set medical_auto_started_at=current_date-2;
insert into auth.users(id) select ('c3130000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid from generate_series(1,3) n;
insert into profiles(id,nickname) select ('c3130000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'auto.race.'||n from generate_series(1,3) n;
insert into training_accounts(user_id,time_zone,started_on)
 select ('c3130000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'UTC',current_date-1 from generate_series(1,3) n;
insert into training_plans(user_id,revision,effective_on,training_days,created_at,starts_immediately)
 select ('c3130000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,1,current_date-1,array[1,2,3,4,5,6,7],current_date-1,true from generate_series(1,3) n;
select economy_post('c3130000-0000-4000-8000-000000000001','seed','workout','Synthetic fixture',350,current_date);
insert into streak_groups(id,owner_id,name,time_zone,status,started_on)
 values('c3140000-0000-4000-8000-000000000001','c3130000-0000-4000-8000-000000000002','Concurrent closure','UTC','active',current_date-1);
insert into group_members(group_id,user_id,status) values
 ('c3140000-0000-4000-8000-000000000001','c3130000-0000-4000-8000-000000000002','accepted'),
 ('c3140000-0000-4000-8000-000000000001','c3130000-0000-4000-8000-000000000003','accepted');
SQL
run_device() {
 local task_user="$1" task_sql="$2"
 docker exec "$task_db" psql -U postgres -v ON_ERROR_STOP=1 -c "begin;set statement_timeout='10s';set role authenticated;set request.jwt.claim.sub='$task_user'; $task_sql select pg_sleep(0.1);commit;"
}
# Same account, same purchase request, simultaneous closure: one use and charge.
for task_device in 1 2;do
 run_device 'c3130000-0000-4000-8000-000000000001' "select get_economy_state('UTC');select buy_medical_kit('c3150000-0000-4000-8000-000000000001','UTC');" >"$task_logs/device-$task_device" 2>&1 &
 if [[ "$task_device" == 1 ]];then first_task=$!;else second_task=$!;fi
done
wait "$first_task" || { cat "$task_logs/device-1";exit 1; }
wait "$second_task" || { cat "$task_logs/device-2";exit 1; }
# Each group member holds their own account concurrently. Neither may wait
# for the other account while holding the group's lock (would deadlock).
for task_device in 2 3;do
 docker exec "$task_db" psql -U postgres -v ON_ERROR_STOP=1 -c "begin;set statement_timeout='10s';select 1 from training_accounts where user_id='c3130000-0000-4000-8000-00000000000$task_device' for update;select pg_sleep(0.5);select social_refresh_day('c3140000-0000-4000-8000-000000000001');commit;" >"$task_logs/group-$task_device" 2>&1 &
 if [[ "$task_device" == 2 ]];then first_task=$!;else second_task=$!;fi
done
wait "$first_task" || { cat "$task_logs/group-2";exit 1; }
wait "$second_task" || { cat "$task_logs/group-3";exit 1; }
docker exec -i "$task_db" psql -U postgres -v ON_ERROR_STOP=1 <<'SQL'
select social_refresh_day('c3140000-0000-4000-8000-000000000001');
do $$ declare u uuid:='c3130000-0000-4000-8000-000000000001';begin
 if (select count(*) from medical_kits where user_id=u and automatic)<>1
 or (select count(*) from medical_kits where user_id=u and purchase_id is not null)<>1
 or (select count(*) from coin_movements where user_id=u and kind='kit-purchase')<>1
 or (select balance from coin_wallets where user_id=u)<>0 then raise exception 'Concurrent closure/purchase duplicated stock, debit or notice';end if;
 if not exists(select 1 from group_days where group_id='c3140000-0000-4000-8000-000000000001' and day=current_date-1 and not counts_for_streak) then raise exception 'Concurrent group members froze an incorrect result';end if;
end $$;
select 'PASS: two devices/one use/one charge, group account lock contention without deadlocks, eventual immutable snapshot' as result;
SQL
