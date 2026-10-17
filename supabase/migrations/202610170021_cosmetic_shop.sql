-- Stage 5. Permanent virtual items, server prices, no real-money operations.
begin;
create table public.gf_items (
 id text primary key, name text not null, category text not null check(category in('frame','share','theme')),
 price integer not null check(price between 1 and 10000), rarity text not null check(rarity in('common','rare','achievement')),
 badge_key text references public.gf_badge_catalog(key), enabled boolean not null default true
);
insert into public.gf_items(id,name,category,price,rarity,badge_key) values
 ('frame-ember','Chama viva','frame',100,'common',null),
 ('frame-gold','Foco dourado','frame',250,'rare',null),
 ('frame-champion','Consistência em destaque','frame',250,'achievement','week-4'),
 ('share-ember','Brasa','share',150,'common',null),
 ('share-champion','Minha conquista','share',150,'achievement','workout-30'),
 ('theme-copper','Cobre','theme',300,'rare',null);
create table public.gf_inventory (
 user_id uuid not null references public.training_accounts(user_id) on delete cascade,
 item_id text not null references public.gf_items(id), acquired_at timestamptz not null default clock_timestamp(),
 movement_id bigint not null unique references public.coin_movements(id), primary key(user_id,item_id)
);
create table public.gf_equipped (
 user_id uuid not null, category text not null check(category in('frame','share','theme')),
 item_id text not null, primary key(user_id,category),
 foreign key(user_id,item_id) references public.gf_inventory(user_id,item_id) on delete cascade
);
create function public.gf_cosmetics_state(p_user uuid) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'name',i.name,'category',i.category,'price',i.price,'rarity',i.rarity,'badgeKey',i.badge_key,
 'owned',v.item_id is not null,'equipped',coalesce(e.item_id=i.id,false),'locked',i.badge_key is not null and not exists(select 1 from gf_badges where user_id=p_user and key=i.badge_key)) order by i.category,i.price,i.id),'[]')
 from gf_items i left join gf_inventory v on v.item_id=i.id and v.user_id=p_user
 left join gf_equipped e on e.user_id=p_user and e.category=i.category where i.enabled or v.item_id is not null;
$$;
create function public.buy_cosmetic(p_item text,p_timezone text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=social_require_profile(); item gf_items; d date; movement bigint;
begin
 perform get_training_state(p_timezone);
 select (now() at time zone time_zone)::date into d from training_accounts where user_id=u for update;
 if exists(select 1 from gf_inventory where user_id=u and item_id=p_item) then return gf_cosmetics_state(u); end if;
 select * into item from gf_items where id=p_item and enabled;
 if not found then raise exception 'Este item não está disponível.'; end if;
 if item.badge_key is not null and not exists(select 1 from gf_badges where user_id=u and key=item.badge_key) then raise exception 'Conquiste a medalha necessária antes de comprar este item.'; end if;
 movement:=economy_post(u,'cosmetic:'||item.id,'cosmetic-purchase','Personalização: '||item.name,-item.price,d);
 insert into gf_inventory(user_id,item_id,movement_id) values(u,item.id,movement);
 return gf_cosmetics_state(u);
end $$;
create function public.equip_cosmetic(p_category text,p_item text,p_timezone text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=social_require_profile();
begin
 perform get_training_state(p_timezone);
 perform 1 from training_accounts where user_id=u for update;
 if p_category is null or p_category not in('frame','share','theme') then raise exception 'Categoria inválida.'; end if;
 if p_item is null then delete from gf_equipped where user_id=u and category=p_category;
 else
  if not exists(select 1 from gf_inventory v join gf_items i on i.id=v.item_id where v.user_id=u and i.id=p_item and i.category=p_category)
   then raise exception 'Compre o item antes de equipá-lo.'; end if;
  insert into gf_equipped(user_id,category,item_id) values(u,p_category,p_item) on conflict(user_id,category) do update set item_id=excluded.item_id;
 end if;
 return gf_cosmetics_state(u);
end $$;
do $$ declare t text; f regprocedure; begin
 foreach t in array array['gf_items','gf_inventory','gf_equipped'] loop
  execute format('alter table public.%I enable row level security',t); execute format('revoke all on public.%I from public,anon,authenticated',t);
 end loop;
 for f in select oid::regprocedure from pg_proc where pronamespace='public'::regnamespace and left(proname,3)='gf_' loop execute format('revoke all on function %s from public,anon,authenticated',f); end loop;
end $$;
revoke all on function public.buy_cosmetic(text,text),public.equip_cosmetic(text,text,text) from public,anon,authenticated;
grant execute on function public.buy_cosmetic(text,text),public.equip_cosmetic(text,text,text) to authenticated;
notify pgrst,'reload schema';
commit;
