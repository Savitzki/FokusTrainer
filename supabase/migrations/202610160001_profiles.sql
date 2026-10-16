-- Execute uma vez no SQL Editor de um novo projeto Supabase.
begin;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null check (nickname ~ '^[[:alnum:]_.-]{3,24}$'),
  avatar_style text not null default 'initials'
    check (avatar_style in ('initials', 'flame', 'mountain', 'bolt', 'runner')),
  avatar_color text not null default 'orange'
    check (avatar_color in ('orange', 'charcoal', 'clay', 'forest', 'blue', 'wine')),
  avatar_photo text check (
    avatar_photo is null or (
      length(avatar_photo) <= 180000 and
      avatar_photo ~ '^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$'
    )
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select, insert, update on public.profiles to authenticated;

create policy "Ler o próprio perfil" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "Criar o próprio perfil" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id);
create policy "Atualizar o próprio perfil" on public.profiles
  for update to authenticated using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create function public.fokus_profile_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger fokus_profile_updated_at before update on public.profiles
for each row execute function public.fokus_profile_updated_at();

commit;
