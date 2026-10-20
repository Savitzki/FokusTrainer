-- Extend the existing friendship-scoped showcase; no new public table access.
begin;
create or replace function public.get_friend_showcase(p_user uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=social_require_profile();result jsonb;streak_value jsonb;
begin
 if p_user is distinct from u then
  -- Keep authorization valid for the whole request, including concurrent removal.
  perform 1 from friendships where status='accepted' and
   ((requester=u and recipient=p_user) or (recipient=u and requester=p_user)) for share;
  if not found then raise exception 'Este perfil está disponível apenas para amigos.';end if;
 end if;
 -- Use the authoritative calculation, including its existing day settlement and
 -- immutable snapshots. Do not derive points from workout counts or client time.
 streak_value:=gf_streak(p_user);
 select jsonb_build_object(
  'nickname',p.nickname,
  'displayName',case when jsonb_typeof(a.raw_user_meta_data->'display_name')='string'
    then nullif(left(btrim(a.raw_user_meta_data->>'display_name'),40),'') end,
  'avatar',jsonb_build_object('nickname',p.nickname,'color',p.avatar_color,'style',p.avatar_style,'photo',p.avatar_photo),
  'frame',(select i.id from gf_equipped e join gf_items i on i.id=e.item_id and i.enabled and i.category=e.category
    where e.user_id=p.id and e.category='frame'),
  'banner',(select i.id from gf_equipped e join gf_items i on i.id=e.item_id and i.enabled and i.category=e.category
    where e.user_id=p.id and e.category='banner'),
  'streak',streak_value,
  'badges',coalesce((select jsonb_agg(jsonb_build_object(
   'key',c.key,'name',c.name,'icon',c.icon,'rarity',c.rarity,'medalKey',c.medal_key,'earnedAt',b.earned_at)
   order by array_position(g.featured,b.key))
   from gf_badges b join gf_badge_catalog c using(key) join gf_accounts g on g.user_id=b.user_id
   where b.user_id=p.id and b.key=any(g.featured) and (g.show_badges or p.id=u)),'[]'))
 into result from profiles p join auth.users a on a.id=p.id where p.id=p_user;
 if result is null then raise exception 'Perfil indisponível.';end if;
 return result;
end $$;
revoke all on function public.get_friend_showcase(uuid) from public,anon,authenticated;
grant execute on function public.get_friend_showcase(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
