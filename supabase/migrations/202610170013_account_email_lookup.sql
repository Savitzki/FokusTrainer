-- Read-only signup routing. No account creation, e-mail delivery or auth table grants.
begin;
create or replace function public.account_email_exists(p_email text) returns boolean
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare address text:=lower(trim(p_email));
begin
 if address is null or length(address)>254 or address !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then return false; end if;
 return exists(select 1 from auth.users u where lower(u.email)=address);
end $$;
revoke all on function public.account_email_exists(text) from public,anon,authenticated;
grant execute on function public.account_email_exists(text) to anon,authenticated;
notify pgrst, 'reload schema';
commit;
