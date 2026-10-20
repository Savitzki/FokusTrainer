-- Accepted memberships and a consolidated day predating the Arena expansion.
insert into auth.users(id) values('d3310000-0000-4000-8000-000000000001'),('d3310000-0000-4000-8000-000000000002');
insert into profiles(id,nickname) select id,'old.group.'||right(id::text,1) from auth.users where id::text like 'd3310000%';
insert into training_accounts(user_id,time_zone,started_on) select id,'America/Sao_Paulo',current_date-10 from profiles where id::text like 'd3310000%';
insert into training_plans(user_id,revision,effective_on,training_days,created_at) select id,1,current_date-10,array[1,3,5],current_date-10 from profiles where id::text like 'd3310000%';
insert into streak_groups(id,owner_id,name,time_zone,status,started_on,training_checked_through) values('d3311000-0000-4000-8000-000000000001','d3310000-0000-4000-8000-000000000001','Grupo anterior','America/Sao_Paulo','active',current_date-7,current_date-1);
insert into group_members select 'd3311000-0000-4000-8000-000000000001',id,'accepted' from profiles where id::text like 'd3310000%';
insert into group_days(group_id,day,members_count,counts_for_streak) values('d3311000-0000-4000-8000-000000000001',current_date-1,2,true);
create table arena_group_legacy_baseline(table_name text primary key,digest text);
do $$ declare name text;value text;begin foreach name in array array['streak_groups','group_members','group_days','friendships','gf_challenges','gf_challenge_members','coin_movements','coin_wallets','gf_badges','medical_kits','training_plans','training_accounts'] loop execute format('select md5(coalesce(string_agg(to_jsonb(x)::text,''|'' order by to_jsonb(x)::text),'''')) from public.%I x',name) into value;insert into arena_group_legacy_baseline values(name,value);end loop;end $$;
