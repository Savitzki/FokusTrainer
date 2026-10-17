#!/usr/bin/env bash
# Called only by test-profiles-db.sh with its disposable container.
set -euo pipefail
db_container="$1"
task_logs=$(mktemp -d)
trap 'rm -rf "$task_logs"' EXIT
docker exec --interactive "$db_container" psql -U postgres -v ON_ERROR_STOP=1 <<'SQL'
insert into auth.users(id) select ('cccccccc-cccc-4ccc-8ccc-'||lpad(i::text,12,'0'))::uuid from generate_series(11,14) i;
insert into public.profiles(id,nickname) select ('cccccccc-cccc-4ccc-8ccc-'||lpad(i::text,12,'0'))::uuid,'coins.race.'||i from generate_series(11,14) i;
insert into public.training_accounts(user_id,time_zone,started_on) select ('cccccccc-cccc-4ccc-8ccc-'||lpad(i::text,12,'0'))::uuid,'UTC',current_date from generate_series(11,14) i;
select public.economy_post(('cccccccc-cccc-4ccc-8ccc-'||lpad(i::text,12,'0'))::uuid,'seed','workout','Fixture',50,current_date) from generate_series(12,14) i;
SQL
run_as() {
  local task_user="$1" task_sql="$2"
  docker exec "$db_container" psql -U postgres -v ON_ERROR_STOP=1 -c "begin; set role authenticated; set request.jwt.claim.sub='$task_user'; $task_sql commit;"
}
# Two confirmations with different descriptions still produce one workout/reward.
run_as 'cccccccc-cccc-4ccc-8ccc-000000000011' "select public.confirm_daily_workout(current_date,'Concurrent A',30,'UTC'); select pg_sleep(0.3);" >"$task_logs/a" 2>&1 &
first_task=$!
run_as 'cccccccc-cccc-4ccc-8ccc-000000000011' "select public.confirm_daily_workout(current_date,'Concurrent B',30,'Pacific/Kiritimati');" >"$task_logs/b" 2>&1 &
second_task=$!
wait "$first_task" || { cat "$task_logs/a"; exit 1; }
wait "$second_task" || { cat "$task_logs/b"; exit 1; }
# Different purchases compete for the same 50 coins: exactly one must fail.
run_as 'cccccccc-cccc-4ccc-8ccc-000000000012' "select public.buy_medical_kit('dddddddd-dddd-4ddd-8ddd-000000000011','UTC'); select pg_sleep(0.3);" >"$task_logs/a" 2>&1 &
first_task=$!
run_as 'cccccccc-cccc-4ccc-8ccc-000000000012' "select public.buy_medical_kit('dddddddd-dddd-4ddd-8ddd-000000000012','UTC');" >"$task_logs/b" 2>&1 &
second_task=$!
first_ok=0; second_ok=0
if wait "$first_task"; then first_ok=1; fi
if wait "$second_task"; then second_ok=1; fi
if ((first_ok + second_ok != 1)); then cat "$task_logs/a" "$task_logs/b"; exit 1; fi
if ((first_ok == 0)); then rg -q 'Moedas insuficientes' "$task_logs/a"; else rg -q 'Moedas insuficientes' "$task_logs/b"; fi
# Same request ID across devices is a single successful purchase.
for suffix in a b; do
  run_as 'cccccccc-cccc-4ccc-8ccc-000000000013' "select public.buy_medical_kit('dddddddd-dddd-4ddd-8ddd-000000000013','UTC'); select pg_sleep(0.1);" >"$task_logs/$suffix" 2>&1 &
  if [[ "$suffix" == a ]]; then first_task=$!; else second_task=$!; fi
done
wait "$first_task" || { cat "$task_logs/a"; exit 1; }
wait "$second_task" || { cat "$task_logs/b"; exit 1; }
run_as 'cccccccc-cccc-4ccc-8ccc-000000000014' "select public.buy_medical_kit('dddddddd-dddd-4ddd-8ddd-000000000014','UTC');" >/dev/null
for suffix in a b; do
  run_as 'cccccccc-cccc-4ccc-8ccc-000000000014' "select public.use_medical_kit(current_date,'UTC'); select pg_sleep(0.1);" >"$task_logs/$suffix" 2>&1 &
  if [[ "$suffix" == a ]]; then first_task=$!; else second_task=$!; fi
done
wait "$first_task" || { cat "$task_logs/a"; exit 1; }
wait "$second_task" || { cat "$task_logs/b"; exit 1; }
docker exec --interactive "$db_container" psql -U postgres -v ON_ERROR_STOP=1 <<'SQL'
do $$ declare n int; u uuid; begin
 if (select balance from coin_wallets where user_id='cccccccc-cccc-4ccc-8ccc-000000000011')<>10
 or (select count(*) from coin_movements where user_id='cccccccc-cccc-4ccc-8ccc-000000000011')<>1 then raise exception 'Concurrent reward duplicated'; end if;
 for n in 12..14 loop
  u:=('cccccccc-cccc-4ccc-8ccc-'||lpad(n::text,12,'0'))::uuid;
  if (select balance from coin_wallets where user_id=u)<>0 or (select count(*) from medical_kits where user_id=u)<>1
  or (select count(*) from coin_movements where user_id=u and kind='kit-purchase')<>1 then raise exception 'Concurrent purchase created excess inventory or spending'; end if;
 end loop;
 if (select count(*) from medical_kits where user_id='cccccccc-cccc-4ccc-8ccc-000000000014' and used_on=current_date)<>1
 or (select revision from training_accounts where user_id='cccccccc-cccc-4ccc-8ccc-000000000014')<>1 then raise exception 'Concurrent kit use consumed twice'; end if;
end $$;
select 'PASS: concurrent rewards, insufficient balance, idempotent purchases and single-use inventory' as result;
SQL
