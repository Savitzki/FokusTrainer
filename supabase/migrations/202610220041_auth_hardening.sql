-- Authentication hardening only. No user/history/economy data is rewritten.
begin;

-- Kept for private compatibility/audit; never expose auth.users existence to clients.
revoke all on function public.account_email_exists(text) from public,anon,authenticated;

create table public.nickname_request_limits (
  scope text primary key check (scope='global' or scope ~ '^source:[a-f0-9]{64}$'),
  window_started_at timestamptz not null,
  attempts integer not null check(attempts between 1 and 300)
);
alter table public.nickname_request_limits enable row level security;
revoke all on public.nickname_request_limits from public,anon,authenticated;
create index nickname_request_limits_cleanup on public.nickname_request_limits(window_started_at);

create function public.claim_nickname_login_budget(p_source text) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
declare stamp timestamptz:=date_trunc('minute',clock_timestamp());
  bucket text; ceiling integer; accepted text;
begin
  if p_source is null or p_source !~ '^[a-f0-9]{64}$' then return false; end if;
  -- A fixed global ceiling also bounds forged/rotated source headers and storage.
  -- Row locks are always taken global first, then source, avoiding lock inversion.
  foreach bucket in array array['global','source:'||p_source] loop
    ceiling:=case when bucket='global' then 300 else 60 end;
    accepted:=null;
    insert into nickname_request_limits(scope,window_started_at,attempts)
      values(bucket,stamp,1)
    on conflict(scope) do update set
      window_started_at=excluded.window_started_at,
      attempts=case when nickname_request_limits.window_started_at<stamp
        then 1 else nickname_request_limits.attempts+1 end
    where nickname_request_limits.window_started_at<stamp or nickname_request_limits.attempts<ceiling
    returning scope into accepted;
    if accepted is null then return false; end if;
  end loop;
  delete from nickname_request_limits where scope in (
    select scope from nickname_request_limits
    where window_started_at<stamp-interval '1 hour' limit 100
  );
  return true;
end $$;
revoke all on function public.claim_nickname_login_budget(text) from public,anon,authenticated;
grant execute on function public.claim_nickname_login_budget(text) to service_role;
notify pgrst,'reload schema';
commit;
