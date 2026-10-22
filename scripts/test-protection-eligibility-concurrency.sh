#!/usr/bin/env bash
set -euo pipefail
task_container=$1
docker exec -i "$task_container" psql -U postgres -v ON_ERROR_STOP=1 <<'SQL'
insert into auth.users(id) values('c4201000-0000-4000-8000-000000000001');
insert into profiles(id,nickname) values('c4201000-0000-4000-8000-000000000001','protection.concurrent');
insert into training_accounts(user_id,time_zone,started_on,medical_checked_through) values('c4201000-0000-4000-8000-000000000001','UTC',current_date-1,current_date-1);
insert into training_plans(user_id,revision,effective_on,training_days,created_at,starts_immediately)
 values('c4201000-0000-4000-8000-000000000001',1,current_date-1,array[1,2,3,4,5,6,7],current_date-interval '2 days',true);
insert into workout_days(user_id,day,activity,minutes,confirmed_at)
 values('c4201000-0000-4000-8000-000000000001',current_date-1,'Corrida',35,current_date-interval '12 hours');
SQL
for device in 1 2;do
 docker exec "$task_container" psql -U postgres -v ON_ERROR_STOP=1 -c "begin;set role authenticated;set request.jwt.claim.sub='c4201000-0000-4000-8000-000000000001';select use_medical_kit(current_date,'UTC');select pg_sleep(0.1);commit;" >/dev/null &
 if [[ "$device" == 1 ]];then first_device=$!;else second_device=$!;fi
done
wait "$first_device";wait "$second_device"
docker exec -i "$task_container" psql -U postgres -v ON_ERROR_STOP=1 <<'SQL'
do $$ begin
 if (select count(*) from medical_kits where user_id='c4201000-0000-4000-8000-000000000001' and used_on=current_date)<>1
 or exists(select 1 from coin_movements where user_id='c4201000-0000-4000-8000-000000000001')
 then raise exception 'Two devices duplicated consumption or paid a reward';end if;
end $$;
-- Race the background closer against an authenticated device refresh.
insert into auth.users(id) values('c4201000-0000-4000-8000-000000000002');
insert into profiles(id,nickname) values('c4201000-0000-4000-8000-000000000002','protection.rollover');
insert into training_accounts(user_id,time_zone,started_on,medical_checked_through) values('c4201000-0000-4000-8000-000000000002','UTC',current_date-2,current_date-2);
insert into training_plans(user_id,revision,effective_on,training_days,created_at,starts_immediately)
 values('c4201000-0000-4000-8000-000000000002',1,current_date-2,array[1,2,3,4,5,6,7],current_date-interval '3 days',true);
insert into workout_days(user_id,day,activity,minutes,confirmed_at)
 values('c4201000-0000-4000-8000-000000000002',current_date-2,'Corrida',35,current_date-interval '36 hours');
-- Change the activation only in this isolated fixture database.
update economy_rules set medical_protection_started_at=current_date-3,medical_auto_started_at=current_date-3;
SQL
docker exec "$task_container" psql -U postgres -v ON_ERROR_STOP=1 -c "begin;select medical_auto_close_account('c4201000-0000-4000-8000-000000000002');select pg_sleep(0.1);commit;" >/dev/null &
first_device=$!
docker exec "$task_container" psql -U postgres -v ON_ERROR_STOP=1 -c "begin;set role authenticated;set request.jwt.claim.sub='c4201000-0000-4000-8000-000000000002';select get_training_state('UTC');commit;" >/dev/null &
second_device=$!
wait "$first_device";wait "$second_device"
docker exec -i "$task_container" psql -U postgres -v ON_ERROR_STOP=1 <<'SQL'
do $$ begin
 if (select count(*) from medical_kits where user_id='c4201000-0000-4000-8000-000000000002' and used_on=current_date-1)<>1
 or exists(select 1 from coin_movements where user_id='c4201000-0000-4000-8000-000000000002') then raise exception 'Rollover race duplicated consumption or rewards';end if;
end $$;
select 'PASS active-streak eligibility, two devices and rollover consume once, no reward';
SQL
