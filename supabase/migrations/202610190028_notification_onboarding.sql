-- One notification decision per account and browser installation. No new events,
-- schedules or rewards. Existing push devices/preferences remain intact.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
create table public.notification_consents (
 user_id uuid not null references public.profiles(id) on delete cascade,
 installation_id uuid not null,
 decision text not null check(decision in('accepted','declined')),
 updated_at timestamptz not null default now(),
 primary key(user_id,installation_id)
);
alter table public.notification_consents enable row level security;
revoke all on public.notification_consents from public,anon,authenticated;

create function public.get_notification_consent(p_installation_id uuid,p_endpoint text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=social_require_profile();answer text;registered boolean;
begin
 if p_installation_id is null then raise exception 'Identificação do aparelho inválida.';end if;
 select decision into answer from notification_consents where user_id=u and installation_id=p_installation_id;
 select exists(select 1 from push_devices where user_id=u and endpoint=p_endpoint and enabled) into registered;
 return jsonb_build_object('decision',coalesce(answer,case when registered then 'accepted' else 'pending' end),'registered',registered);
end $$;

create function public.enable_push_notifications(p_installation_id uuid,p_endpoint text,p_p256dh text,p_auth text,p_vapid_key text,p_timezone text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=social_require_profile();h integer:=18;t text:='dramatic';
begin
 if p_installation_id is null then raise exception 'Identificação do aparelho inválida.';end if;
 perform 1 from profiles where id=u for update;
 -- Preserve the current device's schedule/tone, or the account's most recently
 -- chosen preferences when re-enrolling after logout or on a new device.
 select reminder_hour,tone into h,t from push_devices where user_id=u
 order by (endpoint=p_endpoint) desc,updated_at desc,id limit 1;
 perform save_push_device(p_endpoint,p_p256dh,p_auth,p_vapid_key,p_timezone,coalesce(h,18),coalesce(t,'dramatic'));
 insert into notification_consents(user_id,installation_id,decision) values(u,p_installation_id,'accepted')
 on conflict(user_id,installation_id) do update set decision='accepted',updated_at=now();
 return jsonb_build_object('decision','accepted','registered',true);
end $$;

create function public.decline_push_notifications(p_installation_id uuid,p_endpoint text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=social_require_profile();
begin
 if p_installation_id is null then raise exception 'Identificação do aparelho inválida.';end if;
 perform 1 from profiles where id=u for update;
 update push_devices set enabled=false,updated_at=now() where user_id=u and endpoint=p_endpoint;
 insert into notification_consents(user_id,installation_id,decision) values(u,p_installation_id,'declined')
 on conflict(user_id,installation_id) do update set decision='declined',updated_at=now();
 return jsonb_build_object('decision','declined','registered',false);
end $$;
revoke all on function public.get_notification_consent(uuid,text),public.enable_push_notifications(uuid,text,text,text,text,text),public.decline_push_notifications(uuid,text) from public,anon,authenticated;
grant execute on function public.get_notification_consent(uuid,text),public.enable_push_notifications(uuid,text,text,text,text,text),public.decline_push_notifications(uuid,text) to authenticated;
notify pgrst,'reload schema';
commit;
