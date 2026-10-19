-- Profile-only storefront. No deletion of purchases, equipment or financial history.
begin;
set local lock_timeout='5s';set local statement_timeout='60s';
alter table public.gf_items drop constraint gf_items_category_check;
alter table public.gf_items add constraint gf_items_category_check check(category in('frame','share','theme','emoji','banner'));
alter table public.gf_equipped drop constraint gf_equipped_category_check;
alter table public.gf_equipped add constraint gf_equipped_category_check check(category in('frame','share','theme','emoji','banner'));
update public.gf_items set enabled=false;
insert into public.gf_items(id,name,category,price,rarity) values
 ('frame-sport-band','Faixa Esportiva','frame',80,'common'),
 ('frame-water-wave','Onda Aquática','frame',150,'common'),
 ('frame-living-flame','Chama Viva','frame',250,'rare'),
 ('frame-classic','Clássica','frame',450,'rare'),
 ('banner-sunset','Entardecer Relax','banner',100,'common'),
 ('banner-forest','Trilha na Floresta','banner',180,'common'),
 ('banner-night','Noite Ativa','banner',300,'rare'),
 ('banner-barbecue','Churrasco no Pátio','banner',250,'rare');

create function public.gf_profile_cosmetics_state(p_user uuid) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'name',i.name,'category',i.category,'price',i.price,'rarity',i.rarity,'badgeKey',i.badge_key,
 'owned',v.item_id is not null,'equipped',coalesce(e.item_id=i.id,false) and (i.category<>'frame' or i.enabled),
 'locked',i.badge_key is not null and not exists(select 1 from gf_badges where user_id=p_user and key=i.badge_key)) order by i.category,i.price,i.id),'[]')
 from gf_items i left join gf_inventory v on v.item_id=i.id and v.user_id=p_user
 left join gf_equipped e on e.user_id=p_user and e.category=i.category
 where i.enabled or v.item_id is not null;
$$;
-- Existing installed clients cannot parse the new banner category.
create or replace function public.gf_shop_catalog_state(p_user uuid) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce(jsonb_agg(value),'[]'::jsonb) from jsonb_array_elements(gf_profile_cosmetics_state(p_user))
 where value->>'category'<>'banner';
$$;
create or replace function public.get_gamification_state(p_timezone text,p_shop_version integer) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare payload jsonb;
begin
 if p_shop_version is null or p_shop_version not in(2,3) then raise exception 'Atualize a versão da Loja.'; end if;
 payload:=get_gamification_state(p_timezone);
 return jsonb_set(payload,'{cosmetics}',case when p_shop_version=3 then gf_profile_cosmetics_state(auth.uid()) else gf_shop_catalog_state(auth.uid()) end);
end $$;
create or replace function public.equip_cosmetic(p_category text,p_item text,p_timezone text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=social_require_profile();
begin
 perform get_training_state(p_timezone);
 perform 1 from training_accounts where user_id=u for update;
 if p_category is null or p_category not in('frame','share','theme','emoji','banner') then raise exception 'Categoria inválida.'; end if;
 if p_item is null then delete from gf_equipped where user_id=u and category=p_category;
 else
  if not exists(select 1 from gf_inventory v join gf_items i on i.id=v.item_id where v.user_id=u and i.id=p_item and i.category=p_category
    and (i.category not in('frame','banner') or i.enabled))
   then raise exception 'Este item não está disponível para equipar.'; end if;
  insert into gf_equipped(user_id,category,item_id) values(u,p_category,p_item)
   on conflict(user_id,category) do update set item_id=excluded.item_id;
 end if;
 return gf_cosmetics_state(u);
end $$;
revoke all on function public.gf_profile_cosmetics_state(uuid) from public,anon,authenticated;
-- Enrich only people already visible to this caller; no directory/profile endpoint.
create function public.gf_social_appearance(p_user uuid) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce((select jsonb_build_object('frame',i.id,'avatar',jsonb_build_object(
   'nickname',p.nickname,'color',p.avatar_color,'style',p.avatar_style,'photo',p.avatar_photo))
 from profiles p join gf_equipped e on e.user_id=p.id and e.category='frame'
 join gf_items i on i.id=e.item_id and i.enabled and i.category='frame'
 where p.id=p_user),'{}'::jsonb);
$$;
alter function public.get_social_state() rename to profile_base_social_state;
revoke all on function public.profile_base_social_state(),public.gf_social_appearance(uuid) from public,anon,authenticated;
create function public.get_social_state() returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare payload jsonb; groups_value jsonb; friends_value jsonb;
begin
 perform social_require_profile();
 payload:=profile_base_social_state();
 select coalesce(jsonb_agg(f||gf_social_appearance((f->>'id')::uuid)),'[]') into friends_value
 from jsonb_array_elements(payload->'friends') f;
 select coalesce(jsonb_agg(g||jsonb_build_object('members',(
   select coalesce(jsonb_agg(m||case when (m->>'accepted')::boolean and not (g->>'invited')::boolean
     then gf_social_appearance((m->>'id')::uuid) else '{}'::jsonb end),'[]')
   from jsonb_array_elements(g->'members') m))),'[]') into groups_value
 from jsonb_array_elements(payload->'groups') g;
 return payload||jsonb_build_object('friends',friends_value,'groups',groups_value);
end $$;
revoke all on function public.get_social_state() from public,anon,authenticated;
grant execute on function public.get_social_state() to authenticated;
notify pgrst,'reload schema';
commit;
