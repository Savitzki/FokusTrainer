-- Expand the existing permanent catalog. Existing prices, inventory and ledger stay intact.
begin;
alter table public.gf_items drop constraint gf_items_category_check;
alter table public.gf_items add constraint gf_items_category_check check(category in('frame','share','theme','emoji'));
alter table public.gf_equipped drop constraint gf_equipped_category_check;
alter table public.gf_equipped add constraint gf_equipped_category_check check(category in('frame','share','theme','emoji'));
insert into public.gf_items(id,name,category,price,rarity,badge_key) values
 ('frame-energy','Energia','frame',250,'rare',null),
 ('frame-night','Noturna','frame',100,'common',null),
 ('frame-neon','Neon','frame',250,'rare',null),
 ('frame-hardcore','Hardcore','frame',250,'rare',null),
 ('frame-delicate','Delicada','frame',100,'common',null),
 ('frame-fokus','Fokus','frame',100,'common',null),
 ('frame-beast','Fera','frame',250,'rare',null),
 ('frame-victory','Vitória','frame',250,'achievement','week-4'),
 ('frame-king','Realeza','frame',250,'rare',null),
 ('share-impact','Impacto','share',200,'rare',null),
 ('share-night','Noturno','share',150,'common',null),
 ('share-dawn','Amanhecer','share',150,'common',null),
 ('share-beast','Fera','share',250,'rare',null),
 ('share-ice','Gelo','share',150,'common',null),
 ('share-minimal','Minimal','share',150,'common',null),
 ('share-fokus','Fokus','share',150,'common',null),
 ('theme-fokus','Fokus','theme',200,'common',null),
 ('theme-energy','Energia','theme',250,'rare',null),
 ('theme-progress','Progresso','theme',250,'rare',null),
 ('theme-power','Power','theme',250,'rare',null),
 ('emoji-fire','Chama','emoji',30,'common',null),
 ('emoji-strong','Força','emoji',40,'common',null),
 ('emoji-cool','Respeito','emoji',40,'common',null),
 ('emoji-clap','Aplausos','emoji',30,'common',null),
 ('emoji-energy','Energia','emoji',40,'common',null),
 ('emoji-brain','Foco','emoji',40,'common',null),
 ('emoji-trophy','Campeão','emoji',60,'rare',null),
 ('emoji-rocket','Avante','emoji',50,'common',null),
 ('emoji-eyes','De olho','emoji',30,'common',null),
 ('emoji-salute','Missão cumprida','emoji',50,'common',null),
 ('emoji-heart','Parceria','emoji',30,'common',null);
create function public.gf_shop_catalog_state(p_user uuid) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'name',i.name,'category',i.category,'price',i.price,'rarity',i.rarity,'badgeKey',i.badge_key,
 'owned',v.item_id is not null,'equipped',coalesce(e.item_id=i.id,false),'locked',i.badge_key is not null and not exists(select 1 from gf_badges where user_id=p_user and key=i.badge_key)) order by i.category,i.price,i.id),'[]')
 from gf_items i left join gf_inventory v on v.item_id=i.id and v.user_id=p_user
 left join gf_equipped e on e.user_id=p_user and e.category=i.category where i.enabled or v.item_id is not null;
$$;
-- Old installed PWAs keep the six products they know how to render and parse.
create or replace function public.gf_cosmetics_state(p_user uuid) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce(jsonb_agg(value),'[]'::jsonb) from jsonb_array_elements(gf_shop_catalog_state(p_user))
 where value->>'id' in('frame-ember','frame-gold','frame-champion','share-ember','share-champion','theme-copper');
$$;
-- An explicit argument selects the new catalog without ambiguous default overloads.
create function public.get_gamification_state(p_timezone text,p_shop_version integer) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare payload jsonb;
begin
 if p_shop_version is distinct from 2 then raise exception 'Atualize a versão da Loja.';end if;
 payload:=get_gamification_state(p_timezone);
 return jsonb_set(payload,'{cosmetics}',gf_shop_catalog_state(auth.uid()));
