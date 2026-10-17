#!/usr/bin/env bash
set -euo pipefail
task_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
node "$task_root/scripts/build-database-update.mjs" --check
# No host port, no network and no production credentials: this database is disposable.
db_container=$(docker run --detach --rm --network none --env POSTGRES_HOST_AUTH_METHOD=trust postgres:17-alpine)
trap 'docker rm --force "$db_container" >/dev/null 2>&1 || true' EXIT
for attempt in $(seq 1 120); do
  if docker exec "$db_container" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; then break; fi
  sleep 0.25
done
if ! docker exec "$db_container" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; then
  docker logs "$db_container"
  exit 1
fi
expect_update_rejected() {
  local expected_message="$1" rejection
  if rejection=$(docker exec --interactive "$db_container" psql -U postgres -v ON_ERROR_STOP=1 < "$task_root/supabase/ATUALIZAR-BANCO.sql" 2>&1); then
    printf '%s\n' 'FAIL: atualização foi executada sem os pré-requisitos esperados.' >&2
    exit 1
  fi
  if [[ "$rejection" != *"$expected_message"* ]]; then
    printf '%s\n' "$rejection" >&2
    exit 1
  fi
}
for script in supabase/tests/bootstrap.sql supabase/migrations/202610160001_profiles.sql supabase/tests/profiles.sql supabase/ATUALIZAR-BANCO.sql supabase/tests/social-push.sql supabase/migrations/202610170004_weights_and_times.sql supabase/migrations/202610170004_weights_and_times.sql supabase/tests/weights-times.sql supabase/migrations/202610170005_group_workout_notifications.sql supabase/migrations/202610170005_group_workout_notifications.sql supabase/tests/group-notifications.sql; do
  if [[ "$script" == 'supabase/migrations/202610160001_profiles.sql' ]]; then
    expect_update_rejected 'Primeiro execute o SQL de perfis'
  fi
  docker exec --interactive "$db_container" psql -U postgres -v ON_ERROR_STOP=1 < "$task_root/$script"
done
for script in supabase/migrations/202610170006_database_maintenance.sql supabase/tests/database-maintenance-setup.sql supabase/migrations/202610170006_database_maintenance.sql supabase/migrations/202610170006_database_maintenance.sql supabase/tests/database-maintenance.sql; do
  docker exec --interactive "$db_container" psql -U postgres -v ON_ERROR_STOP=1 < "$task_root/$script"
done
expect_update_rejected 'Uma atualização de amigos ou push já existe'
for script in supabase/tests/removed-preference-setup.sql supabase/migrations/202610170007_remove_state_preference.sql supabase/migrations/202610170007_remove_state_preference.sql supabase/tests/removed-preference.sql; do
  docker exec --interactive "$db_container" psql -U postgres -v ON_ERROR_STOP=1 < "$task_root/$script"
done
docker exec "$db_container" psql -U postgres -v ON_ERROR_STOP=1 -c "begin; set role authenticated; set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111'; select public.confirm_daily_workout(current_date,'Concurrent A',30,'UTC'); select pg_sleep(0.5); commit;" >/dev/null &
first_confirmation=$!
docker exec "$db_container" psql -U postgres -v ON_ERROR_STOP=1 -c "begin; set role authenticated; set request.jwt.claim.sub='22222222-2222-4222-8222-222222222222'; select public.confirm_daily_workout(current_date,'Concurrent B',30,'UTC'); commit;" >/dev/null &
second_confirmation=$!
wait "$first_confirmation"
wait "$second_confirmation"
docker exec --interactive "$db_container" psql -U postgres -v ON_ERROR_STOP=1 <<'SQL'
do $$ begin
  if (select count(*) from public.group_days where group_id='44444444-4444-4444-8444-444444444444' and day=current_date)<>1 then raise exception 'Concurrent confirmations did not save exactly one day'; end if;
end $$;
select 'PASS: two concurrent workout confirmations save exactly one collective day' as result;
SQL
for script in supabase/migrations/202610170008_training_schedule.sql supabase/migrations/202610170008_training_schedule.sql supabase/tests/training-schedule.sql; do
  docker exec --interactive "$db_container" psql -U postgres -v ON_ERROR_STOP=1 < "$task_root/$script"
