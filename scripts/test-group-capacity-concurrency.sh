#!/usr/bin/env bash
set -euo pipefail
task_container=${1:?disposable PostgreSQL container required}
docker exec -i "$task_container" psql -U postgres -v ON_ERROR_STOP=1 <<'SQL'
insert into streak_groups(id,owner_id,name,time_zone,status,started_on,training_checked_through)
values('d3851000-0000-4000-8000-000000000002','d3850000-0000-4000-8000-000000000001','Last slot race','UTC','pending',current_date,current_date-1);
insert into group_members select 'd3851000-0000-4000-8000-000000000002',id,'accepted' from profiles where id::text like 'd3850000%' and right(id::text,2)::integer<=4;
SQL
pids=()
for target in 5 6; do
 docker exec "$task_container" psql -U postgres -v ON_ERROR_STOP=1 -c "begin;set role authenticated;set request.jwt.claim.sub='d3850000-0000-4000-8000-000000000001';select arena_group_command('d3851000-0000-4000-8000-000000000002','invite',('d3850000-0000-4000-8000-00000000000'||$target)::uuid,null,gen_random_uuid());commit;" >/dev/null 2>&1 &
 pids+=("$!")
done
successes=0
for pid in "${pids[@]}";do if wait "$pid";then successes=$((successes+1));fi;done
[[ "$successes" == 1 ]]
docker exec -i "$task_container" psql -U postgres -v ON_ERROR_STOP=1 <<'SQL'
do $$ begin
 if (select count(*) from group_members where group_id='d3851000-0000-4000-8000-000000000002')<>5 then raise exception 'Concurrent invitations exceeded capacity';end if;
end $$;
select 'PASS two concurrent authenticated invitations: exactly one fills the last slot';
SQL
