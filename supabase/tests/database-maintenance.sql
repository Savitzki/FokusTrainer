-- Disposable database only. Verify maintenance preserves actual app access.
begin;
create table public.fokus_test_rls (id integer);
do $$
declare routine text;
begin
  if not (select relrowsecurity from pg_class where oid='public.fokus_test_rls'::regclass) then
    raise exception 'Revoking API access broke the platform event trigger';
  end if;
  if exists (
    select 1 from pg_constraint fk
    join pg_class t on t.oid=fk.conrelid join pg_namespace n on n.oid=t.relnamespace
    where fk.contype='f' and n.nspname='public' and not exists (
      select 1 from pg_index i where i.indrelid=fk.conrelid and i.indisvalid
        and i.indpred is null and i.indexprs is null
        and (i.indkey::smallint[])[0:cardinality(fk.conkey)-1] @> fk.conkey
    )
  ) then raise exception 'A foreign key still lacks a covering index'; end if;
  foreach routine in array array['public.rls_auto_enable()', 'public.fokus_profile_updated_at()'] loop
    if has_function_privilege('anon',routine,'EXECUTE') or has_function_privilege('authenticated',routine,'EXECUTE') then
      raise exception 'Trigger function remains directly callable: %',routine;
    end if;
  end loop;
  if not has_function_privilege('authenticated','public.sync_weights(uuid,jsonb,text)','EXECUTE')
    or not has_function_privilege('authenticated','public.get_social_state()','EXECUTE')
    or not has_function_privilege('authenticated','public.notify_workout_groups(uuid,uuid[])','EXECUTE') then
    raise exception 'Maintenance removed an application RPC permission';
  end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
update public.profiles set nickname=nickname where id=auth.uid();
reset role;
do $$ begin
  if not exists(select 1 from public.profiles where id='11111111-1111-4111-8111-111111111111' and updated_at=now()) then
    raise exception 'Profile timestamp trigger no longer runs for authenticated updates';
  end if;
end $$;
rollback;
select 'PASS: foreign key indexes, private trigger functions, platform RLS event and authenticated profile updates' as result;
