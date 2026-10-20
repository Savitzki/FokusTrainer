-- Disposable database only: a legacy group larger than the new capacity.
insert into auth.users(id) select ('d3850000-0000-4000-8000-'||lpad(x::text,12,'0'))::uuid from generate_series(1,10)x;
insert into profiles(id,nickname) select id,'capacity.'||right(id::text,2) from auth.users where id::text like 'd3850000%';
insert into training_accounts(user_id,time_zone,started_on) select id,'UTC',current_date-10 from profiles where id::text like 'd3850000%';
insert into training_plans(user_id,revision,effective_on,training_days) select id,1,current_date-10,array[1,3,5] from profiles where id::text like 'd3850000%';
insert into friendships(requester,recipient,status) select 'd3850000-0000-4000-8000-000000000001',id,'accepted' from profiles where id::text like 'd3850000%' and id<>'d3850000-0000-4000-8000-000000000001';
insert into streak_groups(id,owner_id,name,time_zone,status,started_on,training_checked_through)
values('d3851000-0000-4000-8000-000000000001','d3850000-0000-4000-8000-000000000001','Legacy eight','UTC','active',current_date-8,current_date-1);
insert into group_members select 'd3851000-0000-4000-8000-000000000001',id,case when right(id::text,1)='8' then 'invited' else 'accepted' end from profiles where id::text like 'd3850000%' and right(id::text,2)::integer<=8;
insert into group_days(group_id,day,members_count,counts_for_streak) values('d3851000-0000-4000-8000-000000000001',current_date-1,7,true);
create table group_capacity_baseline(table_name text primary key,digest text);
do $$ declare name text;value text;begin foreach name in array array['streak_groups','group_members','group_days','arena_group_cycles','gf_badge_memberships','coin_movements','coin_wallets','gf_badges','medical_kits','friendships'] loop execute format('select md5(coalesce(string_agg(to_jsonb(x)::text,''|'' order by to_jsonb(x)::text),'''')) from public.%I x',name) into value;insert into group_capacity_baseline values(name,value);end loop;end $$;
