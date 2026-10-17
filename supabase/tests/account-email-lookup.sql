begin;
insert into auth.users(id,email) values('13131313-1313-4313-8313-000000000001','someone@example.invalid');
set local role anon;
do $$ begin
 if not public.account_email_exists('  SOMEONE@EXAMPLE.INVALID ') then raise exception 'Existing email not found'; end if;
 if public.account_email_exists('new@example.invalid') or public.account_email_exists('bad input') or public.account_email_exists(null) then raise exception 'Invalid email matched'; end if;
 begin perform * from auth.users; raise exception 'Auth table exposed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
 if (select count(*) from auth.users where email='someone@example.invalid')<>1 then raise exception 'Lookup mutated users'; end if;
end $$;
rollback;
select 'PASS: case-insensitive email routing, unknown/invalid input, no direct auth table access' as result;
