#!/usr/bin/env bash
set -euo pipefail
task_container=${1:?Disposable PostgreSQL container required}
docker exec -i "$task_container" psql -U postgres -v ON_ERROR_STOP=1 <<'SQL'
insert into auth.users(id) select ('d3500000-0000-4000-8000-'||lpad(x::text,12,'0'))::uuid from generate_series(1,3)x;
insert into profiles(id,nickname) select id,'parallel.'||right(id::text,1) from auth.users where id::text like 'd3500000%';
insert into training_accounts(user_id,time_zone,started_on) select id,'UTC',current_date-10 from profiles where id::text like 'd3500000%';
insert into training_plans(user_id,revision,effective_on,training_days,created_at) select id,1,current_date-10,array[1,2,3,4,5],current_date-10 from profiles where id::text like 'd3500000%';
insert into friendships(requester,recipient,status) values('d3500000-0000-4000-8000-000000000001','d3500000-0000-4000-8000-000000000002','accepted');
SQL
# Same request, two devices: one challenge and one participant set.
for device in 1 2;do
 docker exec "$task_container" psql -U postgres -v ON_ERROR_STOP=1 -c "begin;set role authenticated;set request.jwt.claim.sub='d3500000-0000-4000-8000-000000000001';select create_arena_challenge('d3501000-0000-4000-8000-000000000001','Duelo paralelo','frequency',7,array['d3500000-0000-4000-8000-000000000002']::uuid[],null,'UTC','any',null);select pg_sleep(.1);commit;" >/dev/null &
 if [[ "$device" == 1 ]];then first_pid=$!;else second_pid=$!;fi
done
wait "$first_pid";wait "$second_pid"
docker exec "$task_container" psql -U postgres -v ON_ERROR_STOP=1 -c "do \$\$ begin if (select count(*) from gf_challenges where name='Duelo paralelo')<>1 then raise exception 'Concurrent invitation duplicated';end if;end \$\$;"
# Four concurrent sends: exactly three successes and one bounded rejection.
pids=()
for device in 1 2 3 4;do
 docker exec "$task_container" psql -U postgres -v ON_ERROR_STOP=1 -c "begin;set role authenticated;set request.jwt.claim.sub='d3500000-0000-4000-8000-000000000001';select send_arena_taunt('d3500000-0000-4000-8000-000000000002','doubt',('d3502000-0000-4000-8000-00000000000'||$device)::uuid);commit;" >/dev/null 2>&1 &
 pids+=("$!")
done
successes=0
for pid in "${pids[@]}";do if wait "$pid";then successes=$((successes+1));fi;done
[[ "$successes" == 3 ]]
docker exec "$task_container" psql -U postgres -v ON_ERROR_STOP=1 -c "do \$\$ begin if (select count(*) from arena_taunts where sender='d3500000-0000-4000-8000-000000000001')<>3 or (select sent from arena_taunt_limits where sender='d3500000-0000-4000-8000-000000000001')<>3 then raise exception 'Concurrent taunt limit bypassed';end if;end \$\$;"
# Removal races a second creator request: no incompatible active duel survives.
docker exec "$task_container" psql -U postgres -v ON_ERROR_STOP=1 -c "begin;set role authenticated;set request.jwt.claim.sub='d3500000-0000-4000-8000-000000000001';select remove_friend('d3500000-0000-4000-8000-000000000002');commit;" >/dev/null &
remove_pid=$!
docker exec "$task_container" psql -U postgres -v ON_ERROR_STOP=1 -c "begin;set role authenticated;set request.jwt.claim.sub='d3500000-0000-4000-8000-000000000002';select create_arena_challenge(gen_random_uuid(),'Corrida de vínculo','frequency',7,array['d3500000-0000-4000-8000-000000000001']::uuid[],null,'UTC','any',null);commit;" >/dev/null 2>&1 &
create_pid=$!
wait "$remove_pid"
wait "$create_pid" || true
docker exec -i "$task_container" psql -U postgres -v ON_ERROR_STOP=1 <<'SQL'
do $$ begin
 if exists(select 1 from gf_challenges c where settled_at is null and exists(select 1 from gf_challenge_members where challenge_id=c.id and user_id='d3500000-0000-4000-8000-000000000001') and exists(select 1 from gf_challenge_members where challenge_id=c.id and user_id='d3500000-0000-4000-8000-000000000002')) then raise exception 'Friend removal left incompatible challenge';end if;
 if exists(select 1 from coin_movements where kind='challenge' and user_id::text like 'd3500000%') then raise exception 'Concurrent operation paid coins';end if;
