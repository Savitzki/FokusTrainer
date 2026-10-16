\set ON_ERROR_STOP on
insert into auth.users (id) values
  ('11111111-1111-4111-8111-111111111111'),
  ('22222222-2222-4222-8222-222222222222');
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
insert into public.profiles (id, nickname) values (auth.uid(), 'dani.treina');
do $$ begin
  if (select count(*) from public.profiles) <> 1 then raise exception 'Owner cannot read own profile'; end if;
end $$;

set request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
do $$ declare changed integer; begin
  if (select count(*) from public.profiles) <> 0 then raise exception 'Cross-user profile read leaked'; end if;
  update public.profiles set nickname = 'changed' where id = '11111111-1111-4111-8111-111111111111';
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'Cross-user update succeeded'; end if;
  begin
    insert into public.profiles (id, nickname) values ('11111111-1111-4111-8111-111111111111', 'forged');
    raise exception 'Cross-user insert succeeded';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.profiles (id, nickname, avatar_style) values (auth.uid(), 'valid.nick', 'invalid');
    raise exception 'Invalid avatar accepted';
  exception when check_violation then null; end;
  begin
    insert into public.profiles (id, nickname, avatar_photo) values (auth.uid(), 'valid.nick', 'data:image/svg+xml;base64,PHN2Zz4=');
    raise exception 'SVG photo accepted';
  exception when check_violation then null; end;
end $$;

insert into public.profiles (id, nickname, updated_at) values (auth.uid(), 'júlia', '2000-01-01');
update public.profiles set avatar_color = 'forest' where id = auth.uid();
do $$ begin
  if (select updated_at <= '2000-01-01' from public.profiles where id = auth.uid()) then raise exception 'Update timestamp trigger failed'; end if;
end $$;
reset role;
set role anon;
do $$ begin
  begin
    perform * from public.profiles;
    raise exception 'Anonymous profile read succeeded';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
  if (select nickname from public.profiles where id = '11111111-1111-4111-8111-111111111111') <> 'dani.treina' then raise exception 'Profile unexpectedly changed'; end if;
end $$;
select 'PASS: owner create/read/update, isolation between accounts, blocked anonymous reads, constraints, updated_at' as result;
