-- Expand the original medals, without financial rewards or historical rewrites.
-- Prepare only: production activation requires explicit authorization.
begin;
set local lock_timeout='5s';set local statement_timeout='60s';
do $$ begin
 if exists(select 1 from gf_badge_catalog where key not in ('workout-1','workout-10','workout-30','workout-100','workout-365','week-1','week-4','week-10','record','friend','group','collective')) then
  raise exception 'Catálogo inesperado. Revise as conquistas existentes antes de aplicar a 032.';
 end if;
end $$;
alter table public.gf_badge_catalog drop constraint gf_badge_catalog_category_check;
alter table public.gf_badge_catalog add constraint gf_badge_catalog_category_check
 check(category in('frequency','consistency','streak','overcoming','weight','social','special'));
alter table public.gf_badge_catalog add column rarity text not null default 'common'
 check(rarity in('common','rare','epic','legendary'));
alter table public.gf_badge_catalog add column metric text;
alter table public.gf_badge_catalog add column medal_key text unique;
alter table public.gf_badge_catalog add column sort_order integer unique;
-- Reserved for a separately authorized economy policy. Nothing pays out here.
alter table public.gf_badge_catalog add column reward_amount integer not null default 0 check(reward_amount=0);
alter table public.gf_accounts add column achievement_catalog_seen_at timestamptz;
insert into public.gf_badge_catalog(key,name,description,category,icon,goal,rarity,metric,medal_key,sort_order) values
 ('workout-1','Primeira chama','Conclua seu primeiro treino obrigatório','frequency','flame',1,'common','mandatory-workouts','workout-1',1),
 ('workout-5','Olha quem apareceu','Conclua 5 treinos obrigatórios','frequency','flame',5,'common','mandatory-workouts','workout-5',2),
 ('workout-10','Pegou gosto pela coisa','Conclua 10 treinos obrigatórios','frequency','flame',10,'rare','mandatory-workouts','workout-10',3),
 ('workout-25','Já virou rotina','Conclua 25 treinos obrigatórios','frequency','flame',25,'rare','mandatory-workouts','workout-25',4),
 ('workout-30','Compromisso firmado','Conclua 30 treinos obrigatórios','frequency','flame',30,'rare','mandatory-workouts','workout-30',5),
 ('workout-50','Metade de um monstro','Conclua 50 treinos obrigatórios','frequency','flame',50,'epic','mandatory-workouts','workout-50',6),
 ('workout-100','É uma MÁAAAAQUINAAAAA','Conclua 100 treinos obrigatórios','frequency','flame',100,'legendary','mandatory-workouts','workout-100',7),
 ('workout-200','KIBISURDO 200tão é coisa vi?','Conclua 200 treinos obrigatórios','frequency','flame',200,'legendary','mandatory-workouts','workout-200',8),
 ('workout-365','UM MONSTROOOOOO','Conclua 365 treinos obrigatórios acumulados','frequency','flame',365,'legendary','mandatory-workouts','workout-365',9),
 ('week-1','Duvido que consiga','Cumpra uma semana completa do seu planejamento','consistency','calendar',1,'common','fulfilled-weeks','week-1',10),
 ('week-2','Não foi sorte','Cumpra 2 semanas completas do seu planejamento','consistency','calendar',2,'common','fulfilled-weeks','week-2',11),
 ('week-4','Quatro semanas de respeito','Cumpra 4 semanas completas do seu planejamento','consistency','calendar',4,'rare','fulfilled-weeks','week-4',12),
 ('week-8','Já é compromisso','Cumpra 8 semanas completas do seu planejamento','consistency','calendar',8,'rare','fulfilled-weeks','week-8',13),
 ('week-10','Consistência de respeito','Cumpra 10 semanas completas do seu planejamento','consistency','calendar',10,'epic','fulfilled-weeks','week-10',14),
 ('week-20','Disciplina de ferro','Cumpra 20 semanas completas do seu planejamento','consistency','calendar',20,'legendary','fulfilled-weeks','week-20',15),
 ('streak-3','Acendeu a chama','Alcance 3 pontos de ofensiva','streak','flame',3,'common','best-streak','streak-3',16),
 ('streak-7','Não apaga mais?','Alcance 7 pontos de ofensiva','streak','flame',7,'rare','best-streak','streak-7',17),
 ('streak-14','Fogo no parquinho','Alcance 14 pontos de ofensiva','streak','flame',14,'epic','best-streak','streak-14',18),
 ('streak-30','Inapagável','Alcance 30 pontos de ofensiva','streak','flame',30,'legendary','best-streak','streak-30',19),
 ('record','Meu novo máximo','Supere seu recorde de ofensiva de referência após entrar no sistema de conquistas','overcoming','trophy',1,'epic','record-improved','record',20),
 ('weight-1','Encarei a balança','Registre seu peso em 1 dia válido','weight','scale',1,'common','weight-dates','weight-1',21),
 ('weight-7','De olho na evolução','Registre seu peso em 7 datas diferentes','weight','scale',7,'rare','weight-dates','weight-7',22),
 ('weight-30','Tudo anotadinho','Registre seu peso em 30 datas diferentes','weight','scale',30,'epic','weight-dates','weight-30',23),
 ('friend','Primeira parceria','Tenha sua primeira amizade aceita','social','users',1,'common','accepted-friendships','friend',24),
 ('group','Chama em equipe','Participe de um grupo com convite aceito','social','users',1,'common','accepted-groups','group',25),
 ('collective','Vitória em equipe','Conclua seu primeiro desafio coletivo válido','social','trophy',1,'rare','collective-wins','collective',26),
 ('collective-3','Três vezes melhor','Conclua 3 desafios coletivos válidos e diferentes','social','trophy',3,'epic','collective-wins','collective-3',27),
 ('group-streak-7','Juntos na sofrência','Participe da progressão de um grupo até alcançar 7 pontos de ofensiva coletiva','special','users',7,'rare','group-streak-participation','group-streak-7',28)
