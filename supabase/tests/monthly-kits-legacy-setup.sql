-- Disposable database only: an old 50-coin purchase must remain valid after 016.
insert into auth.users(id) values('23232323-2323-4323-8323-000000000001');
insert into profiles(id,nickname) values('23232323-2323-4323-8323-000000000001','monthly.legacy');
set role authenticated;
set request.jwt.claim.sub='23232323-2323-4323-8323-000000000001';
select get_training_state('UTC');
reset role;
select economy_post('23232323-2323-4323-8323-000000000001','monthly-fixture','workout','Fixture',500,current_date);
set role authenticated;
select buy_medical_kit('25252525-2525-4525-8525-000000000001','UTC');
reset role;
create table monthly_kits_legacy_baseline(table_name text primary key,digest text);
do $$ declare name text;value text;begin
 foreach name in array array['profiles','workout_days','weight_logs','weight_entries','training_accounts','training_plans','training_extra_rests','streak_groups','group_days','group_members','friendships','coin_wallets','coin_movements','medical_kits'] loop
  execute format('select md5(coalesce(string_agg(v::text,''|'' order by v::text),'''')) from (select to_jsonb(x)-''grant_month''-''grant_slot'' v from public.%I x) rows',name) into value;
  insert into monthly_kits_legacy_baseline values(name,value);
 end loop;
end $$;
