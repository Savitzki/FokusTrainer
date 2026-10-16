#!/usr/bin/env bash
set -euo pipefail
task_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
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
for script in supabase/tests/bootstrap.sql supabase/migrations/202610160001_profiles.sql supabase/tests/profiles.sql supabase/migrations/202610160002_social.sql supabase/migrations/202610160003_push.sql supabase/tests/social-push.sql; do
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
