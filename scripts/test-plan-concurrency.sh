#!/usr/bin/env bash
set -euo pipefail
task_container="$1"
docker exec -i "$task_container" psql -U postgres -v ON_ERROR_STOP=1 <<'SQL'
insert into auth.users(id) values('e0000000-0000-4000-8000-000000000050');
insert into profiles(id,nickname) values('e0000000-0000-4000-8000-000000000050','plans.concurrent');
set request.jwt.claim.sub='e0000000-0000-4000-8000-000000000050';
select get_training_state('UTC');
SQL
for task_revision in 0 1; do
 for task_device in 1 2; do
  # Both clients send the same observed revision; exactly one can create a version.
  docker exec "$task_container" psql -U postgres -v ON_ERROR_STOP=1 -c "begin;set role authenticated;set request.jwt.claim.sub='e0000000-0000-4000-8000-000000000050';do \$\$begin begin perform save_training_plan(array[1,2,3,4,5],$task_revision,'UTC',($task_revision>0));exception when others then if sqlerrm not like '%outro aparelho%' then raise;end if;end;end \$\$;select pg_sleep(0.1);commit;" >/dev/null &
  if [[ "$task_device" == 1 ]];then first_device=$!;else second_device=$!;fi
 done
 wait "$first_device";wait "$second_device"
done
docker exec -i "$task_container" psql -U postgres -v ON_ERROR_STOP=1 <<'SQL'
do $$begin
 if (select count(*) from training_plans where user_id='e0000000-0000-4000-8000-000000000050')<>2
 or (select revision from training_accounts where user_id='e0000000-0000-4000-8000-000000000050')<>2
 or not exists(select 1 from training_plans where user_id='e0000000-0000-4000-8000-000000000050' and revision=1 and effective_on=current_date)
 or not exists(select 1 from training_plans where user_id='e0000000-0000-4000-8000-000000000050' and revision=2 and effective_on=current_date+1 and replaces_revision=1)
 then raise exception 'Concurrent devices created conflicting plans';end if;
end $$;
select 'PASS two devices: one initial plan, one atomic replacement, stale revisions rejected';
SQL
