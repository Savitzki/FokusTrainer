-- Only synthetic accounts in the disposable database. Never run in production.
begin;
update economy_rules set medical_protection_started_at=current_date-30,medical_auto_started_at=current_date-30;
create function pg_temp.protection_fixture(n integer,tz text default 'UTC') returns uuid language plpgsql as $$
declare u uuid:=('c4200000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid; d date:=(clock_timestamp() at time zone tz)::date;
begin
 insert into auth.users(id) values(u);
 insert into profiles(id,nickname) values(u,'protect.fixture.'||n);
 insert into training_accounts(user_id,time_zone,started_on,medical_checked_through) values(u,tz,d-3,d-1);
 insert into training_plans(user_id,revision,effective_on,training_days,created_at,starts_immediately)
 values(u,1,d-3,array[1,2,3,4,5,6,7],(d-3)::timestamp at time zone tz,true);
 return u;
end $$;
-- No active points: both manual and automatic use must leave inventory/history alone.
do $$ declare u uuid:=pg_temp.protection_fixture(1); rejected boolean:=false; begin
 perform set_config('request.jwt.claim.sub',u::text,true);
 perform economy_grant_monthly_kits(u,current_date);
 begin perform use_medical_kit(current_date,'UTC');exception when raise_exception then rejected:=sqlerrm like '%ofensiva ativa%';end;
 if not rejected or exists(select 1 from medical_kits where user_id=u and used_on is not null) then raise exception 'Inactive manual use was accepted';end if;
 update training_accounts set medical_checked_through=current_date-4 where user_id=u;
 perform medical_auto_close_account(u);
 if exists(select 1 from medical_kits where user_id=u and used_on is not null) then raise exception 'Inactive automatic use consumed inventory';end if;
 if (get_economy_state('UTC')->'kitEligibility'->>'allowed')::boolean then raise exception 'UI contract offered inactive protection';end if;
 -- Purchases remain allowed without a streak.
 perform economy_post(u,'test-funds','workout','Synthetic fixture',700,current_date);
 perform buy_medical_kit('c4200000-1000-4000-8000-000000000001','UTC');
 if (select balance from coin_wallets where user_id=u)<>350 then raise exception 'Protection rule blocked or altered purchase';end if;
end $$;
-- Official confirmed mandatory points allow one use; repeat is idempotent.
do $$ declare u uuid:=pg_temp.protection_fixture(2); v bigint; begin
 perform set_config('request.jwt.claim.sub',u::text,true);
 insert into workout_days(user_id,day,activity,minutes,confirmed_at) values(u,current_date-1,'Corrida',35,current_date-interval '12 hours');
 if not medical_has_streak_before(u,current_date) or (gf_streak(u)->>'current')::int<>1 then raise exception 'Official streak mismatch';end if;
 perform use_medical_kit(current_date,'UTC');
 select revision into v from coin_wallets where user_id=u;
 perform use_medical_kit(current_date,'Pacific/Kiritimati');
 if (select count(*) from medical_kits where user_id=u and used_on=current_date)<>1 or
  (select revision from coin_wallets where user_id=u)<>v then raise exception 'Repeated manual use consumed twice';end if;
end $$;
-- A valid past point is carried by protection, never by an unprotected absence.
do $$ declare u uuid:=pg_temp.protection_fixture(3); rejected boolean:=false; begin
 perform set_config('request.jwt.claim.sub',u::text,true);
 insert into workout_days(user_id,day,activity,minutes,confirmed_at) values(u,current_date-2,'Corrida',35,current_date-interval '36 hours');
 update training_accounts set medical_checked_through=current_date-2 where user_id=u;
 perform medical_auto_close_account(u);
 if (select count(*) from medical_kits where user_id=u and automatic)<>1 then raise exception 'Active rollover was not protected';end if;
 if not medical_has_streak_before(u,current_date) then raise exception 'Valid protection lost the active sequence';end if;
 begin perform use_medical_kit(current_date,'UTC');exception when raise_exception then rejected:=sqlerrm like '%dias seguidos%';end;
 if not rejected then raise exception 'Consecutive manual kit accepted';end if;
 -- Closing a second pending date must not consume another kit.
 update training_accounts set medical_checked_through=current_date-3 where user_id=u;
 perform medical_auto_close_account(u);
 if (select count(*) from medical_kits where user_id=u and automatic)<>1 then raise exception 'Closing repeated a protection';end if;
end $$;
-- Two consecutive unclosed misses use one kit, then the normal miss breaks the streak.
do $$ declare u uuid:=pg_temp.protection_fixture(9); begin
 insert into workout_days(user_id,day,activity,minutes,confirmed_at) values(u,current_date-3,'Corrida',35,current_date-interval '60 hours');
 update training_accounts set medical_checked_through=current_date-3 where user_id=u;
 perform medical_auto_close_account(u);
 if (select count(*) from medical_kits where user_id=u and automatic)<>1
 or not exists(select 1 from medical_kits where user_id=u and used_on=current_date-2)
 or exists(select 1 from medical_kits where user_id=u and used_on=current_date-1)
 or medical_has_streak_before(u,current_date) then raise exception 'Consecutive automatic protections were allowed';end if;
end $$;
-- Both free and paid protections participate in the same cadence.
do $$ declare u uuid; n integer; purchase bigint; rejected boolean; begin
 for n in 4..5 loop
  u:=pg_temp.protection_fixture(n);
  perform set_config('request.jwt.claim.sub',u::text,true);
  insert into workout_days(user_id,day,activity,minutes,confirmed_at) values(u,current_date-2,'Corrida',35,current_date-interval '36 hours');
  perform economy_grant_monthly_kits(u,current_date);
  if n=4 then
   update medical_kits set used_on=current_date-1,used_at=current_date-interval '12 hours' where user_id=u and grant_slot=1;
  else
   perform economy_post(u,'test-funds','workout','Synthetic fixture',700,current_date);
   purchase:=economy_post(u,'test-paid','kit-purchase','Synthetic purchase',-350,current_date);
   insert into medical_kits(user_id,purchase_id,used_on,used_at) values(u,purchase,current_date-1,current_date-interval '12 hours');
  end if;
  rejected:=false;
  begin perform use_medical_kit(current_date,'UTC');exception when raise_exception then rejected:=sqlerrm like '%dias seguidos%';end;
  if not rejected then raise exception 'Consecutive kit accepted for origin %',n;end if;
 end loop;
end $$;
-- Account-local dates, immutable missed-day snapshot and valid rest classifications.
do $$ declare u uuid:=pg_temp.protection_fixture(6,'Pacific/Kiritimati'); d date:=(clock_timestamp() at time zone 'Pacific/Kiritimati')::date; begin
 perform set_config('request.jwt.claim.sub',u::text,true);
 insert into workout_days(user_id,day,activity,minutes,confirmed_at) values(u,d-2,'Corrida',35,((d-2)::timestamp at time zone 'Pacific/Kiritimati')+interval '12 hours');
 insert into training_extra_rests(user_id,day,authorized_at) values(u,d-1,((d-1)::timestamp at time zone 'Pacific/Kiritimati')+interval '12 hours');
 if not medical_has_streak_before(u,d) then raise exception 'Valid rest reset the sequence';end if;
 perform use_medical_kit(d,'UTC');
 if not exists(select 1 from medical_kits where user_id=u and used_on=d) then raise exception 'Account timezone ignored';end if;
 insert into gf_days(user_id,day,kind,completed,minutes) values(u,d-1,'training',false,0);
 if medical_has_streak_before(u,d) then raise exception 'Immutable missing-day snapshot ignored';end if;
end $$;
-- Code search returns only the already-approved nickname lookup contract.
do $$ declare a uuid:=pg_temp.protection_fixture(7); b uuid:=pg_temp.protection_fixture(8); code uuid; response jsonb; begin
 select friend_code into code from profiles where id=b;
 perform set_config('request.jwt.claim.sub',a::text,true);
 response:=find_friend_by_code(code);
 if response->>'id'<>b::text or response->>'relationship'<>'none' or (select count(*) from jsonb_object_keys(response))<>4 then raise exception 'Code lookup contract mismatch';end if;
 if exists(select 1 from friendships where requester=a or recipient=a) then raise exception 'Lookup sent an invitation';end if;
 perform send_friend_request(code);
 if find_friend_by_code(code)->>'relationship'<>'outgoing' then raise exception 'Pending relation lost';end if;
 perform set_config('request.jwt.claim.sub',b::text,true);
 select friend_code into code from profiles where id=a;
 if find_friend_by_code(code)->>'relationship'<>'incoming' then raise exception 'Incoming relation lost';end if;
 if find_friend_by_code('c4200000-ffff-4000-8000-000000000000') is not null then raise exception 'Unknown code exposed data';end if;
end $$;
do $$ begin
 if has_function_privilege('anon','public.find_friend_by_code(uuid)','execute')
 or has_function_privilege('authenticated','public.medical_protection_reason(uuid,date)','execute')
 or has_function_privilege('authenticated','public.medical_has_streak_before(uuid,date)','execute')
 then raise exception 'Private protection helper or code search exposed';end if;
 if (select kit_price from economy_rules)<>350 or (select monthly_free_kits from economy_rules)<>2 then raise exception 'Economy changed';end if;
end $$;
rollback;