done
docker exec --interactive "$db_container" psql -U postgres -v ON_ERROR_STOP=1 <<'SQL'
insert into auth.users(id) values('eeeeeeee-eeee-4eee-8eee-000000000001');
insert into public.profiles(id,nickname) values('eeeeeeee-eeee-4eee-8eee-000000000001','rest.race');
SQL
docker exec "$db_container" psql -U postgres -v ON_ERROR_STOP=1 -c "begin; set role authenticated; set request.jwt.claim.sub='eeeeeeee-eeee-4eee-8eee-000000000001'; select public.authorize_extra_rest('UTC'); select pg_sleep(0.5); commit;" >/dev/null &
first_rest=$!
docker exec "$db_container" psql -U postgres -v ON_ERROR_STOP=1 -c "begin; set role authenticated; set request.jwt.claim.sub='eeeeeeee-eeee-4eee-8eee-000000000001'; select public.authorize_extra_rest('Pacific/Kiritimati'); commit;" >/dev/null &
second_rest=$!
wait "$first_rest"
wait "$second_rest"
docker exec --interactive "$db_container" psql -U postgres -v ON_ERROR_STOP=1 <<'SQL'
do $$ begin
 if (select count(*) from public.training_extra_rests where user_id='eeeeeeee-eeee-4eee-8eee-000000000001')<>1
 or (select revision from public.training_accounts where user_id='eeeeeeee-eeee-4eee-8eee-000000000001')<>1
 then raise exception 'Concurrent devices consumed more than one rest allowance'; end if;
end $$;
select 'PASS: concurrent rest requests from different device timezones consume exactly one allowance' as result;
SQL

for script in supabase/migrations/202610170009_scheduled_rest_limit.sql supabase/migrations/202610170009_scheduled_rest_limit.sql supabase/tests/scheduled-rest-limit.sql; do
  docker exec --interactive "$db_container" psql -U postgres -v ON_ERROR_STOP=1 < "$task_root/$script"
done

for script in supabase/tests/economy-legacy-setup.sql supabase/migrations/202610170010_coins_and_medical_kits.sql supabase/migrations/202610170010_coins_and_medical_kits.sql supabase/tests/coins-medical-kits.sql; do
  docker exec --interactive "$db_container" psql -U postgres -v ON_ERROR_STOP=1 < "$task_root/$script"
done

bash "$task_root/scripts/test-economy-concurrency.sh" "$db_container"

for script in supabase/migrations/202610170011_immutable_weight_entries.sql supabase/migrations/202610170011_immutable_weight_entries.sql supabase/tests/immutable-weight-entries.sql; do
  docker exec --interactive "$db_container" psql -U postgres -v ON_ERROR_STOP=1 < "$task_root/$script"
done
# Independent IDs can arrive simultaneously without replacing each other or doubling rewards.
docker exec --interactive "$db_container" psql -U postgres -v ON_ERROR_STOP=1 <<'SQL'
insert into auth.users(id) values('abababab-abab-4bab-8bab-000000000003');
SQL
for task_index in 1 2; do
 docker exec "$db_container" psql -U postgres -v ON_ERROR_STOP=1 -c "begin; set role authenticated; set request.jwt.claim.sub='abababab-abab-4bab-8bab-000000000003'; select public.sync_weight_entries(auth.uid(),jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'date',current_date,'kg',75,'recordedAt',clock_timestamp())),'UTC'); select pg_sleep(0.1); commit;" >/dev/null &
 if [[ "$task_index" == 1 ]]; then first_weight=$!; else second_weight=$!; fi
done
wait "$first_weight"
wait "$second_weight"
docker exec --interactive "$db_container" psql -U postgres -v ON_ERROR_STOP=1 <<'SQL'
do $$ begin
 if (select count(*) from weight_entries where user_id='abababab-abab-4bab-8bab-000000000003')<>2
 or (select balance from coin_wallets where user_id='abababab-abab-4bab-8bab-000000000003')<>2 then raise exception 'Concurrent weights lost a record or duplicated coins'; end if;
end $$;
select 'PASS: concurrent weigh-ins both saved with exactly one daily reward' as result;
SQL

for script in supabase/tests/reschedule-history-setup.sql supabase/migrations/202610170012_training_reschedules.sql supabase/migrations/202610170012_training_reschedules.sql supabase/tests/training-reschedules.sql supabase/tests/reschedule-arena-push.sql; do
  docker exec --interactive "$db_container" psql -U postgres -v ON_ERROR_STOP=1 < "$task_root/$script"
done
bash "$task_root/scripts/test-reschedule-concurrency.sh" "$db_container"
# Production auth.users already has email; this column exists only in the disposable stub.
docker exec "$db_container" psql -U postgres -v ON_ERROR_STOP=1 -c "alter table auth.users add column if not exists email text;"
for script in supabase/migrations/202610170013_account_email_lookup.sql supabase/migrations/202610170013_account_email_lookup.sql supabase/tests/account-email-lookup.sql; do
  docker exec --interactive "$db_container" psql -U postgres -v ON_ERROR_STOP=1 < "$task_root/$script"
done
