-- Global inbox invalidation, no private message payloads over Realtime.
-- Existing taunt catalog, rate limits, receipts and notification opt-ins are unchanged.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

create table public.arena_inbox_signals (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 revision bigint not null default 1
);
alter table public.arena_inbox_signals enable row level security;
revoke all on public.arena_inbox_signals from public,anon,authenticated;
grant select on public.arena_inbox_signals to authenticated;
create policy arena_inbox_signal_owner on public.arena_inbox_signals for select to authenticated
 using(user_id=(select auth.uid()));

create function public.arena_signal_inbox() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare recipients uuid[]; account_id uuid;
begin
 if TG_TABLE_NAME='arena_taunts' then
  recipients:=array[NEW.recipient];
 elsif TG_TABLE_NAME='arena_social_preferences' then
  recipients:=array[NEW.user_id];
 else
  recipients:=case when TG_OP='DELETE' then array[OLD.requester,OLD.recipient] else array[NEW.requester,NEW.recipient] end;
 end if;
 foreach account_id in array recipients loop
  insert into arena_inbox_signals(user_id) select account_id where exists(select 1 from profiles where id=account_id)
  on conflict(user_id) do update set revision=arena_inbox_signals.revision+1;
 end loop;
 return null;
end $$;
revoke all on function public.arena_signal_inbox() from public,anon,authenticated;
create trigger arena_taunt_signal after insert or update on public.arena_taunts for each row execute function public.arena_signal_inbox();
create trigger arena_preferences_signal after insert or update on public.arena_social_preferences for each row execute function public.arena_signal_inbox();
create trigger arena_friendship_signal after insert or update or delete on public.friendships for each row execute function public.arena_signal_inbox();
-- Supabase owns this publication. Disposable PostgreSQL without Realtime need not create one.
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime')
  and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='arena_inbox_signals') then
  alter publication supabase_realtime add table public.arena_inbox_signals;
 end if;
end $$;

-- Reuse the dispatcher and at-most-once jobs for both originals and replies.
-- Keep service enablement, opt-in, quiet hours and the one-hour frequency cap.
create or replace function public.arena_taunt_push_allowed(p_id uuid,p_lease uuid) returns boolean
language sql security definer set search_path=public,pg_temp as $$
 select exists(select 1 from arena_taunt_push_jobs j join arena_taunts t on t.id=j.taunt_id join push_devices d on d.id=j.device_id and d.user_id=t.recipient and d.enabled
 join arena_social_preferences p on p.user_id=t.recipient and not p.muted and p.push_taunts cross join arena_delivery_rules r
 where j.id=p_id and j.lease=p_lease and j.state='sending' and r.taunt_push_enabled and arena_taunt_open(t.id)
 and t.created_at>clock_timestamp()-interval '15 minutes' and (clock_timestamp() at time zone d.time_zone)::time between time '08:00' and time '21:59:59'
 and exists(select 1 from friendships where status='accepted' and least(requester,recipient)=least(t.sender,t.recipient) and greatest(requester,recipient)=greatest(t.sender,t.recipient)));
$$;
create or replace function public.claim_arena_taunt_push() returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare job_ids uuid[];
begin
 perform pg_advisory_xact_lock(607173021);
 if not (select taunt_push_enabled from arena_delivery_rules) then return '[]';end if;
 with inserted as(insert into arena_taunt_push_jobs(taunt_id,device_id)
 select distinct on(d.id) t.id,d.id from arena_taunts t join push_devices d on d.user_id=t.recipient and d.enabled
 join arena_social_preferences p on p.user_id=t.recipient and p.push_taunts and not p.muted
 where t.created_at>clock_timestamp()-interval '15 minutes' and arena_taunt_open(t.id)
 and (clock_timestamp() at time zone d.time_zone)::time between time '08:00' and time '21:59:59'
 and exists(select 1 from friendships where status='accepted' and least(requester,recipient)=least(t.sender,t.recipient) and greatest(requester,recipient)=greatest(t.sender,t.recipient))
 and not exists(select 1 from arena_taunt_push_jobs where taunt_id=t.id and device_id=d.id)
 and not exists(select 1 from arena_taunt_push_jobs where device_id=d.id and created_at>clock_timestamp()-interval '1 hour')
 order by d.id,t.created_at desc,t.id limit 24 on conflict do nothing returning id) select array_agg(id) into job_ids from inserted;
 return coalesce((select jsonb_agg(jsonb_build_object('job_id',j.id,'lease_id',j.lease,'endpoint',d.endpoint,'p256dh',d.p256dh,'auth',d.auth,'vapid_key',d.vapid_key,
  'title','Capibora','body','Psiu, alguém mandou uma provocação','tag','capibora-taunt-'||t.id)) from arena_taunt_push_jobs j join arena_taunts t on t.id=j.taunt_id
  join profiles p on p.id=t.sender join arena_taunt_catalog c on c.id=t.message_id join push_devices d on d.id=j.device_id
  where j.state='sending' and j.id=any(job_ids) and arena_taunt_push_allowed(j.id,j.lease)),'[]');
end $$;
-- No preferences/flags, schedules, VAPID credentials or deliveries are activated here.
notify pgrst,'reload schema';
commit;