on conflict(key) do update set name=excluded.name,description=excluded.description,category=excluded.category,
 icon=excluded.icon,goal=excluded.goal,rarity=excluded.rarity,metric=excluded.metric,medal_key=excluded.medal_key,sort_order=excluded.sort_order;
alter table public.gf_badge_catalog alter column metric set not null;
alter table public.gf_badge_catalog alter column medal_key set not null;
alter table public.gf_badge_catalog alter column sort_order set not null;
alter table public.gf_badge_catalog add constraint gf_badge_metric check(metric in
 ('mandatory-workouts','fulfilled-weeks','best-streak','record-improved','weight-dates','accepted-friendships','accepted-groups','collective-wins','group-streak-participation'));

-- Existing accepted membership is known only from activation onward. No invented
-- historical join dates. A new acceptance opens a new auditable participation.
create table public.gf_badge_memberships (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 group_id uuid not null references public.streak_groups(id) on delete cascade,
 accepted_at timestamptz not null default clock_timestamp(),
 left_at timestamptz,
 unique(id,user_id,group_id),check(left_at is null or left_at>=accepted_at)
);
create unique index gf_badge_membership_active on public.gf_badge_memberships(group_id,user_id) where left_at is null;
create table public.gf_badge_group_points (
 user_id uuid not null,
 group_id uuid not null,
 day date not null,
 membership_id uuid not null,
 observed_at timestamptz not null default clock_timestamp(),
 primary key(group_id,day,user_id),
 foreign key(group_id,day) references public.group_days(group_id,day) on delete cascade,
 foreign key(membership_id,user_id,group_id) references public.gf_badge_memberships(id,user_id,group_id) on delete cascade
);
create index gf_badge_points_user on public.gf_badge_group_points(user_id,group_id,day);
-- Permanent evidence survives group deletion without locking another account.
create table public.gf_badge_group_qualifications (
 user_id uuid primary key references auth.users(id) on delete cascade,
 group_id uuid not null,
 qualified_at timestamptz not null default clock_timestamp()
);
insert into public.gf_badge_memberships(user_id,group_id)
 select user_id,group_id from public.group_members where status='accepted';

create function public.gf_badge_track_membership() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if tg_op<>'INSERT' then
  if old.status='accepted' and (tg_op='DELETE' or new.status<>'accepted'
    or (new.user_id,new.group_id) is distinct from (old.user_id,old.group_id)) then
   update gf_badge_memberships set left_at=clock_timestamp()
    where user_id=old.user_id and group_id=old.group_id and left_at is null;
  end if;
 end if;
 if tg_op<>'DELETE' then
  if new.status='accepted' then
   insert into gf_badge_memberships(user_id,group_id) values(new.user_id,new.group_id)
    on conflict(group_id,user_id) where left_at is null do nothing;
  end if;
  return new;
 end if;
 return old;
