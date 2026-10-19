\set ON_ERROR_STOP on
begin;
insert into auth.users(id) values('d8000000-0000-4000-8000-000000000001'),('d8000000-0000-4000-8000-000000000002'),('d8000000-0000-4000-8000-000000000003');
insert into profiles(id,nickname) values('d8000000-0000-4000-8000-000000000001','notify.consent.one'),('d8000000-0000-4000-8000-000000000002','notify.consent.two');
set local role authenticated;
set local request.jwt.claim.sub='d8000000-0000-4000-8000-000000000001';
do $$ declare state jsonb;begin
 state:=get_notification_consent('d8000000-0000-4000-8000-000000000011');
 if state<> '{"decision":"pending","registered":false}'::jsonb then raise exception 'New account not pending';end if;
 state:=enable_push_notifications('d8000000-0000-4000-8000-000000000011','https://fcm.googleapis.com/consent-one',repeat('A',87),repeat('A',22),repeat('A',87),'UTC');
 if state<> '{"decision":"accepted","registered":true}'::jsonb then raise exception 'Registration failed';end if;
 -- Repeated request is one consent, one subscription; no currency changes.
 perform enable_push_notifications('d8000000-0000-4000-8000-000000000011','https://fcm.googleapis.com/consent-one',repeat('A',87),repeat('A',22),repeat('A',87),'UTC');
 begin perform 1 from notification_consents;raise exception 'Private consent exposed';exception when insufficient_privilege then null;end;
 begin insert into notification_consents values(auth.uid(),gen_random_uuid(),'accepted',now());raise exception 'Direct writes allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$ begin
 if (select count(*) from notification_consents where user_id='d8000000-0000-4000-8000-000000000001')<>1 then raise exception 'Duplicate consent';end if;
 if (select count(*) from push_devices where user_id='d8000000-0000-4000-8000-000000000001')<>1 then raise exception 'Duplicate subscription';end if;
 if not exists(select 1 from push_devices where endpoint='https://fcm.googleapis.com/consent-one' and reminder_hour=18 and tone='dramatic') then raise exception 'Incorrect defaults';end if;
end $$;
-- Keep previous preferences, even when enrolling another device without controls.
update push_devices set reminder_hour=19,tone='gentle' where endpoint='https://fcm.googleapis.com/consent-one';
set local role authenticated;
select enable_push_notifications('d8000000-0000-4000-8000-000000000012','https://fcm.googleapis.com/consent-two',repeat('A',87),repeat('A',22),repeat('A',87),'UTC');
select decline_push_notifications('d8000000-0000-4000-8000-000000000011','https://fcm.googleapis.com/consent-one');
do $$ begin
 if get_notification_consent('d8000000-0000-4000-8000-000000000011','https://fcm.googleapis.com/consent-one')<> '{"decision":"declined","registered":false}'::jsonb then raise exception 'Refusal not saved';end if;
 if get_notification_consent('d8000000-0000-4000-8000-000000000012','https://fcm.googleapis.com/consent-two')<> '{"decision":"accepted","registered":true}'::jsonb then raise exception 'Other device changed';end if;
end $$;
set local request.jwt.claim.sub='d8000000-0000-4000-8000-000000000002';
do $$ begin
 if get_notification_consent('d8000000-0000-4000-8000-000000000012','https://fcm.googleapis.com/consent-two')<> '{"decision":"pending","registered":false}'::jsonb then raise exception 'Cross-account consent leaked';end if;
 perform decline_push_notifications('d8000000-0000-4000-8000-000000000012','https://fcm.googleapis.com/consent-two');
 -- Invalid subscription rolls back consent atomically.
 begin
  perform enable_push_notifications('d8000000-0000-4000-8000-000000000013','https://example.invalid/not-push',repeat('A',87),repeat('A',22),repeat('A',87),'UTC');
  raise exception 'Invalid provider allowed';
 exception when check_violation then null;end;
 if get_notification_consent('d8000000-0000-4000-8000-000000000013')->>'decision'<>'pending' then raise exception 'Failed signup saved consent';end if;
end $$;
reset role;
do $$ begin
 if not exists(select 1 from push_devices where endpoint='https://fcm.googleapis.com/consent-two' and enabled and reminder_hour=19 and tone='gentle') then raise exception 'Cross-account refusal or preferences lost';end if;
 if exists(select 1 from coin_movements where user_id in('d8000000-0000-4000-8000-000000000001','d8000000-0000-4000-8000-000000000002')) then raise exception 'Consent created rewards';end if;
 if exists(select 1 from push_jobs j join push_devices d on d.id=j.device_id where d.user_id in('d8000000-0000-4000-8000-000000000001','d8000000-0000-4000-8000-000000000002')) then raise exception 'Consent sent test notification';end if;
 if not(select relrowsecurity from pg_class where oid='notification_consents'::regclass) or has_function_privilege('anon','get_notification_consent(uuid,text)','execute') then raise exception 'RLS or ACL missing';end if;
end $$;
set local role authenticated;
set local request.jwt.claim.sub='d8000000-0000-4000-8000-000000000003';
do $$ begin
 begin perform get_notification_consent(gen_random_uuid());raise exception 'Missing profile accepted';exception when raise_exception then if SQLERRM='Missing profile accepted' then raise;end if;end;
end $$;
set local role anon;
do $$ begin
 begin perform decline_push_notifications(gen_random_uuid());raise exception 'Anonymous consent allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
select 'PASS notification onboarding: atomic enrollment, stable preferences, refusal, account/device isolation, RLS and no fabricated events';
rollback;
