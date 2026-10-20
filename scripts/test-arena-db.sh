#!/usr/bin/env bash
set -euo pipefail
task_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
task_container=$(docker run --detach --rm --network none --env POSTGRES_HOST_AUTH_METHOD=trust postgres:17-alpine)
trap 'docker rm --force "$task_container" >/dev/null 2>&1 || true' EXIT
for attempt in $(seq 1 120);do if docker exec "$task_container" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1;then break;fi;sleep .25;done
docker exec -i "$task_container" psql -U postgres -v ON_ERROR_STOP=1 < "$task_root/supabase/tests/bootstrap.sql"
docker exec "$task_container" psql -U postgres -c 'alter table auth.users add column email text;'
for file in "$task_root"/supabase/migrations/*.sql;do
 if [[ ( "$file" == *202610200038* || "$file" == *202610200034* || "$file" == *202610200035* || "$file" == *202610200036* || "$file" == *202610200037* ) && "${1:-}" == phase1 ]];then continue;fi
 if [[ "$file" == *202610200033* ]];then docker exec -i "$task_container" psql -U postgres -v ON_ERROR_STOP=1 < "$task_root/supabase/tests/arena-groups-legacy-setup.sql";fi
 if [[ "$file" == *202610200034* ]];then docker exec -i "$task_container" psql -U postgres -v ON_ERROR_STOP=1 < "$task_root/supabase/tests/arena-legacy-setup.sql";fi
 if [[ "$file" == *202610200037* ]];then docker exec -i "$task_container" psql -U postgres -v ON_ERROR_STOP=1 < "$task_root/supabase/tests/arena-taunt-replies-legacy-setup.sql";fi
 if [[ "$file" == *202610200038* ]];then docker exec -i "$task_container" psql -U postgres -v ON_ERROR_STOP=1 < "$task_root/supabase/tests/group-capacity-legacy-setup.sql";fi
 docker exec -i "$task_container" psql -U postgres -v ON_ERROR_STOP=1 < "$file"
 if [[ "$file" == *202610200038* ]];then docker exec -i "$task_container" psql -U postgres -v ON_ERROR_STOP=1 < "$task_root/supabase/tests/group-capacity.sql";fi
 if [[ "$file" == *202610200033* ]];then docker exec -i "$task_container" psql -U postgres -v ON_ERROR_STOP=1 < "$task_root/supabase/tests/arena-groups.sql";fi
 if [[ "$file" == *202610200034* ]];then docker exec -i "$task_container" psql -U postgres -v ON_ERROR_STOP=1 < "$task_root/supabase/tests/arena-interactions.sql";fi
done

if [[ "${1:-}" != phase1 ]];then docker exec -i "$task_container" psql -U postgres -v ON_ERROR_STOP=1 < "$task_root/supabase/tests/query-indexes.sql";fi
if [[ "${1:-}" != phase1 ]];then bash "$task_root/scripts/test-arena-concurrency.sh" "$task_container";fi

if [[ "${1:-}" != phase1 ]];then docker exec -i "$task_container" psql -U postgres -v ON_ERROR_STOP=1 < "$task_root/supabase/tests/friend-profile.sql";fi

if [[ "${1:-}" != phase1 ]];then
 docker exec -i "$task_container" psql -U postgres -v ON_ERROR_STOP=1 < "$task_root/supabase/tests/arena-taunt-replies.sql"
 bash "$task_root/scripts/test-taunt-reply-concurrency.sh" "$task_container"
fi

if [[ "${1:-}" != phase1 ]];then
 bash "$task_root/scripts/test-group-capacity-concurrency.sh" "$task_container"
fi
