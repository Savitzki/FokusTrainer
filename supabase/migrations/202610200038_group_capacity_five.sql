-- Five slots for new memberships. Existing members, invitations and results remain intact.
-- Prepared for review; apply to production only after explicit authorization.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

create or replace function public.create_streak_group(p_name text,p_friends uuid[],p_timezone text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=social_require_profile();
begin
 perform pg_advisory_xact_lock(607173021);
 perform 1 from profiles where id=u for update;
 if coalesce(cardinality(p_friends),0) not between 1 and 4 then
  raise exception 'Escolha de 1 a 4 amigos. O grupo tem até 5 vagas.';
 end if;
 return arena_base_create_streak_group(p_name,p_friends,p_timezone);
end $$;

-- Shared lock order matches all Arena membership RPCs. The insertion guard also
-- protects cached clients and other trusted insertion paths without changing
-- invitation receipts, admin commands, acceptance or historical snapshots.
create function public.arena_enforce_group_capacity() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform pg_advisory_xact_lock(607173021);
 if tg_op='UPDATE' and new.group_id=old.group_id then return new;end if;
 if not exists(select 1 from group_members where group_id=new.group_id and user_id=new.user_id)
    and (select count(*) from group_members where group_id=new.group_id)>=5 then
  raise exception 'O grupo já tem 5 integrantes ou convites. Não há vagas disponíveis.';
 end if;
 return new;
end $$;
revoke all on function public.arena_enforce_group_capacity() from public,anon,authenticated;
create trigger arena_group_capacity before insert or update of group_id on public.group_members
for each row execute function public.arena_enforce_group_capacity();
comment on trigger arena_group_capacity on public.group_members is
 'Five slots for new membership inserts; existing memberships/invitations are grandfathered. No historical rewrite.';
notify pgrst,'reload schema';
commit;
