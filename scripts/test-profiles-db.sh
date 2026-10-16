#!/usr/bin/env bash
set -euo pipefail
task_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
# No host port, no network and no production credentials: this database is disposable.
db_container=$(docker run --detach --rm --network none --env POSTGRES_HOST_AUTH_METHOD=trust postgres:17-alpine)
trap 'docker rm --force "$db_container" >/dev/null 2>&1 || true' EXIT
for attempt in $(seq 1 40); do
  if docker exec "$db_container" pg_isready -U postgres >/dev/null 2>&1; then break; fi
  sleep 0.25
done
for script in supabase/tests/bootstrap.sql supabase/migrations/202610160001_profiles.sql supabase/tests/profiles.sql; do
  docker exec --interactive "$db_container" psql -U postgres -v ON_ERROR_STOP=1 < "$task_root/$script"
done
