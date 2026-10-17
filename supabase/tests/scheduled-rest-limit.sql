begin;
insert into auth.users(id) values('ffffffff-ffff-4fff-8fff-000000000001');
insert into public.training_accounts(user_id,time_zone,revision,started_on)
values('ffffffff-ffff-4fff-8fff-000000000001','UTC',1,current_date-20);
-- A legacy week with four rests remains readable and keeps its original effect.
insert into public.training_plans(user_id,revision,effective_on,training_days)
values('ffffffff-ffff-4fff-8fff-000000000001',1,current_date-20,array[1,3,5]);
set local role authenticated;
select set_config('request.jwt.claim.sub','ffffffff-ffff-4fff-8fff-000000000001',true);
do $$ declare r jsonb; invalid integer[]; begin
 r:=public.get_training_state('UTC');
 if r#>'{plans,0,trainingDays}'<>'[1,3,5]'::jsonb then raise exception 'Legacy plan was changed'; end if;
 begin
   perform public.save_training_plan(array[1,2,3,4],1,'UTC');
   raise exception 'Three scheduled rests accepted';
 exception when raise_exception then
   if sqlerrm<>'Escolha no máximo 2 dias de descanso.' then raise; end if;
 end;
 foreach invalid slice 1 in array array[array[1,2,3,4,4],array[1,2,3,4,8],array[1,2,3,4,null]] loop
   begin
     perform public.save_training_plan(invalid,1,'UTC');
     raise exception 'Invalid days bypassed limit';
   exception when raise_exception then
     if sqlerrm<>'Escolha pelo menos um dia de treino, sem repetir os dias.' then raise; end if;
   end;
 end loop;
 r:=public.get_training_state('UTC');
 if (r->>'revision')::int<>1 or jsonb_array_length(r->'plans')<>1 then raise exception 'Rejected save changed state'; end if;
 r:=public.save_training_plan(array[5,4,3,2,1],1,'UTC');
 if (r->>'revision')::int<>2 or jsonb_array_length(r->'plans')<>2 then raise exception 'Two rests not accepted'; end if;
 if not exists(select 1 from jsonb_array_elements(r->'plans') p where p->>'revision'='2' and p->'trainingDays'='[1,2,3,4,5]'::jsonb and (p->>'effectiveFrom')::date=current_date+1) then raise exception 'New plan is not future-only'; end if;
 r:=public.save_training_plan(array[1,2,3,4,5,6],2,'UTC');
 r:=public.save_training_plan(array[1,2,3,4,5,6,7],3,'UTC');
 if (r->>'weeklyExtraLimit')::int<>2 then raise exception 'Extra rest quota changed'; end if;
 if not exists(select 1 from jsonb_array_elements(r->'plans') p where p->>'revision'='1' and p->'trainingDays'='[1,3,5]'::jsonb) then raise exception 'Legacy history rewritten'; end if;
end $$;
set local role anon;
do $$ begin
 begin perform public.save_training_plan(array[1,2,3,4,5],0,'UTC'); raise exception 'Anonymous save allowed';
 exception when insufficient_privilege then null; end;
end $$;
rollback;
select 'PASS: scheduled rest limit, rejected-save atomicity, legacy preservation and future-only updates' as result;
