-- Independent of migration 012. Review/authorize before production application.
begin;
set local lock_timeout='5s';
set local statement_timeout='45s';
-- Preserve every existing nickname. Abort atomically rather than rename a user.
do $$ begin
 if exists(select 1 from public.profiles group by lower(normalize(nickname,NFKC)) having count(*)>1)
 then raise exception 'Existem nicks repetidos. Resolva os conflitos com os titulares antes de aplicar esta migração.'; end if;
end $$;
create unique index if not exists profiles_unique_nickname on public.profiles(lower(normalize(nickname,NFKC)));
create or replace function public.fokus_profile_identity() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if tg_op='UPDATE' then
  if new.id is distinct from old.id or new.nickname is distinct from old.nickname then
   raise exception 'Seu nick é permanente e não pode ser alterado.';
  end if;
 elsif not exists(select 1 from profiles where id=new.id) then
  -- Upsert also runs BEFORE INSERT. Preserve the exact spelling of legacy
  -- handles on avatar edits; the unique index still compares normalized keys.
  new.nickname:=regexp_replace(btrim(normalize(new.nickname,NFKC)),'^@','');
 end if;
 return new;
end $$;
drop trigger if exists fokus_profile_identity on public.profiles;
create trigger fokus_profile_identity before insert or update on public.profiles
for each row execute function public.fokus_profile_identity();
revoke all on function public.fokus_profile_identity() from public,anon,authenticated;

create or replace function public.check_nickname(p_nickname text) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); n text:=regexp_replace(btrim(normalize(p_nickname,NFKC)),'^@',''); available boolean; suggestions jsonb:='[]';
begin
 if u is null then raise exception 'Entre na conta para escolher seu nick.'; end if;
 if n is null or n !~ '^[[:alnum:]_.-]{3,24}$' then
  return jsonb_build_object('valid',false,'available',false,'suggestions','[]'::jsonb);
 end if;
 available:=not exists(select 1 from profiles where lower(normalize(nickname,NFKC))=lower(n) and id<>u);
 if not available then
  select coalesce(jsonb_agg(candidate),'[]') into suggestions from (
   select left(n,24-length('_'||i))||'_'||i candidate from generate_series(1,1000) i
   where not exists(select 1 from profiles p where lower(normalize(p.nickname,NFKC))=lower(left(n,24-length('_'||i))||'_'||i))
   order by i limit 3
  ) options;
 end if;
 return jsonb_build_object('valid',true,'available',available,'suggestions',suggestions);
end $$;
revoke all on function public.check_nickname(text) from public,anon,authenticated;
grant execute on function public.check_nickname(text) to authenticated;

-- Shared across Edge instances; clients cannot read/modify counters or resolve emails.
create table if not exists public.nickname_login_attempts (
 identifier_hash text primary key,
 window_started_at timestamptz not null,
 attempts integer not null check(attempts>0)
);
alter table public.nickname_login_attempts enable row level security;
revoke all on public.nickname_login_attempts from public,anon,authenticated;
create index if not exists nickname_login_attempts_cleanup on public.nickname_login_attempts(window_started_at);
create or replace function public.begin_nickname_login(p_nickname text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare n text:=regexp_replace(btrim(normalize(p_nickname,NFKC)),'^@',''); count_value integer; email_value text; stamp timestamptz:=clock_timestamp();
begin
 if n is null or n !~ '^[[:alnum:]_.-]{3,24}$' then return jsonb_build_object('allowed',false,'email',null); end if;
 delete from nickname_login_attempts where identifier_hash in(
  select identifier_hash from nickname_login_attempts where window_started_at<stamp-interval '1 day' limit 100);
 insert into nickname_login_attempts values(md5(lower(n)),stamp,1)
 on conflict(identifier_hash) do update set
  attempts=case when nickname_login_attempts.window_started_at<=stamp-interval '15 minutes' then 1 else least(nickname_login_attempts.attempts+1,1000000) end,
  window_started_at=case when nickname_login_attempts.window_started_at<=stamp-interval '15 minutes' then stamp else nickname_login_attempts.window_started_at end
 returning attempts into count_value;
 if count_value>10 then return jsonb_build_object('allowed',false,'email',null); end if;
 select a.email into email_value from profiles p join auth.users a on a.id=p.id
  where lower(normalize(p.nickname,NFKC))=lower(n);
 return jsonb_build_object('allowed',true,'email',email_value);
end $$;
revoke all on function public.begin_nickname_login(text) from public,anon,authenticated;
grant execute on function public.begin_nickname_login(text) to service_role;
notify pgrst,'reload schema';
commit;
