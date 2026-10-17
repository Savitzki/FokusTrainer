#!/usr/bin/env bash
set -euo pipefail
task_db="$1"
task_logs=$(mktemp -d)
trap 'rm -rf "$task_logs"' EXIT
docker exec --interactive "$task_db" psql -U postgres -v ON_ERROR_STOP=1 <<'SQL'
insert into auth.users(id,email) select ('16161616-1616-4616-8616-'||lpad(i::text,12,'0'))::uuid,'nick.race.'||i||'@example.invalid' from generate_series(1,2) i;
SQL
for task_i in 1 2; do
 docker exec "$task_db" psql -U postgres -v ON_ERROR_STOP=1 -c "begin; set role authenticated; set request.jwt.claim.sub='16161616-1616-4616-8616-00000000000$task_i'; insert into profiles(id,nickname) values(auth.uid(),'shared.nickname'); select pg_sleep(0.1); commit;" >"$task_logs/$task_i" 2>&1 &
 if [[ "$task_i" == 1 ]]; then task_first=$!; else task_second=$!; fi
done
task_success=0
if wait "$task_first"; then task_success=$((task_success+1)); fi
if wait "$task_second"; then task_success=$((task_success+1)); fi
if [[ "$task_success" != 1 ]]; then cat "$task_logs/1" "$task_logs/2"; exit 1; fi
docker exec --interactive "$task_db" psql -U postgres -v ON_ERROR_STOP=1 <<'SQL'
do $$ begin if (select count(*) from profiles where nickname='shared.nickname')<>1 then raise exception 'Duplicate nick won concurrently';end if;end $$;
insert into nickname_login_attempts values(md5('shared.nickname'),clock_timestamp(),9);
SQL
for task_i in 1 2; do
 docker exec "$task_db" psql -U postgres -v ON_ERROR_STOP=1 -Atc "begin; set role service_role; select begin_nickname_login('shared.nickname')->>'allowed'; select pg_sleep(0.1); commit;" >"$task_logs/rate-$task_i" 2>&1 &
 if [[ "$task_i" == 1 ]]; then task_first=$!; else task_second=$!; fi
done
wait "$task_first"
wait "$task_second"
[[ $(rg -l '^true$' "$task_logs/rate-1" "$task_logs/rate-2" | wc -l) == 1 ]]
[[ $(rg -l '^false$' "$task_logs/rate-1" "$task_logs/rate-2" | wc -l) == 1 ]]
printf '%s\n' 'PASS: concurrent nickname claims have one winner and rate limit is atomic across devices'
