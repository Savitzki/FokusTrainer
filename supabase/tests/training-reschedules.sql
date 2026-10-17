-- Disposable fixtures only. A fixed future Monday avoids host weekday dependence.
begin;
do $$ declare actual jsonb; expected jsonb; begin
 select payload into expected from test_reschedule_baseline;
 select jsonb_build_object(
 'plans',(select md5(coalesce(string_agg(to_jsonb(t)::text,'|' order by user_id,revision),'')) from public.training_plans t),
 'groups',(select md5(coalesce(string_agg(to_jsonb(t)::text,'|' order by group_id,day),'')) from public.group_days t),
 'accounts',(select md5(coalesce(string_agg(to_jsonb(t)::text,'|' order by user_id),'')) from public.training_accounts t),
 'wallets',(select md5(coalesce(string_agg(to_jsonb(t)::text,'|' order by user_id),'')) from public.coin_wallets t),
 'coins',(select md5(coalesce(string_agg(to_jsonb(t)::text,'|' order by id),'')) from public.coin_movements t),
 'kits',(select md5(coalesce(string_agg(to_jsonb(t)::text,'|' order by id),'')) from public.medical_kits t),
 'workouts',(select md5(coalesce(string_agg(to_jsonb(t)::text,'|' order by id),'')) from public.workout_days t)
 ) into actual;
 if actual<>expected then raise exception 'Migration modified historical fixtures'; end if;
end $$;
insert into auth.users(id) select ('12121212-1212-4212-8212-'||lpad(i::text,12,'0'))::uuid from generate_series(1,9) i;
insert into public.profiles(id,nickname) select ('12121212-1212-4212-8212-'||lpad(i::text,12,'0'))::uuid,'reschedule.'||i from generate_series(1,9) i;
insert into public.training_accounts(user_id,time_zone,revision,started_on)
 select ('12121212-1212-4212-8212-'||lpad(i::text,12,'0'))::uuid,'UTC',1,current_date from generate_series(1,8) i;
-- Thu/Sun are rest; all other weekdays train. Version is well before any group snapshot.
insert into public.training_plans(user_id,revision,effective_on,training_days,created_at)
 select ('12121212-1212-4212-8212-'||lpad(i::text,12,'0'))::uuid,1,date '2000-01-01',array[1,2,3,5,6],timestamptz '2000-01-01' from generate_series(1,8) i;
