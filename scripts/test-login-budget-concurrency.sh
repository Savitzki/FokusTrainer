#!/usr/bin/env bash
set -euo pipefail
task_db="$1"
task_logs=$(mktemp -d)
trap 'rm -rf "$task_logs"' EXIT
# Leave time before the fixed-minute boundary so a rollover is not mistaken for a race.
task_second=$(docker exec "$task_db" psql -U postgres -Atc "select extract(second from clock_timestamp())::integer")
if (( task_second > 55 )); then sleep $((61-task_second)); fi
docker exec "$task_db" psql -U postgres -v ON_ERROR_STOP=1 -c "insert into nickname_request_limits values('global',date_trunc('minute',clock_timestamp()),1),('source:'||repeat('d',64),date_trunc('minute',clock_timestamp()),59) on conflict(scope) do update set window_started_at=excluded.window_started_at,attempts=excluded.attempts;" >/dev/null
task_pids=()
for task_i in 1 2 3 4; do
 docker exec "$task_db" psql -U postgres -v ON_ERROR_STOP=1 -Atc "begin;set role service_role;select claim_nickname_login_budget(repeat('d',64));commit;" >"$task_logs/$task_i" &
 task_pids+=("$!")
done
for task_pid in "${task_pids[@]}"; do wait "$task_pid"; done
task_winners=$(rg --no-filename '^t$' "$task_logs" | wc -l)
if [[ "$task_winners" != 1 ]]; then cat "$task_logs"/*;exit 1;fi
docker exec "$task_db" psql -U postgres -v ON_ERROR_STOP=1 -c "delete from nickname_request_limits where scope in ('global','source:'||repeat('d',64));" >/dev/null
echo 'PASS concurrent login budget: one eligible request out of four; no limit bypass'
