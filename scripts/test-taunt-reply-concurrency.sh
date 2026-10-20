#!/usr/bin/env bash
set -euo pipefail
task_container=$1
docker exec -i "$task_container" psql -U postgres -v ON_ERROR_STOP=1 <<'SQL'
insert into auth.users(id) values('d3800000-0000-4000-8000-000000000001'),('d3800000-0000-4000-8000-000000000002');
insert into profiles(id,nickname) values('d3800000-0000-4000-8000-000000000001','reply.race.a'),('d3800000-0000-4000-8000-000000000002','reply.race.b');
insert into friendships(requester,recipient,status) values('d3800000-0000-4000-8000-000000000001','d3800000-0000-4000-8000-000000000002','accepted');
set request.jwt.claim.sub='d3800000-0000-4000-8000-000000000001';
select send_arena_taunt('d3800000-0000-4000-8000-000000000002','online','d3801000-0000-4000-8000-000000000001');
select send_arena_taunt('d3800000-0000-4000-8000-000000000002','online','d3801000-0000-4000-8000-000000000002');
SQL
# Distinct device request IDs: exactly one may claim the original.
pids=()
for device in 1 2;do
 docker exec "$task_container" psql -U postgres -v ON_ERROR_STOP=1 -c "begin;set role authenticated;set request.jwt.claim.sub='d3800000-0000-4000-8000-000000000002';select reply_arena_taunt('d3801000-0000-4000-8000-000000000001','d3802000-0000-4000-8000-00000000000$device');commit;" >/dev/null 2>&1 &
 pids+=("$!")
done
wins=0;for pid in "${pids[@]}";do if wait "$pid";then wins=$((wins+1));fi;done
[[ "$wins" == 1 ]]
# The SAME request retried after a timeout: both return success, only one row/charge of quota.
pids=()
for device in 1 2;do
 docker exec "$task_container" psql -U postgres -v ON_ERROR_STOP=1 -c "begin;set role authenticated;set request.jwt.claim.sub='d3800000-0000-4000-8000-000000000002';select reply_arena_taunt('d3801000-0000-4000-8000-000000000002','d3802000-0000-4000-8000-000000000003');commit;" >/dev/null 2>&1 &
 pids+=("$!")
done
for pid in "${pids[@]}";do wait "$pid";done
docker exec -i "$task_container" psql -U postgres -v ON_ERROR_STOP=1 <<'SQL'
do $$ begin
 if (select count(*) from arena_taunts where sender='d3800000-0000-4000-8000-000000000002')<>2
  or (select sent from arena_taunt_limits where sender='d3800000-0000-4000-8000-000000000002')<>2
  or exists(select 1 from arena_taunts where in_reply_to is not null group by in_reply_to having count(*)>1)
 then raise exception 'Concurrent replies duplicated or consumed an extra allowance';end if;
end $$;
select 'PASS concurrent reply devices: one reply per original, idempotent retry, one allowance per reply';
SQL
