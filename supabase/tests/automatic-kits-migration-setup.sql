-- Disposable database only: a 250 purchase must survive the price change.
insert into auth.users(id) values('c3100000-0000-4000-8000-000000000001');
insert into profiles(id,nickname) values('c3100000-0000-4000-8000-000000000001','auto.legacy');
set request.jwt.claim.sub='c3100000-0000-4000-8000-000000000001';
select get_training_state('UTC');
select economy_post(auth.uid(),'fixture','workout','Synthetic legacy fixture',1000,current_date);
select buy_medical_kit('c3110000-0000-4000-8000-000000000001','UTC');
create table automatic_kits_legacy_baseline(table_name text primary key,digest text);
do $$ declare name text;value text;begin
 foreach name in array array['profiles','workout_days','weight_logs','weight_entries','training_accounts','training_plans','training_reschedules','training_extra_rests','streak_groups','group_days','group_members','friendships','coin_wallets','coin_movements','medical_kits','gf_days','gf_inventory','gf_equipped'] loop
  execute format('select md5(coalesce(string_agg(v::text,''|'' order by v::text),'''')) from (select to_jsonb(x)-''automatic''-''day_closed_at''-''notice_seen_at''-''medical_checked_through'' v from public.%I x) rows',name) into value;
  insert into automatic_kits_legacy_baseline values(name,value);
 end loop;
end $$;
