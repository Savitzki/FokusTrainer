begin;
do $$ begin
  if has_function_privilege('anon','public.account_email_exists(text)','execute') or
     has_function_privilege('authenticated','public.account_email_exists(text)','execute') then
    raise exception 'Email enumeration RPC is still public';
  end if;
  if has_function_privilege('anon','public.claim_nickname_login_budget(text)','execute') or
     has_function_privilege('authenticated','public.claim_nickname_login_budget(text)','execute') or
     not has_function_privilege('service_role','public.claim_nickname_login_budget(text)','execute') then
    raise exception 'Login protection privilege boundary failed';
  end if;
end $$;
set local role service_role;
do $$ declare i integer; begin
  if claim_nickname_login_budget(null) or claim_nickname_login_budget('raw-ip-or-client-value') then
    raise exception 'Invalid source accepted';
  end if;
  for i in 1..60 loop
    if not claim_nickname_login_budget(repeat('a',64)) then raise exception 'Eligible request denied'; end if;
  end loop;
  if claim_nickname_login_budget(repeat('a',64)) then raise exception 'Origin ceiling bypassed'; end if;
  if not claim_nickname_login_budget(repeat('b',64)) then raise exception 'Independent origin blocked'; end if;
end $$;
reset role;
update nickname_request_limits set window_started_at=date_trunc('minute',clock_timestamp())-interval '1 minute';
set local role service_role;
select claim_nickname_login_budget(repeat('a',64));
reset role;
do $$ begin
  if (select attempts from nickname_request_limits where scope='source:'||repeat('a',64))<>1 then
    raise exception 'Minute rollover did not reset counter';
  end if;
end $$;
update nickname_request_limits set attempts=300 where scope='global';
set local role service_role;
do $$ begin
  if claim_nickname_login_budget(repeat('c',64)) then raise exception 'Global ceiling bypassed'; end if;
end $$;
reset role;
select 'PASS Auth hardening: no email enumeration, service-only budget, independent origins, global ceiling, rollover';
rollback;