end $$;
create trigger gf_badge_membership_audit after insert or update or delete on public.group_members
 for each row execute function public.gf_badge_track_membership();

-- Count witnessed scoring points in one membership and one official group run.
-- Neutral group_days bridge the run; an absent day breaks it, just as social_streak.
create function public.gf_badge_group_progress(p_user uuid) returns integer
language sql stable security definer set search_path=public,pg_temp as $$
 with days as (
  select g.group_id,g.day,g.counts_for_streak,
   g.day-(row_number() over(partition by g.group_id order by g.day))::integer island
  from group_days g where g.group_id in(select group_id from gf_badge_group_points where user_id=p_user)
 ), runs as (
  select count(*)::integer n from gf_badge_group_points p join days d using(group_id,day)
  where p.user_id=p_user and d.counts_for_streak
  group by p.group_id,p.membership_id,d.island
 ) select greatest(coalesce(max(n),0),case when exists(
  select 1 from gf_badge_group_qualifications where user_id=p_user) then 7 else 0 end) from runs;
$$;
create function public.gf_badge_track_group_point() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare tz text; deadline timestamptz; member record;
begin
 if not new.counts_for_streak or new.members_count<2 then return new;end if;
 select time_zone into strict tz from streak_groups where id=new.group_id;
 if new.day>(clock_timestamp() at time zone tz)::date then return new;end if;
 deadline:=least(clock_timestamp(),(new.day+1)::timestamp at time zone tz);
 for member in select e.id,e.user_id from gf_badge_memberships e
  join group_members m on m.group_id=e.group_id and m.user_id=e.user_id and m.status='accepted'
  where e.group_id=new.group_id and e.left_at is null and e.accepted_at<deadline order by e.user_id loop
  insert into gf_badge_group_points(user_id,group_id,day,membership_id)
   values(member.user_id,new.group_id,new.day,member.id) on conflict do nothing;
  if not exists(select 1 from gf_badge_group_qualifications where user_id=member.user_id)
   and gf_badge_group_progress(member.user_id)>=7 then
   -- Do not insert gf_accounts here: its FK could wait on another member's
   -- account while that member waits for this group's lock.
   insert into gf_badge_group_qualifications(user_id,group_id) values(member.user_id,new.group_id) on conflict do nothing;
  end if;
 end loop;
 return new;
end $$;
create trigger gf_badge_group_point_audit after insert on public.group_days
 for each row execute function public.gf_badge_track_group_point();

