-- Synthetic data, real server clock. Transaction is always rolled back.
begin;
do $$ declare t record; value text; begin
 for t in select * from automatic_kits_legacy_baseline loop
  execute format('select md5(coalesce(string_agg(v::text,''|'' order by v::text),'''')) from (select to_jsonb(x)-''automatic''-''day_closed_at''-''notice_seen_at''-''medical_checked_through'' v from public.%I x) rows',t.table_name) into value;
  if value is distinct from t.digest then raise exception '031 changed existing rows: %',t.table_name;end if;
 end loop;
 if (select kit_price from economy_rules)<>350 or (select monthly_free_kits from economy_rules)<>2 then raise exception 'Incorrect kit rules';end if;
 if exists(select 1 from medical_kits where automatic) then raise exception 'Migration consumed a kit';end if;
end $$;

-- Activation is moved ONLY inside this disposable test transaction.
update economy_rules set medical_auto_started_at=now()-interval '60 days';
create function pg_temp.fixture(n integer,tz text default 'UTC',start_on date default current_date-1) returns uuid language plpgsql as $$
declare u uuid:=('c3100000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid;
begin
 insert into auth.users(id) values(u);
 insert into profiles(id,nickname) values(u,'auto.fixture.'||n);
 insert into training_accounts(user_id,time_zone,started_on) values(u,tz,start_on);
 insert into training_plans(user_id,revision,effective_on,training_days,created_at,starts_immediately)
 values(u,1,start_on,array[1,2,3,4,5,6,7],start_on::timestamp at time zone tz,true);
 return u;
end $$;

-- Closing yesterday consumes once; open day, balance, workouts and rewards untouched.
do $$ declare u uuid:=pg_temp.fixture(2); s jsonb; v bigint; begin
 perform medical_auto_close_account(u);
 if (select count(*) from medical_kits where user_id=u and automatic)<>1
 or training_day_kind(u,current_date-1)<>'medical-kit'
 or exists(select 1 from medical_kits where user_id=u and used_on=current_date)
 or exists(select 1 from workout_days where user_id=u)
 or exists(select 1 from coin_movements where user_id=u)
 or (select balance from coin_wallets where user_id=u)<>0 then raise exception 'Automatic closure generated points, coins, workout or wrong day';end if;
 select revision into v from training_accounts where user_id=u;
 perform medical_auto_close_account(u);
 if (select revision from training_accounts where user_id=u)<>v or (select count(*) from medical_kits where user_id=u and automatic)<>1 then raise exception 'Repeated closure consumed twice';end if;
 perform set_config('request.jwt.claim.sub',u::text,true);
 s:=get_economy_state('Pacific/Kiritimati');
 if s->>'timezone'<>'UTC' or jsonb_array_length(s->'automaticNotices')<>1 then raise exception 'Fixed timezone or notice lost';end if;
 if (select kind from gf_day(u,current_date-1))<>'medical-kit' then raise exception 'Snapshot did not include automatic protection';end if;
end $$;

-- Completed workout, rest, extra rest, manual kit, missing plan and immutable snapshot.
do $$ declare u uuid; n integer; begin
 for n in 3..8 loop
  u:=pg_temp.fixture(n);
  if n=3 then insert into workout_days(user_id,day,activity,minutes,confirmed_at) values(u,current_date-1,'Corrida',35,current_date-interval '12 hours');end if;
  if n=4 then update training_plans set training_days=array[extract(isodow from current_date)::integer] where user_id=u;end if;
  if n=5 then insert into training_extra_rests(user_id,day,authorized_at) values(u,current_date-1,current_date-interval '12 hours');end if;
  if n=6 then
   perform economy_grant_monthly_kits(u,current_date-1);
   update medical_kits set used_on=current_date-1,used_at=current_date-interval '12 hours' where user_id=u and grant_slot=1;
  end if;
  if n=7 then delete from training_plans where user_id=u;end if;
  if n=8 then insert into gf_days(user_id,day,kind,completed,minutes) values(u,current_date-1,'training',false,0);end if;
  perform medical_auto_close_account(u);
  if exists(select 1 from medical_kits where user_id=u and automatic) then raise exception 'Protected/completed/unplanned/consolidated day consumed kit: %',n;end if;
 end loop;
end $$;

-- A rescheduled origin rests; missed compensation uses a kit, without double consumption.
do $$ declare u uuid; origin date:=current_date-1; target date:=current_date; begin
 if extract(isodow from origin)=7 then origin:=origin-1;target:=origin+1;end if;
 u:=pg_temp.fixture(9,'UTC',origin);
 insert into training_reschedules(user_id,original_day,target_day,week_start,revision,created_at)
 values(u,origin,target,date_trunc('week',origin)::date,2,origin::timestamp+interval '12 hours');
 perform medical_auto_close_account(u);
 if exists(select 1 from medical_kits where user_id=u and used_on=origin) then raise exception 'Rescheduled origin consumed kit';end if;
 if target<current_date and not exists(select 1 from medical_kits where user_id=u and used_on=target and automatic) then raise exception 'Missed compensation was not protected';end if;
end $$;

-- No pre-activation backfill; current day is never closed early.
do $$ declare u uuid:=pg_temp.fixture(10,'UTC',current_date-5);begin
 update economy_rules set medical_auto_started_at=current_date;
 perform medical_auto_close_account(u);
 if exists(select 1 from medical_kits where user_id=u and automatic) then raise exception 'Pre-activation day changed';end if;
 update economy_rules set medical_auto_started_at=current_date-60;
end $$;

-- Monthly allowance expires; free stock first, acquired-later paid stock is ineligible.
do $$ declare u uuid:=pg_temp.fixture(11); purchase bigint; begin
 perform economy_grant_monthly_kits(u,current_date-1);
 update medical_kits set used_on=current_date-10-grant_slot,used_at=current_date-interval '10 days' where user_id=u;
 perform economy_post(u,'seed','workout','Synthetic fixture',700,current_date);
 purchase:=economy_post(u,'paid-late','kit-purchase','Synthetic purchase',-350,current_date);
 insert into medical_kits(user_id,purchase_id) values(u,purchase);
 perform medical_auto_close_account(u);
 if exists(select 1 from medical_kits where user_id=u and automatic) then raise exception 'Kit purchased after close saved past day or free grant refilled';end if;
 if training_day_kind(u,current_date-1)<>'training' then raise exception 'Missed day was incorrectly protected';end if;
end $$;

-- More than two uses remain possible with paid inventory. No coins awarded for protection.
do $$ declare u uuid:=pg_temp.fixture(12,'UTC',current_date-4); p bigint; n integer; begin
 perform economy_post(u,'seed','workout','Synthetic fixture',1400,current_date);
 for n in 1..4 loop
  p:=economy_post(u,'paid-'||n,'kit-purchase','Synthetic purchase',-350,current_date);
  insert into medical_kits(user_id,purchase_id,acquired_at) values(u,p,current_date-interval '5 days');
 end loop;
 perform medical_auto_close_account(u);
 if (select count(*) from medical_kits where user_id=u and automatic)<>4 then raise exception 'Paid uses incorrectly limited';end if;
 if (select count(*) from medical_kits where user_id=u and automatic and purchase_id is null)<>2 and extract(day from current_date)>4 then raise exception 'Paid inventory used before free inventory';end if;
 if (select balance from coin_wallets where user_id=u)<>0 then raise exception 'Automatic kit awarded/spent coins';end if;
end $$;

-- Month-end closure uses the closing month's free allowance, never next month's.
do $$ declare last_month_day date:=date_trunc('month',current_date)::date-1;u uuid;begin
 u:=pg_temp.fixture(13,'UTC',last_month_day);
 perform medical_auto_close_account(u);
 if not exists(select 1 from medical_kits where user_id=u and used_on=last_month_day and grant_month=date_trunc('month',last_month_day)::date and automatic) then raise exception 'Month-end used the next month allowance';end if;
 if exists(select 1 from medical_kits where user_id=u and used_on=last_month_day and grant_month=date_trunc('month',current_date)::date) then raise exception 'New month kits saved an earlier month';end if;
end $$;

-- Account timezone is authoritative, even across the UTC/local calendar boundary.
do $$ declare u uuid;tz text; d date; n integer:=20;begin
 foreach tz in array array['America/Sao_Paulo','Pacific/Kiritimati','Pacific/Pago_Pago'] loop
  n:=n+1;d:=(now() at time zone tz)::date;
  u:=pg_temp.fixture(n,tz,d-1);
  perform set_config('request.jwt.claim.sub',u::text,true);
  perform get_training_state('UTC');
  if not exists(select 1 from medical_kits where user_id=u and used_on=d-1 and day_closed_at=d::timestamp at time zone tz)
  or exists(select 1 from medical_kits where user_id=u and used_on>=d) then raise exception 'Wrong day closed for timezone %',tz;end if;
 end loop;
end $$;

-- Arena settles members before snapshots. Protection holds but does not score.
do $$ declare u uuid:=pg_temp.fixture(30);v uuid:=pg_temp.fixture(31);g uuid:='c3120000-0000-4000-8000-000000000001'; digest text;begin
 insert into streak_groups(id,owner_id,name,time_zone,status,started_on) values(g,u,'Auto arena','UTC','active',current_date-1);
 insert into group_members(group_id,user_id,status) values(g,u,'accepted'),(g,v,'accepted');
 perform social_refresh_day(g);
 if not exists(select 1 from group_days where group_id=g and day=current_date-1 and not counts_for_streak) then raise exception 'Arena snapshot ignored auto protection or scored it';end if;
 select md5(to_jsonb(x)::text) into digest from group_days x where group_id=g and day=current_date-1;
 perform social_refresh_day(g);
 if digest is distinct from (select md5(to_jsonb(x)::text) from group_days x where group_id=g and day=current_date-1) then raise exception 'Consolidated Arena result rewritten';end if;
 if training_day_kind(u,current_date-1,'infinity',current_date::timestamptz-interval '1 hour')='medical-kit' then raise exception 'Later account closure rewrote earlier group cutoff';end if;
end $$;

-- A completed day is never turned into protection: streak retains training then valid rest.
do $$ declare u uuid:=pg_temp.fixture(32,'UTC',current_date-2);begin
 insert into workout_days(user_id,day,activity,minutes,confirmed_at) values(u,current_date-2,'Corrida',35,(current_date-2)::timestamp+interval '12 hours');
 perform medical_auto_close_account(u);
 if (select kind from gf_day(u,current_date-2))<>'training' or not (select completed from gf_day(u,current_date-2))
 or (select kind from gf_day(u,current_date-1))<>'medical-kit' or (select completed from gf_day(u,current_date-1)) then raise exception 'Training/rest streak day classification changed';end if;
end $$;

-- Price 350, old retry 250, insufficient balance atomic, and persistent read receipts.
set local role authenticated;
set local request.jwt.claim.sub='c3100000-0000-4000-8000-000000000001';
do $$ declare s jsonb;begin
 s:=buy_medical_kit('c3110000-0000-4000-8000-000000000001','UTC');
 if s->>'balance'<>'750' then raise exception 'Legacy 250 purchase charged again';end if;
 s:=buy_medical_kit('c3110000-0000-4000-8000-000000000002','UTC');
 if s->>'balance'<>'400' then raise exception 'New purchase did not cost 350';end if;
 perform buy_medical_kit('c3110000-0000-4000-8000-000000000002','UTC');
 if get_economy_state('UTC')->>'balance'<>'400' then raise exception 'Duplicate purchase';end if;
end $$;
set local request.jwt.claim.sub='c3100000-0000-4000-8000-000000000002';
do $$ declare s jsonb; ids uuid[]; before_value jsonb;begin
 s:=get_economy_state('UTC');
 begin perform buy_medical_kit(gen_random_uuid(),'UTC');raise exception 'Insufficient balance accepted';exception when raise_exception then if sqlerrm<>'Saldo insuficiente para comprar o Kit Médico.' then raise;end if;end;
 if s is distinct from get_economy_state('UTC') then raise exception 'Failed purchase changed wallet';end if;
 select array_agg((x->>'id')::uuid) into ids from jsonb_array_elements(s->'automaticNotices') x;
 s:=acknowledge_medical_kit_notice(ids,'Pacific/Kiritimati');
 if s->'automaticNotices'<>'[]'::jsonb then raise exception 'Notice did not persist';end if;
 before_value:=s;s:=acknowledge_medical_kit_notice(ids,'UTC');
 if s is distinct from before_value then raise exception 'Receipt retry changed state';end if;
end $$;
reset role;
do $$ declare other uuid;begin
 select id into other from medical_kits where user_id='c3100000-0000-4000-8000-000000000012' and automatic limit 1;
 perform acknowledge_medical_kit_notice(array[other],'UTC');
 if exists(select 1 from medical_kits where id=other and notice_seen_at is not null) then raise exception 'Another account acknowledged private notice';end if;
end $$;

set local role authenticated;
do $$ begin
 begin perform medical_auto_close_account(auth.uid());raise exception 'Private closure exposed';exception when insufficient_privilege then null;end;
 begin perform process_medical_kit_rollovers();raise exception 'Client ran global rollover';exception when insufficient_privilege then null;end;
 begin update medical_kits set automatic=true where user_id=auth.uid();raise exception 'Direct kit edit allowed';exception when insufficient_privilege then null;end;
end $$;
set local role anon;
do $$ begin
 begin perform acknowledge_medical_kit_notice(array[gen_random_uuid()],'UTC');raise exception 'Guest acknowledged notice';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$ begin
 if not has_function_privilege('service_role','process_medical_kit_rollovers()','execute') then raise exception 'Worker cannot run closure';end if;
 if exists(select 1 from coin_wallets w where w.user_id::text like 'c3100000-%' and w.balance<>coalesce((select sum(amount) from coin_movements where user_id=w.user_id),0)) then raise exception 'Ledger no longer matches balance';end if;
end $$;
rollback;
select 'PASS: migration preservation; server midnight; kit eligibility; idempotency; monthly/paid inventory; 350 price; fixed timezones; Arena snapshots; read receipts; ACL and ledger' as result;
