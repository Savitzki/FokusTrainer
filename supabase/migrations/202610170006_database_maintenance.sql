-- Apply after migrations 001–005. No records or application columns are removed.
begin;
set local lock_timeout = '5s';

-- Cover both sides of friendship lookups and foreign-key cascade checks.
create index if not exists friendships_requester_idx on public.friendships(requester);
create index if not exists friendships_recipient_idx on public.friendships(recipient);
create index if not exists streak_groups_owner_id_idx on public.streak_groups(owner_id);
create index if not exists push_devices_user_id_idx on public.push_devices(user_id);
create index if not exists group_workout_events_workout_id_idx on public.group_workout_events(workout_id);
create index if not exists group_workout_events_sender_id_idx on public.group_workout_events(sender_id);
create index if not exists group_push_jobs_device_id_idx on public.group_push_jobs(device_id);
create index if not exists group_push_jobs_recipient_id_idx on public.group_push_jobs(recipient_id);

-- Trigger execution does not require browser roles to call the trigger function.
revoke all on function public.fokus_profile_updated_at() from public, anon, authenticated;
-- Supabase may install this internal event trigger. Leave its definition and
-- event registration intact; only remove direct API execution privileges.
do $$
begin
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='rls_auto_enable'
      and p.pronargs=0 and p.prorettype='event_trigger'::regtype
  ) then
    execute 'revoke all on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end $$;

commit;
