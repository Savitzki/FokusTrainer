-- Read-path and foreign-key support only. No records, RPCs, RLS or rewards change.
-- Production application requires explicit authorization.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

-- Open-challenge quotas and ownership references, without scanning other accounts.
create index if not exists gf_challenges_owner_settled
  on public.gf_challenges(owner_id,settled_at);
-- Membership/achievement evidence by account; existing indexes start with group_id.
create index if not exists gf_badge_memberships_user_group
  on public.gf_badge_memberships(user_id,group_id,accepted_at);
-- Cover the composite membership FK for evidence checks and account deletion.
create index if not exists gf_badge_points_membership
  on public.gf_badge_group_points(membership_id,user_id,group_id);
-- Optional push delivery checks the most recent attempt for each device.
create index if not exists arena_taunt_jobs_device_created
  on public.arena_taunt_push_jobs(device_id,created_at desc);

commit;