end $$;
select 'PASS concurrent Arena devices: unique invite, three of four taunts, remove/create atomic, no rewards';
SQL
# Competing admin transfers: exactly one new administrator; the stale actor loses permission.
docker exec -i "$task_container" psql -U postgres -v ON_ERROR_STOP=1 <<'SQL'
insert into streak_groups(id,owner_id,name,time_zone,status,started_on,training_checked_through) values('d3503000-0000-4000-8000-000000000001','d3500000-0000-4000-8000-000000000001','Admin paralelo','UTC','active',current_date,current_date-1);
insert into group_members select 'd3503000-0000-4000-8000-000000000001',id,'accepted' from profiles where id::text like 'd3500000%';
SQL
pids=()
for target in 2 3;do
 docker exec "$task_container" psql -U postgres -v ON_ERROR_STOP=1 -c "begin;set role authenticated;set request.jwt.claim.sub='d3500000-0000-4000-8000-000000000001';select arena_group_command('d3503000-0000-4000-8000-000000000001','transfer',('d3500000-0000-4000-8000-00000000000'||$target)::uuid,null,gen_random_uuid());commit;" >/dev/null 2>&1 &
 pids+=("$!")
done
successes=0
for pid in "${pids[@]}";do if wait "$pid";then successes=$((successes+1));fi;done
[[ "$successes" == 1 ]]
docker exec "$task_container" psql -U postgres -v ON_ERROR_STOP=1 -c "delete from arena_group_cycles where group_id='d3503000-0000-4000-8000-000000000001';" >/dev/null
for device in 1 2;do
 docker exec "$task_container" psql -U postgres -v ON_ERROR_STOP=1 -c "begin;set role authenticated;set request.jwt.claim.sub='d3500000-0000-4000-8000-000000000001';select get_social_state();commit;" >/dev/null &
 if [[ "$device" == 1 ]];then first_pid=$!;else second_pid=$!;fi
done
wait "$first_pid";wait "$second_pid"
docker exec -i "$task_container" psql -U postgres -v ON_ERROR_STOP=1 <<'SQL'
do $$ begin
 if (select owner_id from streak_groups where id='d3503000-0000-4000-8000-000000000001') not in('d3500000-0000-4000-8000-000000000002','d3500000-0000-4000-8000-000000000003') then raise exception 'Concurrent admin transfer failed';end if;
 if (select count(*) from arena_group_cycles where group_id='d3503000-0000-4000-8000-000000000001')<>1 then raise exception 'Weekly snapshot duplicated';end if;
end $$;
select 'PASS concurrent transfers and weekly readers: one administrator, one weekly snapshot';
SQL
# A valid before-midnight write that has not committed must not be frozen out.
docker exec -i "$task_container" psql -U postgres -v ON_ERROR_STOP=1 <<'SQL'
insert into arena_group_cycles(group_id,week_start,starts_on,timezone,opened_at,target,participants)
 values('d3503000-0000-4000-8000-000000000001',date_trunc('week',now())::date-7,date_trunc('week',now())::date-7,'UTC',date_trunc('week',now())-interval '7 days',1,'[{"id":"d3500000-0000-4000-8000-000000000001"}]');
SQL
docker exec -e PGAPPNAME=arena_late_workout "$task_container" psql -U postgres -v ON_ERROR_STOP=1 -c "begin;select 1 from training_accounts where user_id='d3500000-0000-4000-8000-000000000001' for update;insert into workout_days(user_id,day,activity,minutes,confirmed_at) values('d3500000-0000-4000-8000-000000000001',date_trunc('week',now())::date-1,'Fixture de commit pendente',35,date_trunc('week',now())-interval '1 second');select pg_sleep(2);commit;" >/dev/null &
late_pid=$!
for attempt in $(seq 1 30);do
 if [[ $(docker exec "$task_container" psql -U postgres -Atc "select exists(select 1 from pg_stat_activity where application_name='arena_late_workout' and wait_event='PgSleep')") == t ]];then break;fi
 sleep .05
done
docker exec -i "$task_container" psql -U postgres -v ON_ERROR_STOP=1 <<'SQL'
select arena_sync_group_cycle('d3503000-0000-4000-8000-000000000001');
do $$ begin if (select closed_at is not null from arena_group_cycles where group_id='d3503000-0000-4000-8000-000000000001' and week_start=date_trunc('week',now())::date-7) then raise exception 'Goal closed over an uncommitted confirmation';end if;end $$;
SQL
wait "$late_pid"
docker exec -i "$task_container" psql -U postgres -v ON_ERROR_STOP=1 <<'SQL'
select arena_sync_group_cycle('d3503000-0000-4000-8000-000000000001');
do $$ begin if not (select closed_at is not null and final_count=1 from arena_group_cycles where group_id='d3503000-0000-4000-8000-000000000001' and week_start=date_trunc('week',now())::date-7) then raise exception 'Committed on-time confirmation missing from final goal';end if;end $$;
select 'PASS weekly rollover waits for on-time confirmation commit without inverse-lock deadlock';
SQL
