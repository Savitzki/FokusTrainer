#!/usr/bin/env bash
# Disposable PostgreSQL: two independent processes, one permanent unlock per key.
set -euo pipefail
task_db="$1"
task_logs=$(mktemp -d)
trap 'rm -rf "$task_logs"' EXIT
docker exec -i "$task_db" psql -U postgres -v ON_ERROR_STOP=1 <<'SQL'
insert into auth.users(id) values('c3290000-0000-4000-8000-000000000001');
insert into profiles(id,nickname) values('c3290000-0000-4000-8000-000000000001','achievements.concurrent');
insert into training_accounts(user_id,time_zone,started_on) values('c3290000-0000-4000-8000-000000000001','UTC',current_date-40);
insert into training_plans(user_id,revision,effective_on,training_days,created_at) values('c3290000-0000-4000-8000-000000000001',1,current_date-40,array[1],current_date-40);
insert into coin_wallets(user_id) values('c3290000-0000-4000-8000-000000000001');
insert into weight_entries(user_id,id,day,kg,recorded_at,confirmed_at)
 select 'c3290000-0000-4000-8000-000000000001',gen_random_uuid(),current_date-x,75,(current_date-x)::timestamp,(current_date-x)::timestamp from generate_series(1,30) x;
SQL
for task_device in 1 2;do
 docker exec "$task_db" psql -U postgres -v ON_ERROR_STOP=1 -c "begin;set statement_timeout='15s';select gf_badges_state('c3290000-0000-4000-8000-000000000001');select pg_sleep(.1);commit;" >"$task_logs/device-$task_device" 2>&1 &
 if [[ "$task_device" == 1 ]];then first_task=$!;else second_task=$!;fi
done
wait "$first_task" || { cat "$task_logs/device-1";exit 1; }
wait "$second_task" || { cat "$task_logs/device-2";exit 1; }
docker exec -i "$task_db" psql -U postgres -v ON_ERROR_STOP=1 <<'SQL'
do $$ declare u uuid:='c3290000-0000-4000-8000-000000000001';before_value jsonb;after_value jsonb;begin
 if (select count(*) from gf_badges where user_id=u)<>3 then raise exception 'Concurrent evaluation duplicated/missed weight unlocks';end if;
 select jsonb_agg(to_jsonb(b) order by key) into before_value from gf_badges b where user_id=u;
 perform gf_badges_state(u);
 select jsonb_agg(to_jsonb(b) order by key) into after_value from gf_badges b where user_id=u;
 if before_value is distinct from after_value then raise exception 'Retry changed original unlock timestamps';end if;
 if (select balance from coin_wallets where user_id=u)<>0 or exists(select 1 from coin_movements where user_id=u) then raise exception 'Badges unexpectedly paid coins';end if;
end $$;
select 'PASS: concurrent devices recognize once, stable timestamps/metadata and zero achievement currency' as result;
SQL

# Group point capture must not take another participant's training-account lock.
# Such a lock reverses workout(account -> group) order and can deadlock at point 7.
docker exec -i "$task_db" psql -U postgres -v ON_ERROR_STOP=1 <<'SQL'
insert into auth.users(id) select ('c3290000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid from generate_series(2,3) n;
insert into profiles(id,nickname) select ('c3290000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'achievement.group.race.'||n from generate_series(2,3) n;
insert into training_accounts(user_id,time_zone,started_on) select ('c3290000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'UTC',current_date-10 from generate_series(2,3) n;
insert into streak_groups(id,owner_id,name,time_zone,status,started_on)
 values('c3280000-0000-4000-8000-000000000001','c3290000-0000-4000-8000-000000000002','Group account lock fixture','UTC','active',current_date-8);
insert into group_members(group_id,user_id,status) select 'c3280000-0000-4000-8000-000000000001',('c3290000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'accepted' from generate_series(2,3) n;
update gf_badge_memberships set accepted_at=current_date-8 where group_id='c3280000-0000-4000-8000-000000000001';
insert into group_days(group_id,day,members_count,counts_for_streak)
 select 'c3280000-0000-4000-8000-000000000001',current_date-8+n,2,true from generate_series(0,5) n;
SQL
docker exec "$task_db" psql -U postgres -v ON_ERROR_STOP=1 -c "begin;set statement_timeout='10s';select 1 from streak_groups where id='c3280000-0000-4000-8000-000000000001' for update;select pg_sleep(.5);insert into group_days(group_id,day,members_count,counts_for_streak) values('c3280000-0000-4000-8000-000000000001',current_date-2,2,true);commit;" >"$task_logs/group" 2>&1 &
first_task=$!
docker exec "$task_db" psql -U postgres -v ON_ERROR_STOP=1 -c "begin;set statement_timeout='10s';select 1 from training_accounts where user_id='c3290000-0000-4000-8000-000000000003' for update;select pg_sleep(.5);select 1 from streak_groups where id='c3280000-0000-4000-8000-000000000001' for update;commit;" >"$task_logs/account" 2>&1 &
second_task=$!
wait "$first_task" || { cat "$task_logs/group";exit 1; }
wait "$second_task" || { cat "$task_logs/account";exit 1; }
docker exec -i "$task_db" psql -U postgres -v ON_ERROR_STOP=1 <<'SQL'
do $$ begin
 if (select count(*) from gf_badge_group_qualifications where group_id='c3280000-0000-4000-8000-000000000001')<>2 then raise exception 'Seventh collective point did not persist both qualifications';end if;
 if exists(select 1 from gf_accounts where user_id in('c3290000-0000-4000-8000-000000000002','c3290000-0000-4000-8000-000000000003')) then raise exception 'Group capture unexpectedly inserted other participants account data';end if;
end $$;
select 'PASS: seventh collective point records permanent proof without locking another participant account or duplicating currency' as result;
SQL
