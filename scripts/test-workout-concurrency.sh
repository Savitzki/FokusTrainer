#!/usr/bin/env bash
set -euo pipefail
task_container="$1"
# Disposable synthetic account; there is no production connection or secret here.
docker exec -i "$task_container" psql -U postgres -v ON_ERROR_STOP=1 <<'SQL'
insert into auth.users(id) values('c0000000-0000-4000-8000-000000000010');
insert into profiles(id,nickname) values('c0000000-0000-4000-8000-000000000010','timer.concurrent');
set request.jwt.claim.sub='c0000000-0000-4000-8000-000000000010';
select get_training_state('UTC');
select save_training_plan(array[1,2,3,4,5],0,'UTC',false);
SQL
for task_device in 1 2; do
 docker exec "$task_container" psql -U postgres -v ON_ERROR_STOP=1 -c "begin;set role authenticated;set request.jwt.claim.sub='c0000000-0000-4000-8000-000000000010';select start_workout_session('c0000000-0000-4000-8000-00000000001$task_device','Corrida','UTC');select pg_sleep(0.1);commit;" >/dev/null &
 if [[ "$task_device" == 1 ]];then first_device=$!;else second_device=$!;fi
done
wait "$first_device";wait "$second_device"
task_session=$(docker exec "$task_container" psql -U postgres -At -v ON_ERROR_STOP=1 -c "select id from workout_sessions where user_id='c0000000-0000-4000-8000-000000000010' and status='active'")
docker exec -i "$task_container" psql -U postgres -v ON_ERROR_STOP=1 <<'SQL'
do $$ begin
 if (select count(*) from workout_sessions where user_id='c0000000-0000-4000-8000-000000000010')<>1 then raise exception 'Concurrent starts created duplicate sessions';end if;
 if exists(select 1 from workout_days where user_id='c0000000-0000-4000-8000-000000000010') then raise exception 'Start confirmed workout';end if;
end $$;
update workout_sessions set started_at=clock_timestamp()-interval '36 minutes' where user_id='c0000000-0000-4000-8000-000000000010';
SQL
for task_device in 1 2; do
 docker exec "$task_container" psql -U postgres -v ON_ERROR_STOP=1 -c "begin;set role authenticated;set request.jwt.claim.sub='c0000000-0000-4000-8000-000000000010';select finish_workout_session('$task_session','UTC');select pg_sleep(0.1);commit;" >/dev/null &
 if [[ "$task_device" == 1 ]];then first_device=$!;else second_device=$!;fi
done
wait "$first_device";wait "$second_device"
docker exec -i "$task_container" psql -U postgres -v ON_ERROR_STOP=1 <<'SQL'
do $$ begin
 if (select count(*) from workout_days where user_id='c0000000-0000-4000-8000-000000000010')<>1
  or (select count(*) from workout_sessions where user_id='c0000000-0000-4000-8000-000000000010' and status='completed')<>1
  or (select count(*) from coin_movements where user_id='c0000000-0000-4000-8000-000000000010' and kind='workout')<>1
  or (select balance from coin_wallets where user_id='c0000000-0000-4000-8000-000000000010')<>10
 then raise exception 'Concurrent finish duplicated workout or coins';end if;
end $$;
select 'PASS two devices: one active session, one definitive confirmation and one reward';
insert into auth.users(id) values('c0000000-0000-4000-8000-000000000020');
insert into profiles(id,nickname) values('c0000000-0000-4000-8000-000000000020','manual.concurrent');
set request.jwt.claim.sub='c0000000-0000-4000-8000-000000000020';
select save_training_plan(array[1,2,3,4,5],0,'UTC',false);
SQL
# Same manual request retried concurrently (e.g. timeout on the first device).
for task_device in 1 2; do
 docker exec "$task_container" psql -U postgres -v ON_ERROR_STOP=1 -c "begin;set role authenticated;set request.jwt.claim.sub='c0000000-0000-4000-8000-000000000020';select confirm_manual_workout('c0000000-0000-4000-8000-000000000021',current_date,'Yoga',35,'{\"version\":1,\"questionIds\":[\"real\",\"honest\"],\"answers\":[true,true,true]}','UTC');select pg_sleep(0.1);commit;" >/dev/null &
 if [[ "$task_device" == 1 ]];then first_device=$!;else second_device=$!;fi
done
wait "$first_device";wait "$second_device"
docker exec -i "$task_container" psql -U postgres -v ON_ERROR_STOP=1 <<'SQL'
do $$ begin
 if (select count(*) from workout_days where user_id='c0000000-0000-4000-8000-000000000020')<>1
 or (select count(*) from coin_movements where user_id='c0000000-0000-4000-8000-000000000020' and kind='workout')<>1 then raise exception 'Concurrent manual request duplicated workout/coins';end if;
end $$;
select 'PASS concurrent manual retries: one workout and one reward';
SQL
