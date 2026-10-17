-- Stage 2. Permanent medals; recognition never grants retroactive coins.
begin;
create table public.gf_weeks (
 user_id uuid not null references public.gf_accounts(user_id) on delete cascade,
 week_start date not null, planned integer not null, completed integer not null, missed integer not null,
 fulfilled boolean not null, primary key(user_id,week_start)
);
create table public.gf_badge_catalog (
 key text primary key, name text not null, description text not null,
 category text not null check(category in('frequency','consistency','social')),
 icon text not null, goal integer not null check(goal>0)
);
insert into public.gf_badge_catalog values
 ('workout-1','Primeira chama','Conclua seu primeiro treino obrigatório','frequency','flame',1),
 ('workout-10','Pegou ritmo','Conclua 10 treinos obrigatórios','frequency','flame',10),
 ('workout-30','Compromisso','Conclua 30 treinos obrigatórios','frequency','flame',30),
 ('workout-100','Centenário','Conclua 100 treinos obrigatórios','frequency','flame',100),
 ('workout-365','Ano de atitude','Conclua 365 treinos obrigatórios','frequency','flame',365),
 ('week-1','Semana cumprida','Cumpra uma semana completa de planejamento','consistency','calendar',1),
 ('week-4','Quatro semanas','Cumpra quatro semanas de planejamento','consistency','calendar',4),
 ('week-10','Consistência de respeito','Cumpra dez semanas de planejamento','consistency','calendar',10),
 ('record','Meu novo máximo','Supere seu melhor recorde após entrar nas conquistas','consistency','trophy',1),
 ('friend','Primeira parceria','Tenha uma amizade aceita','social','users',1),
 ('group','Chama em equipe','Participe de um grupo aceito','social','users',1),
 ('collective','Vitória em equipe','Conclua um desafio coletivo','social','trophy',1);
create table public.gf_badges (
 user_id uuid not null references public.gf_accounts(user_id) on delete cascade,
 key text not null references public.gf_badge_catalog(key),
 earned_at timestamptz not null default clock_timestamp(), historical boolean not null,
 primary key(user_id,key)
);
alter table public.gf_accounts add column featured text[] not null default '{}';
alter table public.gf_accounts add column show_badges boolean not null default false;
alter table public.gf_accounts add column record_baseline integer;
create function public.gf_tracking_start(p_user uuid) returns date
language sql stable security definer set search_path=public,pg_temp as $$
 select least(a.started_on,coalesce((select min(day) from workout_days where user_id=p_user),a.started_on)) from training_accounts a where user_id=p_user;
