-- Run immediately after 038, before other fixtures mutate the baseline.
do $$ declare b record;value text;begin
 for b in select * from group_capacity_baseline loop
  execute format('select md5(coalesce(string_agg(to_jsonb(x)::text,''|'' order by to_jsonb(x)::text),'''')) from public.%I x',b.table_name) into value;
  if value<>b.digest then raise exception 'Migration changed historical data: %',b.table_name;end if;
 end loop;
 if has_function_privilege('anon','public.create_streak_group(text,uuid[],text)','execute') or has_function_privilege('authenticated','public.arena_base_create_streak_group(text,uuid[],text)','execute') or has_function_privilege('authenticated','public.arena_enforce_group_capacity()','execute') then raise exception 'Unsafe function privilege';end if;
end $$;
set role authenticated;
set request.jwt.claim.sub='d3850000-0000-4000-8000-000000000001';
do $$ begin
 begin perform create_streak_group('Too big',array(select ('d3850000-0000-4000-8000-'||lpad(x::text,12,'0'))::uuid from generate_series(2,6)x),'UTC');raise exception 'Accepted six members';exception when others then if sqlerrm not like '%até 5 vagas%' then raise;end if;end;
end $$;
reset role;
create temporary table capacity_new as select null::uuid id;
set role authenticated;
-- Temp fixture access only; creation itself runs with the real authenticated role below.
reset role;
grant all on capacity_new to authenticated;
set role authenticated;
update capacity_new set id=create_streak_group('Five slots',array['d3850000-0000-4000-8000-000000000002','d3850000-0000-4000-8000-000000000003','d3850000-0000-4000-8000-000000000004']::uuid[],'UTC');
select arena_group_command((select id from capacity_new),'invite','d3850000-0000-4000-8000-000000000005',null,'d3852000-0000-4000-8000-000000000001');
select arena_group_command((select id from capacity_new),'invite','d3850000-0000-4000-8000-000000000005',null,'d3852000-0000-4000-8000-000000000001');
do $$ begin
 begin perform arena_group_command((select id from capacity_new),'invite','d3850000-0000-4000-8000-000000000006',null,gen_random_uuid());raise exception 'Accepted sixth slot';exception when others then if sqlerrm not like '%5 integrantes%' then raise;end if;end;
end $$;
-- A legacy invitation is still valid; the old group is never shrunk by migration.
set request.jwt.claim.sub='d3850000-0000-4000-8000-000000000008';
select reply_group_invite('d3851000-0000-4000-8000-000000000001',true);
reset role;
do $$ begin
 if (select count(*) from group_members where group_id='d3851000-0000-4000-8000-000000000001')<>8 then raise exception 'Legacy group lost people';end if;
 if (select count(*) from group_members where group_id=(select id from capacity_new))<>5 then raise exception 'Incorrect new capacity';end if;
 if exists(select 1 from arena_group_receipts where user_id='d3850000-0000-4000-8000-000000000001' and payload->>2='d3850000-0000-4000-8000-000000000006') then raise exception 'Rejected invitation persisted receipt';end if;
 if not exists(select 1 from group_days where group_id='d3851000-0000-4000-8000-000000000001' and members_count=7) then raise exception 'Historical result lost';end if;
end $$;
select 'PASS five group slots: creation, invite, idempotence, blocked sixth, existing eight and pending invitation preserved';
