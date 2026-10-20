-- Run only against a disposable database after migration 035.
begin;
do $$ declare item record; begin
 for item in select * from (values
  ('gf_challenges_owner_settled','gf_challenges',array['owner_id','settled_at']),
  ('gf_badge_memberships_user_group','gf_badge_memberships',array['user_id','group_id','accepted_at']),
  ('gf_badge_points_membership','gf_badge_group_points',array['membership_id','user_id','group_id']),
  ('arena_taunt_jobs_device_created','arena_taunt_push_jobs',array['device_id','created_at'])
 ) expected(index_name,table_name,columns) loop
  if not exists(select 1 from pg_index i join pg_class idx on idx.oid=i.indexrelid
   where idx.relname=item.index_name and i.indrelid=('public.'||item.table_name)::regclass
   and i.indisvalid and i.indisready and i.indpred is null
   and (select array_agg(a.attname::text order by k.ordinality)
        from unnest(i.indkey) with ordinality k(attnum,ordinality)
        join pg_attribute a on a.attrelid=i.indrelid and a.attnum=k.attnum)=item.columns)
  then raise exception 'Missing/invalid query index: %',item.index_name;end if;
  if not (select relrowsecurity from pg_class where oid=('public.'||item.table_name)::regclass)
  then raise exception 'RLS changed: %',item.table_name;end if;
 end loop;
 if has_table_privilege('authenticated','public.arena_taunt_push_jobs','select,insert,update,delete')
 then raise exception 'Private push state exposed';end if;
end $$;
select 'PASS incremental query indexes valid; RLS/private access preserved';
rollback;
