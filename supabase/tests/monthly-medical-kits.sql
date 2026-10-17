-- Disposable fixtures only. No production account or clock is modified.
begin;
do $$ declare t record;value text;begin
 for t in select * from monthly_kits_legacy_baseline loop
  execute format('select md5(coalesce(string_agg(v::text,''|'' order by v::text),'''')) from (select to_jsonb(x)-''grant_month''-''grant_slot'' v from public.%I x) rows',t.table_name) into value;
  if value is distinct from t.digest then raise exception '016 changed existing records: %',t.table_name;end if;
 end loop;
 if (select kit_price from economy_rules)<>250 or (select monthly_free_kits from economy_rules)<>2 or (select weekly_kit_limit from economy_rules) is not null then raise exception 'Monthly defaults not installed';end if;
end $$;
insert into auth.users(id) select ('23232323-2323-4323-8323-'||lpad(n::text,12,'0'))::uuid from generate_series(2,11) n;
insert into profiles(id,nickname) select ('23232323-2323-4323-8323-'||lpad(n::text,12,'0'))::uuid,'monthly.fixture.'||n from generate_series(2,11) n;

-- A repeated read on another device cannot refill consumed monthly slots.
set local role authenticated;
set local request.jwt.claim.sub='23232323-2323-4323-8323-000000000002';
do $$ declare s jsonb;again jsonb;d date;begin
 s:=get_economy_state('America/Sao_Paulo');
 d:=(now() at time zone 'America/Sao_Paulo')::date;
 if s->>'balance'<>'0' or s->>'kits'<>'2' or s->'history'->'entries'<>'[]'::jsonb
 or s->'monthlyKits'->>'month'<>date_trunc('month',d)::date::text
 or s->'monthlyKits'->>'freeAvailable'<>'2' or s->'monthlyKits'->>'purchasedAvailable'<>'0'
 or s->'rules'->>'kitUsageLimit'<>'inventory' then raise exception 'Initial monthly allowance incorrect';end if;
 again:=get_economy_state('Pacific/Kiritimati');
 if s is distinct from again or again->>'timezone'<>'America/Sao_Paulo' then raise exception 'A device changed month/timezone or duplicated grant';end if;
 s:=use_medical_kit(d,'America/Sao_Paulo');
 if s->>'kits'<>'1' or s->'monthlyKits'->>'freeAvailable'<>'1' then raise exception 'Monthly kit was not consumed';end if;
 again:=get_economy_state('Pacific/Kiritimati');
 if again->>'kits'<>'1' then raise exception 'Read refilled a consumed free kit';end if;
 again:=use_medical_kit(d,'America/Sao_Paulo');
 if s is distinct from again then raise exception 'Same-day retry consumed two benefits';end if;
end $$;
reset role;

-- Old purchases/retries retain their price; new purchases cost exactly 250.
set local role authenticated;
set local request.jwt.claim.sub='23232323-2323-4323-8323-000000000001';
do $$ declare s jsonb;again jsonb;begin
 s:=buy_medical_kit('25252525-2525-4525-8525-000000000001','Pacific/Kiritimati');
 if s->>'balance'<>'450' or s->>'kits'<>'3' or s->'monthlyKits'->>'purchasedAvailable'<>'1' then raise exception 'Legacy purchase changed or charged twice';end if;
 s:=buy_medical_kit('25252525-2525-4525-8525-000000000002','UTC');
 again:=buy_medical_kit('25252525-2525-4525-8525-000000000002','UTC');
 if s is distinct from again or s->>'balance'<>'200' or s->>'kits'<>'4' then raise exception 'New price or idempotency incorrect';end if;
 s:=use_medical_kit(current_date,'UTC');
 if s->'monthlyKits'->>'freeAvailable'<>'1' or s->'monthlyKits'->>'purchasedAvailable'<>'2' then raise exception 'Purchased kit consumed before free stock';end if;
end $$;
reset role;

-- Insufficient balance does not spend inventory, create credit or partial purchases.
select get_training_state('UTC') from (select set_config('request.jwt.claim.sub','23232323-2323-4323-8323-000000000003',true)) fixture;
select economy_post('23232323-2323-4323-8323-000000000003','seed','workout','Fixture',249,current_date);
set local role authenticated;
set local request.jwt.claim.sub='23232323-2323-4323-8323-000000000003';
do $$ declare before_value jsonb;after_value jsonb;begin
 before_value:=get_economy_state('UTC');
 begin perform buy_medical_kit('25252525-2525-4525-8525-000000000003','UTC');raise exception 'Insufficient balance accepted';exception when raise_exception then if sqlerrm<>'Saldo insuficiente para comprar o Kit Médico.' then raise;end if;end;
 after_value:=get_economy_state('UTC');
 if before_value is distinct from after_value then raise exception 'Failed purchase changed state';end if;
end $$;
reset role;

-- Calendar month boundaries/year/leap day; unused free stock expires, paid stock does not.
select get_training_state('UTC') from (select set_config('request.jwt.claim.sub','23232323-2323-4323-8323-000000000004',true)) fixture;
select economy_post('23232323-2323-4323-8323-000000000004','seed','workout','Fixture',250,current_date);
set local role authenticated;
select buy_medical_kit('25252525-2525-4525-8525-000000000004','UTC');
reset role;
do $$ declare u uuid:='23232323-2323-4323-8323-000000000004';begin
 perform economy_grant_monthly_kits(u,'2026-12-31');
 if (select count(*) from economy_available_kits(u,'2026-12-31'))<>3 then raise exception 'December inventory incorrect';end if;
 perform economy_grant_monthly_kits(u,'2027-01-01');
 perform economy_grant_monthly_kits(u,'2027-01-31');
 if (select count(*) from economy_available_kits(u,'2027-01-01'))<>3
 or (select count(*) from medical_kits where user_id=u and grant_month='2027-01-01')<>2 then raise exception 'Unused stock accumulated or January refilled';end if;
 update medical_kits set used_on='2026-12-31',used_at='2026-12-31T12:00:00Z' where user_id=u and grant_month='2026-12-01' and grant_slot=1;
 if training_day_kind(u,'2026-12-31')<>'medical-kit' then raise exception 'Expiration erased protection history';end if;
 perform economy_grant_monthly_kits(u,'2028-02-29');
 if (select count(*) from economy_available_kits(u,'2028-02-29'))<>3 then raise exception 'Leap month allowance incorrect';end if;
 if (select count(*) from economy_available_kits(u,'2028-03-01'))<>1 then raise exception 'Expired free kits remained available';end if;
 perform economy_grant_monthly_kits(u,'2028-03-01');
 if (select count(*) from economy_available_kits(u,'2028-03-01'))<>3
 or (select count(*) from medical_kits where user_id=u and purchase_id is not null and used_on is null)<>1 then raise exception 'Paid stock expired or monthly inventory incorrect';end if;
end $$;

-- Bought stock stays usable after two earlier uses; there is no weekly allowance.
select get_training_state('UTC') from (select set_config('request.jwt.claim.sub','23232323-2323-4323-8323-000000000005',true)) fixture;
select economy_post('23232323-2323-4323-8323-000000000005','seed','workout','Fixture',1000,current_date);
set local role authenticated;
select buy_medical_kit(gen_random_uuid(),'UTC') from generate_series(1,3);
reset role;
do $$ declare u uuid:='23232323-2323-4323-8323-000000000005'; k record; n int:=0;begin
 for k in select id from medical_kits where user_id=u and purchase_id is not null order by acquired_at,id limit 2 loop
  n:=n+1;update medical_kits set used_on=current_date-n,used_at=now()-n*interval '1 day' where id=k.id;
 end loop;
end $$;
set local role authenticated;
do $$ declare s jsonb;begin
 s:=use_medical_kit(current_date,'UTC');
 if s->'rules'->>'kitUsageLimit'<>'inventory' or s->'monthlyKits'->>'purchasedAvailable'<>'1' or s->'monthlyKits'->>'freeAvailable'<>'1' then raise exception 'Weekly quota or wrong inventory source';end if;
 if extract(isodow from current_date)>=3 and (s->>'kitsUsedThisWeek')::int<>3 then raise exception 'Third weekly kit was not accepted';end if;
end $$;
reset role;

-- No inventory: consumed slots cannot be regenerated by refresh or use.
select get_training_state('UTC') from (select set_config('request.jwt.claim.sub','23232323-2323-4323-8323-000000000006',true)) fixture;
set local role authenticated;
select get_economy_state('UTC');
reset role;
update medical_kits set used_on=current_date-grant_slot,used_at=now()-grant_slot*interval '1 day' where user_id='23232323-2323-4323-8323-000000000006';
set local role authenticated;
do $$ begin
 begin perform use_medical_kit(current_date,'UTC');raise exception 'Empty inventory accepted';exception when raise_exception then if sqlerrm<>'Você não tem um Kit Médico disponível.' then raise;end if;end;
 if get_economy_state('UTC')->>'kits'<>'0' then raise exception 'Consumed grant was refilled';end if;
end $$;
reset role;

-- Scheduled rest, extra rest and completed workouts cannot consume a free kit.
insert into training_accounts(user_id,time_zone,started_on) values('23232323-2323-4323-8323-000000000007','UTC',current_date);
insert into training_plans(user_id,revision,effective_on,training_days,created_at)
 values('23232323-2323-4323-8323-000000000007',1,current_date-1,array(select i from generate_series(1,7) i where i not in(extract(isodow from current_date)::int,(extract(isodow from current_date)::int%7)+1)),'2000-01-01');
set local role authenticated;
set local request.jwt.claim.sub='23232323-2323-4323-8323-000000000007';
do $$ begin
 perform get_economy_state('UTC');
 begin perform use_medical_kit(current_date,'UTC');raise exception 'Scheduled rest consumed a kit';exception when raise_exception then if sqlerrm<>'Hoje já está protegido por um descanso.' then raise;end if;end;
 begin perform use_medical_kit(current_date-1,'UTC');raise exception 'Past date accepted';exception when raise_exception then if sqlerrm<>'O Kit Médico protege apenas hoje, antes de o dia terminar.' then raise;end if;end;
 if get_economy_state('UTC')->>'kits'<>'2' then raise exception 'Rest or invalid day consumed stock';end if;
end $$;
set local request.jwt.claim.sub='23232323-2323-4323-8323-000000000008';
select authorize_extra_rest('UTC');
do $$ begin
 perform get_economy_state('UTC');
 begin perform use_medical_kit(current_date,'UTC');raise exception 'Extra rest consumed a kit';exception when raise_exception then if sqlerrm<>'Hoje já está protegido por um descanso.' then raise;end if;end;
 if get_economy_state('UTC')->>'kits'<>'2' then raise exception 'Extra rest consumed stock';end if;
end $$;
set local request.jwt.claim.sub='23232323-2323-4323-8323-000000000009';
select confirm_daily_workout(current_date,'Monthly fixture',30,'UTC');
do $$ begin
 perform get_economy_state('UTC');
 begin perform use_medical_kit(current_date,'UTC');raise exception 'Completed workout consumed a kit';exception when raise_exception then if sqlerrm<>'Você já registrou o treino de hoje.' then raise;end if;end;
 if get_economy_state('UTC')->>'kits'<>'2' then raise exception 'Completed workout consumed stock';end if;
end $$;
reset role;

-- Free kits follow the same Arena snapshots as purchased kits.
insert into training_accounts(user_id,time_zone,started_on) values
 ('23232323-2323-4323-8323-000000000010','UTC',current_date),('23232323-2323-4323-8323-000000000011','UTC',current_date);
insert into streak_groups(id,owner_id,name,time_zone,status,started_on)
 values('26262626-2626-4626-8626-000000000001','23232323-2323-4323-8323-000000000010','Monthly arena','UTC','active',current_date);
insert into group_members(group_id,user_id,status) values
 ('26262626-2626-4626-8626-000000000001','23232323-2323-4323-8323-000000000010','accepted'),
 ('26262626-2626-4626-8626-000000000001','23232323-2323-4323-8323-000000000011','accepted');
set local role authenticated;
set local request.jwt.claim.sub='23232323-2323-4323-8323-000000000010';
select use_medical_kit(current_date,'UTC');
set local request.jwt.claim.sub='23232323-2323-4323-8323-000000000011';
select use_medical_kit(current_date,'UTC');
reset role;
do $$ declare original_digest text;begin
 if not exists(select 1 from group_days where group_id='26262626-2626-4626-8626-000000000001' and day=current_date and not counts_for_streak) then raise exception 'Free kit protection added collective points or failed';end if;
 if training_day_kind('23232323-2323-4323-8323-000000000010',current_date,'infinity',now()-interval '1 day')='medical-kit' then raise exception 'Kit rewrote closed snapshot';end if;
 select md5(to_jsonb(g)::text) into original_digest from group_days g where group_id='26262626-2626-4626-8626-000000000001' and day=current_date;
 perform confirm_daily_workout(current_date,'Voluntary after free protection',30,'UTC');
 if (select md5(to_jsonb(g)::text) from group_days g where group_id='26262626-2626-4626-8626-000000000001' and day=current_date) is distinct from original_digest then raise exception 'Voluntary workout rewrote a consolidated group day';end if;
end $$;

-- RLS, private allocation helpers and origin constraints cannot be bypassed.
set local role authenticated;
do $$ begin
 begin perform economy_grant_monthly_kits(auth.uid(),current_date+31);raise exception 'Client allocated future benefits';exception when insufficient_privilege then null;end;
 begin perform 1 from economy_available_kits(auth.uid(),current_date);raise exception 'Private inventory exposed';exception when insufficient_privilege then null;end;
 begin insert into medical_kits(user_id,grant_month,grant_slot) values(auth.uid(),date_trunc('month',current_date)::date,3);raise exception 'Direct mint allowed';exception when insufficient_privilege then null;end;
end $$;
set local role anon;
do $$ begin
 begin perform get_economy_state('UTC');raise exception 'Guest received kits';exception when insufficient_privilege then null;end;
 begin perform use_medical_kit(current_date,'UTC');raise exception 'Guest used kits';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$ begin
 begin insert into medical_kits(user_id,grant_month) values('23232323-2323-4323-8323-000000000002',date_trunc('month',current_date)::date);raise exception 'Missing slot accepted';exception when check_violation then null;end;
 begin insert into medical_kits(user_id,grant_month,grant_slot) values('23232323-2323-4323-8323-000000000002',date_trunc('month',current_date)::date,1);raise exception 'Duplicate slot accepted';exception when unique_violation then null;end;
 if exists(select 1 from coin_wallets w where w.user_id::text like '23232323-%' and w.balance<>coalesce((select sum(amount) from coin_movements where user_id=w.user_id),0)) then raise exception 'Monthly operations changed ledger consistency';end if;
end $$;
rollback;
select 'PASS: monthly allowance, expiry, calendar boundaries, old purchases, 250 price, no weekly quota, inventory priority, protection, Arena snapshots, RLS and history' as result;