set local role authenticated;
select set_config('request.jwt.claim.sub','12121212-1212-4212-8212-000000000001',true);
do $$ declare s jsonb; monday date:=date_trunc('week',now())::date+7; begin
 foreach s in array array['[1,2,3,4]'::jsonb,'[1,2,3,4,5,6]'::jsonb,'[1,2,3,4,5,6,7]'::jsonb] loop
  begin perform save_training_plan(array(select jsonb_array_elements_text(s)::int),1,'UTC');raise exception 'Invalid schedule accepted';
  exception when raise_exception then if sqlerrm<>'Escolha exatamente 5 dias de treino e 2 de descanso.' then raise; end if; end;
 end loop;
 s:=reschedule_training(monday+1,monday+3,1,'UTC');
 if (s->>'revision')::int<>2 or jsonb_array_length(s->'reschedules')<>1 then raise exception 'Swap not saved'; end if;
 if s#>>'{reschedules,0,weekStart}'<>monday::text then raise exception 'Wrong week identifier'; end if;
 s:=reschedule_training(monday+1,monday+3,1,'Pacific/Kiritimati');
 if (s->>'revision')::int<>2 or s->>'timezone'<>'UTC' then raise exception 'Retry/changed device timezone mutated swap'; end if;
 begin perform reschedule_training(monday+1,monday+6,2,'UTC');raise exception 'Origin rescheduled twice';
 exception when raise_exception then if sqlerrm<>'Uma dessas datas já participa de um reagendamento.' then raise; end if; end;
 begin perform reschedule_training(monday+3,monday+6,2,'UTC');raise exception 'Compensation chained';
 exception when raise_exception then if sqlerrm<>'Uma dessas datas já participa de um reagendamento.' then raise; end if; end;
 begin perform reschedule_training(monday+2,monday+3,2,'UTC');raise exception 'Destination reused';
 exception when raise_exception then if sqlerrm<>'Uma dessas datas já participa de um reagendamento.' then raise; end if; end;
 begin perform reschedule_training(monday,monday+2,2,'UTC');raise exception 'Occupied date accepted';
 exception when raise_exception then if sqlerrm<>'Troque um treino obrigatório por um descanso programado disponível.' then raise; end if; end;
 begin perform reschedule_training(monday+2,monday+7,2,'UTC');raise exception 'Outside week accepted';
 exception when raise_exception then if sqlerrm<>'Escolha um descanso posterior ao treino, na mesma semana, antes de encerrar o dia original.' then raise; end if; end;
 begin perform reschedule_training(current_date-1,current_date,2,'UTC');raise exception 'Past origin accepted';
 exception when raise_exception then if sqlerrm<>'Escolha um descanso posterior ao treino, na mesma semana, antes de encerrar o dia original.' then raise; end if; end;
 s:=reschedule_training(monday+4,monday+6,2,'UTC');
 if jsonb_array_length(s->'reschedules')<>2 then raise exception 'Second swap rejected'; end if;
 begin perform reschedule_training(monday,monday+3,3,'UTC');raise exception 'Third swap accepted';
 exception when raise_exception then if sqlerrm<>'Você já usou os 2 reagendamentos desta semana.' then raise; end if; end;
 if (get_economy_state('UTC')->>'balance')::int<>0 then raise exception 'Swap minted coins'; end if;
 begin perform save_training_plan(array[1,2,3,4,5],3,'UTC');raise exception 'Permanent edit invalidated pending swap';
 exception when raise_exception then if sqlerrm<>'Essa programação conflita com um reagendamento confirmado. Preserve os dias envolvidos.' then raise; end if; end;
 begin perform * from training_reschedules;raise exception 'Direct table read allowed';exception when insufficient_privilege then null;end;
 begin perform training_schedule_kind(auth.uid(),monday);raise exception 'Helper exposed';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$ declare u uuid:='12121212-1212-4212-8212-000000000001'; monday date:=date_trunc('week',now())::date+7; n integer; begin
 if training_day_kind(u,monday+1)<>'rescheduled-rest' or training_day_kind(u,monday+3)<>'training' then raise exception 'Effective schedule incorrect'; end if;
 select count(*) into n from generate_series(0,6) i where training_schedule_kind(u,monday+i)='training';
 if n<>5 then raise exception 'Swap changed number of planned workouts'; end if;
 if training_day_kind(u,monday+1,'infinity',now()-interval '1 day')<>'training' then raise exception 'Past snapshot rewritten'; end if;
 if exists(select 1 from training_reschedules where user_id=u and week_start<>monday) then raise exception 'Swap leaked across weeks'; end if;
 if training_day_kind(u,monday+10)<>'scheduled-rest' then raise exception 'Swap changed next week'; end if;
end $$;
-- Conflicts: recorded workout, extra rest and kits at either endpoint.
insert into public.workout_days(user_id,day,activity,minutes) values('12121212-1212-4212-8212-000000000002',date_trunc('week',now())::date+8,'Fixture',30);
set local role authenticated;
select set_config('request.jwt.claim.sub','12121212-1212-4212-8212-000000000002',true);
do $$ declare m date:=date_trunc('week',now())::date+7; begin
 begin perform reschedule_training(m+1,m+3,1,'UTC');raise exception 'Confirmed workout moved';
 exception when raise_exception then if sqlerrm<>'Uma dessas datas já tem treino confirmado.' then raise; end if; end;
end $$;
reset role;
insert into training_extra_rests(user_id,day) values('12121212-1212-4212-8212-000000000003',date_trunc('week',now())::date+8),('12121212-1212-4212-8212-000000000004',date_trunc('week',now())::date+10);
set local role authenticated;
select set_config('request.jwt.claim.sub','12121212-1212-4212-8212-000000000003',true);
do $$ declare m date:=date_trunc('week',now())::date+7; begin
 begin perform reschedule_training(m+1,m+3,1,'UTC');raise exception 'Extra-rest origin moved';
 exception when raise_exception then if sqlerrm<>'Troque um treino obrigatório por um descanso programado disponível.' then raise; end if; end;