$$;
create function public.gf_sync_weeks(p_user uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare d date; first_day date; w date; total integer; done integer; missed integer;
begin
 select (now() at time zone time_zone)::date into strict d from training_accounts where user_id=p_user;
 first_day:=gf_tracking_start(p_user);
 for w in select x::date from generate_series(date_trunc('week',first_day)::date::timestamp,
  (date_trunc('week',d)::date-7)::timestamp,interval '1 week') x
  where not exists(select 1 from gf_weeks s where s.user_id=p_user and s.week_start=x::date) loop
  select count(*) filter(where kind in('training','compensatory')),
   count(*) filter(where kind in('training','compensatory') and completed),
   count(*) filter(where kind in('training','compensatory') and not completed)
   into total,done,missed from gf_days_between(p_user,greatest(w,first_day),w+6);
  insert into gf_weeks values(p_user,w,total,done,missed,first_day<=w and total>0 and missed=0) on conflict do nothing;
 end loop;
end $$;
create function public.gf_streak(p_user uuid) returns jsonb
language sql security definer set search_path=public,pg_temp as $$
 with days as (select x.*, (now() at time zone a.time_zone)::date today from training_accounts a
  cross join lateral gf_days_between(p_user,gf_tracking_start(p_user),(now() at time zone a.time_zone)::date) x where a.user_id=p_user),
 numbered as (select *,sum(case when kind in('training','compensatory') and not completed and day<today then 1 else 0 end) over(order by day) island from days),
 runs as (select island,count(*) filter(where kind in('training','compensatory') and completed)::integer n from numbered group by island)
 select jsonb_build_object('current',coalesce((select n from runs order by island desc limit 1),0),'best',coalesce((select max(n) from runs),0));
$$;
create function public.gf_badges_state(p_user uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare total integer; weeks integer; b gf_badge_catalog; metric integer; baseline integer; best integer; historical_value boolean; collective integer:=0;
begin
 perform gf_sync_weeks(p_user);
 select count(*) into total from workout_days w where w.user_id=p_user and w.day<=
  (select (now() at time zone time_zone)::date from training_accounts where user_id=p_user)
  and (select kind from gf_day(p_user,w.day)) in('training','compensatory');
 select count(*) into weeks from gf_weeks where user_id=p_user and fulfilled;
 best:=(gf_streak(p_user)->>'best')::integer;
 select record_baseline into baseline from gf_accounts where user_id=p_user;
 historical_value:=baseline is null;
 if historical_value then update gf_accounts set record_baseline=best where user_id=p_user; end if;
 if to_regprocedure('public.gf_collective_wins(uuid)') is not null then execute 'select public.gf_collective_wins($1)' into collective using p_user; end if;
 for b in select * from gf_badge_catalog loop
  metric:=case when b.category='frequency' then total when b.key like 'week-%' then weeks
   when b.key='record' then case when baseline is not null and best>baseline then 1 else 0 end
   when b.key='friend' then (select count(*) from friendships where status='accepted' and p_user in(requester,recipient))
   when b.key='group' then (select count(*) from group_members where user_id=p_user and status='accepted')
   when b.key='collective' then collective else 0 end;
  if metric>=b.goal then insert into gf_badges(user_id,key,historical) values(p_user,b.key,historical_value) on conflict do nothing; end if;
 end loop;
 return jsonb_build_object('featured',(select featured from gf_accounts where user_id=p_user),
 'visible',(select show_badges from gf_accounts where user_id=p_user),
 'badges',(select jsonb_agg(jsonb_build_object('key',c.key,'name',c.name,'description',c.description,'category',c.category,'icon',c.icon,'goal',c.goal,'earnedAt',earned.earned_at,'historical',earned.historical) order by c.category,c.goal,c.key)
 from gf_badge_catalog c left join gf_badges earned on earned.key=c.key and earned.user_id=p_user));
end $$;
create function public.set_featured_medals(p_keys text[],p_visible boolean) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=social_require_profile();
begin
 perform 1 from training_accounts where user_id=u for update;
 if p_keys is null or p_visible is null or cardinality(p_keys)>3 or cardinality(p_keys)<>(select count(distinct x) from unnest(p_keys) x)
  or exists(select 1 from unnest(p_keys) x where not exists(select 1 from gf_badges where user_id=u and key=x)) then raise exception 'Escolha até três medalhas já conquistadas.'; end if;
 update gf_accounts set featured=p_keys,show_badges=p_visible where user_id=u;
end $$;
create function public.get_friend_showcase(p_user uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=social_require_profile(); result jsonb;
begin
 if p_user is distinct from u and not exists(select 1 from friendships where status='accepted' and
  ((requester=u and recipient=p_user) or (recipient=u and requester=p_user))) then raise exception 'Este perfil está disponível apenas para amigos.'; end if;
 select jsonb_build_object('nickname',p.nickname,'badges',coalesce((select jsonb_agg(jsonb_build_object('name',c.name,'icon',c.icon,'earnedAt',b.earned_at))
  from gf_badges b join gf_badge_catalog c using(key) join gf_accounts a on a.user_id=b.user_id
  where b.user_id=p_user and b.key=any(a.featured) and (a.show_badges or p_user=u)),'[]')) into result from profiles p where p.id=p_user;
 return result;
end $$;
do $$ declare t text; f regprocedure; begin
 foreach t in array array['gf_weeks','gf_badge_catalog','gf_badges'] loop
  execute format('alter table public.%I enable row level security',t); execute format('revoke all on public.%I from public,anon,authenticated',t);
 end loop;
 for f in select oid::regprocedure from pg_proc where pronamespace='public'::regnamespace and left(proname,3)='gf_' loop execute format('revoke all on function %s from public,anon,authenticated',f); end loop;
end $$;
revoke all on function public.set_featured_medals(text[],boolean),public.get_friend_showcase(uuid) from public,anon,authenticated;
grant execute on function public.set_featured_medals(text[],boolean),public.get_friend_showcase(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
