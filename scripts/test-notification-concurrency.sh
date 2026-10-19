#!/usr/bin/env bash
set -euo pipefail
task_container=${1:?Disposable PostgreSQL container required}
docker exec -i "$task_container" psql -U postgres -v ON_ERROR_STOP=1 <<'SQL'
insert into auth.users(id) values('d7000000-0000-4000-8000-000000000003'),('d7000000-0000-4000-8000-000000000004');
insert into profiles(id,nickname) values('d7000000-0000-4000-8000-000000000003','voice.local.concurrent'),('d7000000-0000-4000-8000-000000000004','voice.push.concurrent');
insert into training_accounts(user_id,time_zone,started_on,revision)
select p.id,tz.name,(now() at time zone tz.name)::date,1 from profiles p cross join lateral
 (select name from pg_timezone_names where extract(hour from now() at time zone name)=17 order by length(name),name limit 1) tz
where p.nickname in('voice.local.concurrent','voice.push.concurrent');
insert into training_plans(user_id,revision,effective_on,training_days,starts_immediately)
select user_id,1,started_on,array(select x from generate_series(1,7)x where x<>extract(isodow from started_on+1)::integer and x<>extract(isodow from started_on+2)::integer),true
from training_accounts where user_id in('d7000000-0000-4000-8000-000000000003','d7000000-0000-4000-8000-000000000004');
insert into push_devices(user_id,endpoint,p256dh,auth,vapid_key,time_zone,reminder_hour,tone)
select 'd7000000-0000-4000-8000-000000000004','https://fcm.googleapis.com/voice-concurrent-'||x,repeat('A',87),repeat('A',22),repeat('A',87),time_zone,17,'dramatic'
from training_accounts cross join generate_series(1,2)x where user_id='d7000000-0000-4000-8000-000000000004';
select count(*) from claim_push_jobs();
SQL
for device in 1 2;do
 docker exec "$task_container" psql -U postgres -v ON_ERROR_STOP=1 -c "begin;set request.jwt.claim.sub='d7000000-0000-4000-8000-000000000003';select claim_local_reminder('workout',to_char(now() at time zone (select time_zone from training_accounts where user_id=auth.uid()),'HH24:MI'),'Pacific/Kiritimati');select pg_sleep(0.1);commit;" >/dev/null &
 if [[ "$device" == 1 ]];then first_device=$!;else second_device=$!;fi
done
wait "$first_device";wait "$second_device"
for device in 1 2;do
 docker exec "$task_container" psql -U postgres -v ON_ERROR_STOP=1 -c "begin;select reserve_push_message(j.id,j.lease,'afternoon-bora','exaggerated','afternoon-wait') from push_jobs j join push_devices d on d.id=j.device_id where d.endpoint='https://fcm.googleapis.com/voice-concurrent-$device';select pg_sleep(0.1);commit;" >/dev/null &
 if [[ "$device" == 1 ]];then first_device=$!;else second_device=$!;fi
done
wait "$first_device";wait "$second_device"
docker exec -i "$task_container" psql -U postgres -v ON_ERROR_STOP=1 <<'SQL'
do $$ begin
 if(select count(*) from local_reminder_receipts where user_id='d7000000-0000-4000-8000-000000000003')<>1 then raise exception 'Concurrent local duplicate';end if;
 if(select count(*) from push_jobs j join push_devices d on d.id=j.device_id where d.user_id='d7000000-0000-4000-8000-000000000004' and j.humor='exaggerated')<>1 then raise exception 'Concurrent excessive exaggeration';end if;
end $$;
select 'PASS notification concurrency: one local claim, persistent copy, one exaggerated message across two devices';
SQL
