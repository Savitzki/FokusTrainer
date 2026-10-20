-- Disposable fixtures only. No old achievement/reward/date may be changed by 032.
update economy_rules set medical_auto_started_at=clock_timestamp();
insert into auth.users(id) values('c3200000-0000-4000-8000-000000000001');
insert into profiles(id,nickname) values('c3200000-0000-4000-8000-000000000001','achievements.legacy');
insert into training_accounts(user_id,time_zone,started_on) values('c3200000-0000-4000-8000-000000000001','UTC',current_date-30);
insert into training_plans(user_id,revision,effective_on,training_days,created_at)
 values('c3200000-0000-4000-8000-000000000001',1,current_date-30,array[1],current_date-30);
insert into gf_accounts(user_id,record_baseline,featured,show_badges)
 values('c3200000-0000-4000-8000-000000000001',99,array['workout-100','record','collective'],true);
insert into gf_badges(user_id,key,earned_at,historical)
 select 'c3200000-0000-4000-8000-000000000001',key,'2026-01-01T12:00:00Z',true from gf_badge_catalog;
insert into streak_groups(id,owner_id,name,time_zone,status,started_on)
 values('c3210000-0000-4000-8000-000000000001','c3200000-0000-4000-8000-000000000001','Existing seven','UTC','active',current_date-8);
insert into group_members(group_id,user_id,status)
 values('c3210000-0000-4000-8000-000000000001','c3200000-0000-4000-8000-000000000001','accepted');
insert into group_days(group_id,day,members_count,counts_for_streak)
 select 'c3210000-0000-4000-8000-000000000001',current_date-8+x,2,true from generate_series(0,6) x;
create table achievement_catalog_legacy_baseline(table_name text primary key,digest text);
do $$ declare name text;value text;begin
 foreach name in array array['profiles','workout_days','workout_sessions','training_accounts','training_plans','training_extra_rests','training_reschedules','gf_accounts','gf_badges','gf_days','gf_weeks','coin_wallets','coin_movements','medical_kits','weight_entries','weight_logs','streak_groups','group_members','group_days','gf_inventory','gf_equipped','gf_challenges','gf_challenge_members','economy_rules'] loop
  execute format('select md5(coalesce(string_agg(to_jsonb(x)::text,''|'' order by to_jsonb(x)::text),'''')) from public.%I x',name) into value;
  insert into achievement_catalog_legacy_baseline values(name,value);
 end loop;
end $$;
