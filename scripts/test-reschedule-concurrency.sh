#!/usr/bin/env bash
set -euo pipefail
db_container="$1"
task_logs=$(mktemp -d)
trap 'rm -rf "$task_logs"' EXIT
docker exec --interactive "$db_container" psql -U postgres -v ON_ERROR_STOP=1 <<'SQL'
insert into auth.users(id) select ('12121212-1212-4212-8212-'||lpad(i::text,12,'0'))::uuid from generate_series(11,13) i;
insert into public.training_accounts(user_id,time_zone,revision,started_on) select ('12121212-1212-4212-8212-'||lpad(i::text,12,'0'))::uuid,'UTC',1,current_date from generate_series(11,13) i;
insert into public.training_plans(user_id,revision,effective_on,training_days) select ('12121212-1212-4212-8212-'||lpad(i::text,12,'0'))::uuid,1,'2000-01-01',array[1,2,3,5,6] from generate_series(11,13) i;
SQL
run_swap() {
 local task_user="$1" task_from="$2" task_to="$3" task_revision="$4"
 docker exec "$db_container" psql -U postgres -v ON_ERROR_STOP=1 -c "begin; set role authenticated; set request.jwt.claim.sub='$task_user'; select public.reschedule_training(date_trunc('week',now())::date+7+$task_from,date_trunc('week',now())::date+7+$task_to,$task_revision,'UTC'); select pg_sleep(0.1); commit;"
}
# Same destination and revision from two devices: exactly one request wins.
run_swap '12121212-1212-4212-8212-000000000011' 1 3 1 >"$task_logs/a" 2>&1 &
first_task=$!
run_swap '12121212-1212-4212-8212-000000000011' 2 3 1 >"$task_logs/b" 2>&1 &
second_task=$!
first_ok=0; second_ok=0
if wait "$first_task"; then first_ok=1; fi
if wait "$second_task"; then second_ok=1; fi
if (( first_ok + second_ok != 1 )); then cat "$task_logs/a" "$task_logs/b"; exit 1; fi
if (( first_ok == 0 )); then rg -q 'Sua programação mudou' "$task_logs/a"; else rg -q 'Sua programação mudou' "$task_logs/b"; fi
# Lost-response retries from two devices consume one slot, even with old revision.
for task_suffix in a b; do
 run_swap '12121212-1212-4212-8212-000000000012' 1 3 1 >"$task_logs/$task_suffix" 2>&1 &
 if [[ "$task_suffix" == a ]]; then first_task=$!; else second_task=$!; fi
done
wait "$first_task" || { cat "$task_logs/a"; exit 1; }
wait "$second_task" || { cat "$task_logs/b"; exit 1; }
# Competing to consume the second slot cannot both win.
run_swap '12121212-1212-4212-8212-000000000012' 4 6 2 >"$task_logs/a" 2>&1 &
first_task=$!
run_swap '12121212-1212-4212-8212-000000000012' 5 6 2 >"$task_logs/b" 2>&1 &
second_task=$!
first_ok=0; second_ok=0
if wait "$first_task"; then first_ok=1; fi
if wait "$second_task"; then second_ok=1; fi
if (( first_ok + second_ok != 1 )); then cat "$task_logs/a" "$task_logs/b"; exit 1; fi
docker exec --interactive "$db_container" psql -U postgres -v ON_ERROR_STOP=1 <<'SQL'
do $$ declare u uuid; begin
 u:='12121212-1212-4212-8212-000000000011';
 if (select count(*) from training_reschedules where user_id=u)<>1 or (select revision from training_accounts where user_id=u)<>2 then raise exception 'Concurrent destination not serialized'; end if;
 u:='12121212-1212-4212-8212-000000000012';
 if (select count(*) from training_reschedules where user_id=u)<>2 or (select revision from training_accounts where user_id=u)<>3 then raise exception 'Concurrent quota not serialized'; end if;
 if exists(select 1 from coin_movements where user_id in('12121212-1212-4212-8212-000000000011','12121212-1212-4212-8212-000000000012')) then raise exception 'Concurrent swaps minted coins'; end if;
end $$;
select 'PASS: concurrent destination, quota, idempotent retries and revisions' as result;
SQL