end $$;
select set_config('request.jwt.claim.sub','12121212-1212-4212-8212-000000000004',true);
do $$ declare m date:=date_trunc('week',now())::date+7; begin
 begin perform reschedule_training(m+1,m+3,1,'UTC');raise exception 'Protected destination accepted';
 exception when raise_exception then if sqlerrm<>'Troque um treino obrigatório por um descanso programado disponível.' then raise; end if; end;
end $$;
reset role;
-- Kit quota, price and balances remain independent, using existing purchase helper for fixtures.
select economy_post('12121212-1212-4212-8212-000000000005','fixture','workout','Fixture',50,current_date);
with spent as(select economy_post('12121212-1212-4212-8212-000000000005','kit:fixture','kit-purchase','Fixture',-50,current_date) id)
insert into medical_kits(user_id,purchase_id,used_on,used_at) select '12121212-1212-4212-8212-000000000005',id,date_trunc('week',now())::date+10,now() from spent;
set local role authenticated;
select set_config('request.jwt.claim.sub','12121212-1212-4212-8212-000000000005',true);
do $$ declare m date:=date_trunc('week',now())::date+7; begin
 begin perform reschedule_training(m+1,m+3,1,'UTC');raise exception 'Kit destination accepted';
 exception when raise_exception then if sqlerrm<>'Troque um treino obrigatório por um descanso programado disponível.' then raise; end if; end;
end $$;
-- Permanent edits append future versions, and cannot silently add a sixth workout midweek.
select set_config('request.jwt.claim.sub','12121212-1212-4212-8212-000000000006',true);
do $$ declare before_state jsonb; after_state jsonb; removed_day integer; added_day integer; proposal integer[]; begin
 before_state:=get_training_state('UTC');
 select n into removed_day from unnest(array[1,2,3,5,6]) n where n<=extract(isodow from current_date)::int order by n limit 1;
 select n into added_day from unnest(array[4,7]) n where n>extract(isodow from current_date)::int order by n limit 1;
 if removed_day is not null and added_day is not null then
  select array_agg(n order by n) into proposal from unnest(array[1,2,3,5,6,added_day]) n where n<>removed_day;
  begin perform save_training_plan(proposal,1,'UTC');raise exception 'Midweek edit changed the five planned workouts';
  exception when raise_exception then if sqlerrm<>'A mudança deixaria esta semana com 6 treinos. Preserve os dias já passados ou use Reagendar treino.' then raise; end if;end;
  if get_training_state('UTC')<>before_state then raise exception 'Rejected edit modified history'; end if;
 end if;
 after_state:=save_training_plan(array[1,2,3,5,6],1,'UTC');
 if after_state#>'{plans,0}'<>before_state#>'{plans,0}' or jsonb_array_length(after_state->'plans')<>2
  or (after_state#>>'{plans,1,effectiveFrom}')::date<>current_date+1 then raise exception 'Permanent edit rewrote earlier version'; end if;
end $$;
-- New accounts get 5/2 from tomorrow, but existing plans are not changed.
select set_config('request.jwt.claim.sub','12121212-1212-4212-8212-000000000009',true);
do $$ declare s jsonb; begin
 s:=get_training_state('UTC');
 if (s->>'revision')::int<>1 or s#>'{plans,0,trainingDays}'<>'[1,2,3,4,5]'::jsonb or (s#>>'{plans,0,effectiveFrom}')::date<>current_date+1 then raise exception 'Default plan invalid'; end if;
 s:=save_training_plan(array[1,2,3,4,5],1,'UTC');
 if jsonb_array_length(s->'plans')<>2 then raise exception 'Old version removed'; end if;
end $$;
set local role anon;
do $$ begin
 begin perform reschedule_training(current_date,current_date+1,1,'UTC');raise exception 'Guest reschedule allowed';exception when insufficient_privilege then null;end;
end $$;
rollback;
select 'PASS: 5/2 plans, swaps, quota, retries, immutability, protections and isolation' as result;
