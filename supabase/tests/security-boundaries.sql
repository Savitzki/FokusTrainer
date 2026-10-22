-- Metadata-only invariants. Run after all migrations in a disposable database.
begin;
do $$
declare t record; f record;
begin
  if has_schema_privilege('anon','public','create') or
     has_schema_privilege('authenticated','public','create') then
    raise exception 'Untrusted role can create objects in public';
  end if;
  for t in select c.oid,c.relname,c.relrowsecurity from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind in ('r','p')
      -- Snapshot fixtures exist only to prove historical preservation in this suite.
      and c.relname not in ('arena_legacy_baseline','arena_notice_legacy_baseline',
        'group_capacity_baseline','arena_group_legacy_baseline',
        'profile_cosmetics_legacy_snapshot','monthly_kits_legacy_baseline',
        'achievement_catalog_legacy_baseline','recording_test_baseline',
        'automatic_kits_legacy_baseline','locked_plans_baseline','manual_test_baseline',
        'test_reschedule_baseline','daily_legacy_before','daily_receipts_before')
  loop
    if not t.relrowsecurity then raise exception 'RLS missing: %',t.relname; end if;
    if has_any_column_privilege('anon',t.oid,'SELECT,INSERT,UPDATE,REFERENCES') or
       has_table_privilege('anon',t.oid,'DELETE,TRUNCATE,TRIGGER') then
      raise exception 'Anonymous table access: %',t.relname;
    end if;
    if t.relname not in ('profiles','arena_inbox_signals') and
       has_any_column_privilege('authenticated',t.oid,'SELECT') then
      raise exception 'Private table readable outside RPC: %',t.relname;
    end if;
    if t.relname <> 'profiles' and
       has_any_column_privilege('authenticated',t.oid,'INSERT,UPDATE,REFERENCES') then
      raise exception 'Private table writable outside RPC: %',t.relname;
    end if;
    if has_table_privilege('authenticated',t.oid,'DELETE,TRUNCATE,TRIGGER') then
      raise exception 'Untrusted destructive table access: %',t.relname;
    end if;
  end loop;
  for f in select p.oid,p.proname,p.proconfig from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prosecdef
  loop
    if not coalesce('search_path=public, pg_temp'=any(f.proconfig),false) then
      raise exception 'Unsafe definer search_path: %',f.proname;
    end if;
    if has_function_privilege('anon',f.oid,'execute') then
      raise exception 'Anonymous privileged function exposed: %',f.proname;
    end if;
    if (f.proname ~ '^(gf_|economy_|training_|social_|profile_base_|workout_base_|arena_)' and
        f.proname <> 'arena_group_command') or
       f.proname in ('claim_nickname_login_budget','begin_nickname_login','claim_push_jobs','finish_push_job',
         'claim_group_push_jobs','finish_group_push_job','claim_arena_taunt_push',
         'finish_arena_taunt_push','process_medical_kit_rollovers') then
      if has_function_privilege('authenticated',f.oid,'execute') then
        raise exception 'Internal privileged helper exposed: %',f.proname;
      end if;
    end if;
  end loop;
  if not exists(select 1 from pg_policies where schemaname='public' and
    tablename='arena_inbox_signals' and cmd='SELECT' and qual like '%auth.uid()%') then
    raise exception 'Owner policy missing on Realtime signal';
  end if;
end $$;
select 'PASS security boundaries: RLS, grants, definer paths, helpers and Realtime ownership';
rollback;
