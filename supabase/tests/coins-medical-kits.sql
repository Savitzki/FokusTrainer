-- Run in the disposable PostgreSQL only. All fixtures roll back.
begin;
insert into auth.users(id) select ('cccccccc-cccc-4ccc-8ccc-'||lpad(i::text,12,'0'))::uuid from generate_series(1,8) i;
insert into public.profiles(id,nickname) select ('cccccccc-cccc-4ccc-8ccc-'||lpad(i::text,12,'0'))::uuid,'coins.'||i from generate_series(1,8) i;
set local role authenticated;
select set_config('request.jwt.claim.sub','cccccccc-cccc-4ccc-8ccc-000000000001',true);
do $$ declare s jsonb; mid uuid:=gen_random_uuid(); changes jsonb; begin
 s:=get_economy_state('UTC');
 if (s->>'balance')::int<>0 or (s->>'kits')::int<>0 then raise exception 'Wrong initial wallet'; end if;
 begin perform buy_medical_kit(gen_random_uuid(),'UTC'); raise exception 'Unfunded purchase accepted';
 exception when raise_exception then if sqlerrm<>'Moedas insuficientes para comprar o Kit Médico.' then raise; end if; end;
 perform confirm_daily_workout(current_date,'Treino válido',30,'UTC');
 perform confirm_daily_workout(current_date,'Reenvio',30,'Pacific/Kiritimati');
 s:=get_economy_state('UTC');
 if (s->>'balance')::int<>10 or jsonb_array_length(s#>'{history,entries}')<>1 then raise exception 'Workout reward duplicated/missing'; end if;
 changes:=jsonb_build_array(jsonb_build_object('date',current_date,'kg',75.1,'baseVersion',0,'mutationId',mid));
 perform sync_weights(auth.uid(),changes,'UTC');
 perform sync_weights(auth.uid(),changes,'UTC');
 perform sync_weights(auth.uid(),jsonb_build_array(jsonb_build_object('date',current_date,'kg',76,'baseVersion',1,'mutationId',gen_random_uuid())),'UTC');
 perform sync_weights(auth.uid(),jsonb_build_array(jsonb_build_object('date',current_date,'kg',null,'baseVersion',2,'mutationId',gen_random_uuid())),'UTC');
 perform sync_weights(auth.uid(),jsonb_build_array(jsonb_build_object('date',current_date,'kg',76,'baseVersion',3,'mutationId',gen_random_uuid())),'UTC');
 perform sync_weights(auth.uid(),jsonb_build_array(jsonb_build_object('date',current_date-1,'kg',76,'baseVersion',0,'mutationId',gen_random_uuid())),'UTC');
 s:=get_economy_state('UTC');
 if (s->>'balance')::int<>12 or jsonb_array_length(s#>'{history,entries}')<>2 then raise exception 'Weight retries/edits/deletion/backdating farmed coins'; end if;
 begin perform use_medical_kit(current_date,'UTC'); raise exception 'Kit consumed after training';
 exception when raise_exception then if sqlerrm<>'Você já registrou o treino de hoje.' then raise; end if; end;
 begin perform * from coin_wallets; raise exception 'Direct wallet read allowed'; exception when insufficient_privilege then null; end;
 begin update coin_wallets set balance=10000; raise exception 'Direct wallet mutation allowed'; exception when insufficient_privilege then null; end;
 begin perform economy_post(auth.uid(),'fake','workout','Fraud',100,current_date); raise exception 'Reward helper exposed'; exception when insufficient_privilege then null; end;
 begin perform economy_base_sync_weights(auth.uid(),'[]','UTC'); raise exception 'Legacy sync exposed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
-- Seed funds via the private posting helper, solely for purchase tests.
select public.economy_post('cccccccc-cccc-4ccc-8ccc-000000000002','fixture','workout','Fixture',150,current_date);
set local role authenticated;
select set_config('request.jwt.claim.sub','cccccccc-cccc-4ccc-8ccc-000000000002',true);
do $$ declare s jsonb; request uuid:=gen_random_uuid(); begin
 s:=get_economy_state('UTC');
 s:=buy_medical_kit(request,'UTC');
 s:=buy_medical_kit(request,'Pacific/Kiritimati');
 if (s->>'balance')::int<>100 or (s->>'kits')::int<>1 then raise exception 'Purchase retry charged twice'; end if;
 s:=buy_medical_kit(gen_random_uuid(),'UTC');
 if (s->>'balance')::int<>50 or (s->>'kits')::int<>2 then raise exception 'Second deliberate purchase failed'; end if;
 begin perform use_medical_kit(current_date-1,'UTC'); raise exception 'Retroactive protection accepted';
 exception when raise_exception then if sqlerrm<>'O Kit Médico protege apenas hoje, antes de o dia terminar.' then raise; end if; end;
 begin perform use_medical_kit(current_date+1,'UTC'); raise exception 'Future protection accepted';
 exception when raise_exception then if sqlerrm<>'O Kit Médico protege apenas hoje, antes de o dia terminar.' then raise; end if; end;
 s:=use_medical_kit(current_date,'UTC');
 s:=use_medical_kit(current_date,'Pacific/Kiritimati');
 if (s->>'balance')::int<>50 or (s->>'kits')::int<>1 or (s->>'kitsUsedThisWeek')::int<>1 then raise exception 'Protection spent twice or changed coins'; end if;
 if jsonb_array_length(s->'protections')<>1 or s#>>'{protections,0,usedAt}' is null then raise exception 'Protection history missing'; end if;
 s:=get_training_state('UTC');
 if s->'medicalRests'<>jsonb_build_array(current_date) then raise exception 'Protected day missing from streak state'; end if;
 begin perform authorize_extra_rest('UTC'); raise exception 'Extra rest overlapped kit';
 exception when raise_exception then if sqlerrm<>'Hoje já é um descanso programado.' then raise; end if; end;
end $$;
reset role;
do $$ declare u uuid:='cccccccc-cccc-4ccc-8ccc-000000000002'; begin
 if training_day_kind(u,current_date)<>'medical-kit' then raise exception 'Kit did not protect individual'; end if;
 if training_day_kind(u,current_date,'infinity',now()-interval '1 day')='medical-kit' then raise exception 'Kit changed a closed group snapshot'; end if;
 if (select balance from coin_wallets where user_id=u)<>(select sum(amount) from coin_movements where user_id=u) then raise exception 'Ledger does not reconstruct balance'; end if;
 if exists(select 1 from (select balance_after,sum(amount) over(order by id) expected from coin_movements where user_id=u) q where balance_after<>expected) then raise exception 'Running balances invalid'; end if;
end $$;
-- Kits cannot be consumed on a scheduled or extra rest day.
insert into public.training_accounts(user_id,time_zone,started_on) values('cccccccc-cccc-4ccc-8ccc-000000000003','UTC',current_date);
insert into public.training_plans(user_id,revision,effective_on,training_days,created_at)
values('cccccccc-cccc-4ccc-8ccc-000000000003',1,current_date-10,array(select i from generate_series(1,7) i where i<>extract(isodow from current_date)::int),'2000-01-01');
set local role authenticated;
select set_config('request.jwt.claim.sub','cccccccc-cccc-4ccc-8ccc-000000000003',true);
do $$ begin
 begin perform use_medical_kit(current_date,'UTC'); raise exception 'Scheduled rest used kit';
 exception when raise_exception then if sqlerrm<>'Hoje já está protegido por um descanso.' then raise; end if; end;
end $$;
select set_config('request.jwt.claim.sub','cccccccc-cccc-4ccc-8ccc-000000000004',true);
select public.authorize_extra_rest('UTC');
do $$ begin
 begin perform use_medical_kit(current_date,'UTC'); raise exception 'Extra rest used kit';
 exception when raise_exception then if sqlerrm<>'Hoje já está protegido por um descanso.' then raise; end if; end;
end $$;
reset role;
-- Group rest bridging is shared with the existing evaluator.
insert into public.streak_groups(id,owner_id,name,time_zone,status,started_on)
values('dddddddd-dddd-4ddd-8ddd-000000000001','cccccccc-cccc-4ccc-8ccc-000000000002','Kit group','UTC','active',current_date);
insert into public.group_members(group_id,user_id,status) values
('dddddddd-dddd-4ddd-8ddd-000000000001','cccccccc-cccc-4ccc-8ccc-000000000002','accepted'),
('dddddddd-dddd-4ddd-8ddd-000000000001','cccccccc-cccc-4ccc-8ccc-000000000003','accepted');
select public.social_refresh_day('dddddddd-dddd-4ddd-8ddd-000000000001');
do $$ begin
 if not exists(select 1 from group_days where group_id='dddddddd-dddd-4ddd-8ddd-000000000001' and day=current_date and not counts_for_streak) then raise exception 'All-rest group should bridge with zero points'; end if;
end $$;
-- Pagination exposes only the caller's history, preserving every movement.
select public.economy_post('cccccccc-cccc-4ccc-8ccc-000000000005','page:'||i,'weight','Fixture',2,current_date) from generate_series(1,25) i;
set local role authenticated;
select set_config('request.jwt.claim.sub','cccccccc-cccc-4ccc-8ccc-000000000005',true);
do $$ declare p jsonb; q jsonb; cursor_id bigint; begin
 p:=get_economy_history();
 if jsonb_array_length(p->'entries')<>20 or not (p->>'hasMore')::boolean then raise exception 'First page invalid'; end if;
 cursor_id:=(p#>>'{entries,19,id}')::bigint;
 q:=get_economy_history(cursor_id);
 if jsonb_array_length(q->'entries')<>5 or (q->>'hasMore')::boolean then raise exception 'Second page invalid'; end if;
end $$;
select set_config('request.jwt.claim.sub','cccccccc-cccc-4ccc-8ccc-000000000006',true);
do $$ declare s jsonb; begin
 s:=get_economy_state('UTC');
 if (s->>'balance')::int<>0 or jsonb_array_length(get_economy_history()->'entries')<>0 then raise exception 'Account data leaked'; end if;
 begin perform use_medical_kit(current_date,'UTC'); raise exception 'Kit created from nothing';
 exception when raise_exception then if sqlerrm<>'Você não tem um Kit Médico disponível.' then raise; end if; end;
end $$;
reset role;
-- Weekly limit is server-side and respects pinned Monday-Sunday boundaries.
do $$ declare u uuid:='cccccccc-cccc-4ccc-8ccc-000000000007'; i int; m bigint; begin
 insert into training_accounts(user_id,time_zone,started_on) values(u,'UTC',current_date);
 perform economy_post(u,'seed','workout','Fixture',200,current_date);
 for i in 1..3 loop
  m:=economy_post(u,'kit:fixture'||i,'kit-purchase','Fixture',-50,current_date);
  insert into medical_kits(user_id,purchase_id,used_on,used_at)
  values(u,m,case when i<=2 then current_date-i else null end,case when i<=2 then now()-i*interval '1 day' else null end);
 end loop;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','cccccccc-cccc-4ccc-8ccc-000000000007',true);
do $$ declare s jsonb; n int; begin
 s:=get_economy_state('Pacific/Kiritimati'); n:=(s->>'kitsUsedThisWeek')::int;
 if n>=2 then
  begin perform use_medical_kit(current_date,'UTC'); raise exception 'Weekly kit limit bypassed';
  exception when raise_exception then if sqlerrm<>'Você já usou o limite de kits desta semana.' then raise; end if; end;
 else
  s:=use_medical_kit(current_date,'UTC');
  if (s->>'kitsUsedThisWeek')::int<>n+1 then raise exception 'Week reset failed'; end if;
 end if;
end $$;
set local role anon;
do $$ begin
 begin perform get_economy_state('UTC'); raise exception 'Anonymous wallet exposed'; exception when insufficient_privilege then null; end;
 begin perform buy_medical_kit(gen_random_uuid(),'UTC'); raise exception 'Anonymous purchase allowed'; exception when insufficient_privilege then null; end;
end $$;
-- Configuration affects only new operations; retries keep the original purchase.
reset role;
insert into public.training_accounts(user_id,time_zone,started_on) values('cccccccc-cccc-4ccc-8ccc-000000000008','UTC',current_date);
select public.economy_post('cccccccc-cccc-4ccc-8ccc-000000000008','seed','workout','Fixture',100,current_date);
with spent as (select public.economy_post('cccccccc-cccc-4ccc-8ccc-000000000008','kit:dddddddd-dddd-4ddd-8ddd-000000000008','kit-purchase','Compra de Kit Médico',-50,current_date) id)
insert into public.medical_kits(user_id,purchase_id) select 'cccccccc-cccc-4ccc-8ccc-000000000008',id from spent;
update public.economy_rules set kit_price=60,workout_reward=13,weight_reward=3,weekly_kit_limit=0;
set local role authenticated;
select set_config('request.jwt.claim.sub','cccccccc-cccc-4ccc-8ccc-000000000008',true);
do $$ declare s jsonb; begin
 s:=buy_medical_kit('dddddddd-dddd-4ddd-8ddd-000000000008','UTC');
 if (s->>'balance')::int<>50 or (s->>'kits')::int<>1 then raise exception 'Price change charged retry'; end if;
 perform confirm_daily_workout(current_date,'Configured reward',30,'UTC');
 perform sync_weights(auth.uid(),jsonb_build_array(jsonb_build_object('date',current_date,'kg',75,'baseVersion',0,'mutationId',gen_random_uuid())),'UTC');
 s:=buy_medical_kit(gen_random_uuid(),'UTC');
 if (s->>'balance')::int<>6 or (s->>'kits')::int<>2 or (s#>>'{rules,kitPrice}')::int<>60 then raise exception 'Server rules ignored'; end if;
end $$;
select set_config('request.jwt.claim.sub','cccccccc-cccc-4ccc-8ccc-000000000006',true);
do $$ begin
 begin perform use_medical_kit(current_date,'UTC'); raise exception 'Configured zero quota ignored';
 exception when raise_exception then if sqlerrm<>'Você já usou o limite de kits desta semana.' then raise; end if; end;
end $$;
-- Already-existing records never receive retroactive rewards, even if replayed/edited.
set local role authenticated;
select set_config('request.jwt.claim.sub','cccccccc-cccc-4ccc-8ccc-000000000009',true);
do $$ declare s jsonb; begin
 s:=get_economy_state('UTC');
 if (s->>'balance')::int<>0 then raise exception 'Migration backfilled coins'; end if;
 perform confirm_daily_workout(current_date,'Reenvio legado',30,'UTC');
 perform sync_weights(auth.uid(),jsonb_build_array(jsonb_build_object('date',current_date,'kg',79,'baseVersion',1,'mutationId',gen_random_uuid())),'UTC');
 s:=get_economy_state('UTC');
 if (s->>'balance')::int<>0 then raise exception 'Legacy edits earned retroactive coins'; end if;
end $$;
reset role;
do $$ begin
 if not exists(select 1 from workout_days where user_id='cccccccc-cccc-4ccc-8ccc-000000000009' and activity='Treino anterior à moeda' and minutes=40) then raise exception 'Legacy workout changed'; end if;
end $$;
rollback;
select 'PASS: rewards, deduplication, purchase atomicity, protection, groups, weekly quota, history and isolation' as result;
