-- Disposable database only: reproduce the platform event trigger and its grants.
create function public.rls_auto_enable() returns event_trigger
language plpgsql security definer set search_path=pg_catalog as $$
declare command record;
begin
  for command in select * from pg_event_trigger_ddl_commands()
    where command_tag='CREATE TABLE' and schema_name='public' and object_type='table'
  loop
    execute format('alter table %s enable row level security', command.object_identity);
  end loop;
end $$;
grant execute on function public.rls_auto_enable() to anon, authenticated;
create event trigger fokus_test_rls_auto_enable on ddl_command_end
  when tag in ('CREATE TABLE') execute function public.rls_auto_enable();
