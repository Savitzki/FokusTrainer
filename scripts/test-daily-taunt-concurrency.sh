#!/usr/bin/env bash
set -euo pipefail
task_container=${1:?Disposable PostgreSQL container required}
docker exec -i "$task_container" psql -U postgres -v ON_ERROR_STOP=1 <<'SQL'
insert into auth.users(id) select ('d3910000-0000-4000-8000-'||lpad(x::text,12,'0'))::uuid from generate_series(1,3)x;
insert into profiles(id,nickname) select id,'daily.race.'||right(id::text,1) from auth.users where id::text like 'd3910000%';
insert into training_accounts(user_id,time_zone,started_on) select id,'Pacific/Kiritimati',current_date from profiles where id::text like 'd3910000%';
insert into friendships(requester,recipient,status) values
 ('d3910000-0000-4000-8000-000000000001','d3910000-0000-4000-8000-000000000002','accepted'),
 ('d3910000-0000-4000-8000-000000000001','d3910000-0000-4000-8000-000000000003','accepted');
SQL
pids=()
for device in 1 2 3 4;do
 docker exec "$task_container" psql -U postgres -v ON_ERROR_STOP=1 -c "begin;set role authenticated;set request.jwt.claim.sub='d3910000-0000-4000-8000-000000000001';select send_arena_taunt('d3910000-0000-4000-8000-000000000002','reply-back',('d3911000-0000-4000-8000-00000000000'||$device)::uuid);select pg_sleep(.1);commit;" >/dev/null 2>&1 &
 pids+=("$!")
done
wins=0;for pid in "${pids[@]}";do if wait "$pid";then wins=$((wins+1));fi;done
[[ "$wins" == 1 ]]
pids=()
for device in 1 2;do
 docker exec "$task_container" psql -U postgres -v ON_ERROR_STOP=1 -c "begin;set role authenticated;set request.jwt.claim.sub='d3910000-0000-4000-8000-000000000001';select send_arena_taunt('d3910000-0000-4000-8000-000000000003',null,'d3911000-0000-4000-8000-000000000005');commit;" >/dev/null 2>&1 &
 pids+=("$!")
done
for pid in "${pids[@]}";do wait "$pid";done
# A reply may race with an independently eligible reverse original; both must succeed.
docker exec "$task_container" psql -U postgres -v ON_ERROR_STOP=1 -c "begin;set role authenticated;set request.jwt.claim.sub='d3910000-0000-4000-8000-000000000003';select reply_arena_taunt('d3911000-0000-4000-8000-000000000005','d3912000-0000-4000-8000-000000000001');commit;" >/dev/null &
reply_pid=$!
docker exec "$task_container" psql -U postgres -v ON_ERROR_STOP=1 -c "begin;set role authenticated;set request.jwt.claim.sub='d3910000-0000-4000-8000-000000000003';select send_arena_taunt('d3910000-0000-4000-8000-000000000001',null,'d3911000-0000-4000-8000-000000000006');commit;" >/dev/null &
original_pid=$!
wait "$reply_pid";wait "$original_pid"
docker exec -i "$task_container" psql -U postgres -v ON_ERROR_STOP=1 <<'SQL'
do $$begin
 if (select count(*) from arena_taunts where sender='d3910000-0000-4000-8000-000000000001')<>2 or
 (select sum(sent) from arena_taunt_limits where sender='d3910000-0000-4000-8000-000000000001')<>2 or
 (select count(*) from arena_taunts where sender='d3910000-0000-4000-8000-000000000003')<>2 or
 (select sum(sent) from arena_taunt_limits where sender='d3910000-0000-4000-8000-000000000003')<>1 or
 exists(select 1 from arena_taunts t join arena_taunt_catalog c on c.id=t.message_id where t.sender::text like 'd391%' and t.in_reply_to is null and not c.original_eligible)
 then raise exception 'Concurrent quota/idempotency/reply isolation failure';end if;
 if not exists(select 1 from arena_taunt_limits where sender='d3910000-0000-4000-8000-000000000001' and day=(clock_timestamp() at time zone 'Pacific/Kiritimati')::date) then raise exception 'Account timezone ignored';end if;
end $$;
select 'PASS concurrent daily originals: one winner among four, identical retries, independent friends, reply/original isolation and account timezone';
SQL