end $$;
revoke all on function public.gf_shop_catalog_state(uuid),public.get_gamification_state(text,integer) from public,anon,authenticated;
grant execute on function public.get_gamification_state(text,integer) to authenticated;
-- Retain the same authenticated, serialized equip operation; emojis select a favorite reaction.
create or replace function public.equip_cosmetic(p_category text,p_item text,p_timezone text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=social_require_profile();
begin
 perform get_training_state(p_timezone);
 perform 1 from training_accounts where user_id=u for update;
 if p_category is null or p_category not in('frame','share','theme','emoji') then raise exception 'Categoria inválida.'; end if;
 if p_item is null then delete from gf_equipped where user_id=u and category=p_category;
 else
  if not exists(select 1 from gf_inventory v join gf_items i on i.id=v.item_id where v.user_id=u and i.id=p_item and i.category=p_category)
   then raise exception 'Compre o item antes de equipá-lo.'; end if;
  insert into gf_equipped(user_id,category,item_id) values(u,p_category,p_item) on conflict(user_id,category) do update set item_id=excluded.item_id;
 end if;
 return gf_cosmetics_state(u);
end $$;
create table public.group_workout_reactions (
 group_id uuid not null references public.streak_groups(id) on delete cascade,
 workout_id uuid not null references public.workout_days(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 item_id text not null references public.gf_items(id),
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 primary key(group_id,workout_id,user_id)
);
alter table public.group_workout_reactions enable row level security;
revoke all on public.group_workout_reactions from public,anon,authenticated;
create function public.get_group_reactions(p_group uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=social_require_profile(); g streak_groups; result jsonb;
begin
 select * into g from streak_groups where id=p_group;
 if not found or g.status<>'active' or not exists(select 1 from group_members where group_id=g.id and user_id=u and status='accepted')
 then raise exception 'Este grupo não está disponível para sua conta.'; end if;
 select coalesce(jsonb_agg(to_jsonb(x)),'[]') into result from (
  select w.user_id as "target",r.item_id as "itemId",count(*)::integer as "count",bool_or(r.user_id=u) as "mine"
  from group_workout_reactions r join workout_days w on w.id=r.workout_id
  where r.group_id=g.id and (w.confirmed_at at time zone g.time_zone)::date=(now() at time zone g.time_zone)::date
  group by w.user_id,r.item_id order by w.user_id,r.item_id
 ) x;
 return result;
end $$;
create function public.set_group_reaction(p_group uuid,p_target uuid,p_item text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=social_require_profile(); g streak_groups; w uuid;
begin
 select * into g from streak_groups where id=p_group for share;
 if not found or g.status<>'active'
 or not exists(select 1 from group_members where group_id=g.id and user_id=u and status='accepted')
 or not exists(select 1 from group_members where group_id=g.id and user_id=p_target and status='accepted')
 then raise exception 'Este grupo não está disponível para sua conta.'; end if;
 select id into w from workout_days where user_id=p_target and (confirmed_at at time zone g.time_zone)::date=(now() at time zone g.time_zone)::date order by confirmed_at limit 1;
 if w is null then raise exception 'Só é possível reagir a um treino confirmado de hoje.'; end if;
 if p_item is null then delete from group_workout_reactions where group_id=g.id and workout_id=w and user_id=u;
 else
  if not exists(select 1 from gf_inventory v join gf_items i on i.id=v.item_id where v.user_id=u and i.id=p_item and i.category='emoji')
  then raise exception 'Desbloqueie este emoji na Loja primeiro.'; end if;
  insert into group_workout_reactions(group_id,workout_id,user_id,item_id) values(g.id,w,u,p_item)
   on conflict(group_id,workout_id,user_id) do update set item_id=excluded.item_id,updated_at=clock_timestamp();
 end if;
 return get_group_reactions(g.id);
end $$;
revoke all on function public.get_group_reactions(uuid),public.set_group_reaction(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.get_group_reactions(uuid),public.set_group_reaction(uuid,uuid,text) to authenticated;
notify pgrst,'reload schema';
commit;