create or replace function public.gf_badges_state(p_user uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare total integer;weeks integer;weights integer;best integer;baseline integer;
 b gf_badge_catalog;metrics jsonb;metric_value integer;historical_value boolean;first_catalog boolean;today_value date;
begin
 -- Same account lock/revisions as the existing gamification entrypoint.
 select (now() at time zone time_zone)::date into strict today_value from training_accounts where user_id=p_user for update;
 insert into gf_accounts(user_id) values(p_user) on conflict do nothing;
 select record_baseline,achievement_catalog_seen_at is null into baseline,first_catalog from gf_accounts where user_id=p_user for update;
 perform gf_sync_weeks(p_user);
 select count(*) into total from workout_days w cross join lateral gf_day(p_user,w.day) d
  where w.user_id=p_user and w.day<=today_value and d.completed and d.kind in('training','compensatory');
 -- Never change old weekly snapshots. For new medal recognition, a kit without
 -- a confirmed workout is not proof of a fully completed plan, even if an old
 -- fulfilled snapshot excluded the protected obligation from its denominator.
 select count(*) into weeks from gf_weeks w where w.user_id=p_user and w.fulfilled
  and not exists(select 1 from gf_days d where d.user_id=p_user and d.day between w.week_start and w.week_start+6
   and d.kind='medical-kit' and not d.completed);
 select count(*) into weights from (
  select day from weight_entries where user_id=p_user and day<=today_value and confirmed_at<=clock_timestamp() and kg between 20 and 500
  union select day from weight_logs where user_id=p_user and day<=today_value and kg between 20 and 500
 ) distinct_dates;
 best:=(gf_streak(p_user)->>'best')::integer;
 historical_value:=baseline is null or first_catalog;
 if baseline is null then update gf_accounts set record_baseline=best where user_id=p_user;end if;
 update gf_accounts set achievement_catalog_seen_at=clock_timestamp() where user_id=p_user and achievement_catalog_seen_at is null;
 metrics:=jsonb_build_object('mandatory-workouts',total,'fulfilled-weeks',weeks,'best-streak',best,'weight-dates',weights,
  'record-improved',case when baseline is not null and best>baseline then 1 else 0 end,
  'accepted-friendships',(select count(*) from friendships where status='accepted' and p_user in(requester,recipient)),
  'accepted-groups',(select count(*) from group_members where user_id=p_user and status='accepted'),
  'collective-wins',gf_collective_wins(p_user),'group-streak-participation',gf_badge_group_progress(p_user));
 for b in select * from gf_badge_catalog order by sort_order loop
  metric_value:=(metrics->>b.metric)::integer;
  if metric_value>=b.goal then
   insert into gf_badges(user_id,key,historical,earned_at) values(p_user,b.key,
    case when b.key='group-streak-7' then false else historical_value end,
    case when b.key='group-streak-7' then coalesce((select qualified_at from gf_badge_group_qualifications where user_id=p_user),clock_timestamp())
     else clock_timestamp() end) on conflict do nothing;
  end if;
 end loop;
 return jsonb_build_object('catalogVersion',2,'featured',(select featured from gf_accounts where user_id=p_user),
  'visible',(select show_badges from gf_accounts where user_id=p_user),
  'badges',(select jsonb_agg(jsonb_build_object('key',c.key,'name',c.name,'description',c.description,'category',c.category,
   'icon',c.icon,'goal',c.goal,'rarity',c.rarity,'medalKey',c.medal_key,'metric',c.metric,
   'progress',case when c.metric='record-improved' then null else least(c.goal,(metrics->>c.metric)::integer) end,
   'reward',c.reward_amount,'earnedAt',earned.earned_at,'historical',earned.historical) order by c.sort_order)
   from gf_badge_catalog c left join gf_badges earned on earned.key=c.key and earned.user_id=p_user));
end $$;

-- Same friendship/privacy gate; add only public medal metadata, never progress,
-- weights or the underlying facts used for private achievement calculations.
create or replace function public.get_friend_showcase(p_user uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=social_require_profile();result jsonb;
begin
 if p_user is distinct from u and not exists(select 1 from friendships where status='accepted' and
  ((requester=u and recipient=p_user) or (recipient=u and requester=p_user))) then
  raise exception 'Este perfil está disponível apenas para amigos.';
 end if;
 select jsonb_build_object('nickname',p.nickname,'badges',coalesce((select jsonb_agg(jsonb_build_object(
  'key',c.key,'name',c.name,'icon',c.icon,'rarity',c.rarity,'medalKey',c.medal_key,'earnedAt',b.earned_at) order by array_position(a.featured,b.key))
  from gf_badges b join gf_badge_catalog c using(key) join gf_accounts a on a.user_id=b.user_id
  where b.user_id=p_user and b.key=any(a.featured) and (a.show_badges or p_user=u)),'[]')) into result
  from profiles p where p.id=p_user;
 return result;
end $$;

alter table public.gf_badge_memberships enable row level security;
alter table public.gf_badge_group_points enable row level security;
alter table public.gf_badge_group_qualifications enable row level security;
revoke all on public.gf_badge_memberships,public.gf_badge_group_points,public.gf_badge_group_qualifications from public,anon,authenticated;
revoke all on function public.gf_badge_track_membership(),public.gf_badge_group_progress(uuid),public.gf_badge_track_group_point(),public.gf_badges_state(uuid) from public,anon,authenticated;
-- Existing authenticated showcase/featured RPC permissions remain unchanged.
do $$ begin
 if (select count(*) from gf_badge_catalog)<>28 then raise exception 'O catálogo deve conter exatamente 28 conquistas.';end if;
end $$;
notify pgrst,'reload schema';
commit;
