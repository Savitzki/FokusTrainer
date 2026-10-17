-- Disposable database only. No production users are created or modified.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
do $$
declare r jsonb; day_value text := current_date::text; stamp text;
begin
 r := public.sync_weights(auth.uid(),jsonb_build_array(jsonb_build_object('date',day_value,'kg',75.5,'baseVersion',0,'mutationId','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')),'UTC');
 if jsonb_array_length(r->'applied')<>1 or (r#>>'{records,0,version}')::int<>1 then raise exception 'Initial insert failed'; end if;
 r := public.sync_weights(auth.uid(),jsonb_build_array(jsonb_build_object('date',day_value,'kg',75.5,'baseVersion',0,'mutationId','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')),'UTC');
 if (r#>>'{records,0,version}')::int<>1 then raise exception 'Retry was not idempotent'; end if;
 r := public.sync_weights(auth.uid(),jsonb_build_array(jsonb_build_object('date',day_value,'kg',76,'baseVersion',1,'mutationId','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')),'UTC');
 if (r#>>'{records,0,version}')::int<>2 then raise exception 'Edit failed'; end if;
 r := public.sync_weights(auth.uid(),jsonb_build_array(jsonb_build_object('date',day_value,'kg',74,'baseVersion',1,'mutationId','cccccccc-cccc-4ccc-8ccc-cccccccccccc')),'UTC');
 if jsonb_array_length(r->'applied')<>0 or (r#>>'{records,0,kg}')::numeric<>76 then raise exception 'Stale edit overwrote newer data'; end if;
 r := public.sync_weights(auth.uid(),jsonb_build_array(jsonb_build_object('date',day_value,'kg',null,'baseVersion',2,'mutationId','dddddddd-dddd-4ddd-8ddd-dddddddddddd')),'UTC');
 if (r#>>'{records,0,kg}') is not null or (r#>>'{records,0,version}')::int<>3 then raise exception 'Deletion failed'; end if;
 r := public.sync_weights(auth.uid(),jsonb_build_array(jsonb_build_object('date',day_value,'kg',75.5,'baseVersion',0,'mutationId','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee')),'UTC');
 if jsonb_array_length(r->'applied')<>0 or (r#>>'{records,0,kg}') is not null then raise exception 'Offline device resurrected deletion'; end if;
 begin
  perform public.sync_weights('22222222-2222-4222-8222-222222222222','[]','UTC');
  raise exception 'Spoofed user was accepted';
 exception when raise_exception then if sqlerrm='Spoofed user was accepted' then raise; end if; end;
 begin
  perform public.sync_weights(auth.uid(),jsonb_build_array(jsonb_build_object('date',day_value,'kg',75.55,'baseVersion',3,'mutationId','ffffffff-ffff-4fff-8fff-ffffffffffff')),'UTC');
  raise exception 'Invalid precision was accepted';
 exception when raise_exception then if sqlerrm='Invalid precision was accepted' then raise; end if; end;
 begin
  perform public.sync_weights(auth.uid(),jsonb_build_array(jsonb_build_object('date',(current_date+1)::text,'kg',75,'baseVersion',0,'mutationId','ffffffff-ffff-4fff-8fff-ffffffffffff')),'UTC');
  raise exception 'Future date was accepted';
 exception when raise_exception then if sqlerrm='Future date was accepted' then raise; end if; end;
 begin perform * from public.weight_logs; raise exception 'Direct table access allowed'; exception when insufficient_privilege then null; end;
 perform public.confirm_daily_workout(current_date,'Timestamp test',30,'UTC');
 r := public.get_social_state();
 select value->>'confirmedAt' into stamp from jsonb_array_elements(r->'workouts') where value->>'date'=day_value;
 if stamp is null then raise exception 'Missing server timestamp'; end if;
 perform public.confirm_daily_workout(current_date,'Another device',50,'UTC');
 r := public.get_social_state();
 if not exists(select 1 from jsonb_array_elements(r->'workouts') where value->>'date'=day_value and value->>'confirmedAt'=stamp) then raise exception 'Server timestamp changed on retry'; end if;
end $$;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
do $$ begin
 if jsonb_array_length(public.sync_weights(auth.uid(),'[]','UTC')->'records')<>0 then raise exception 'Another account saw private weights'; end if;
end $$;
set local role anon;
do $$ begin
 begin perform public.sync_weights('11111111-1111-4111-8111-111111111111','[]','UTC'); raise exception 'Anonymous access allowed'; exception when insufficient_privilege then null; end;
end $$;
rollback;
select 'PASS: weight isolation, revisions, retries, edits, deletion tombstones, precision, future dates and immutable workout times' as result;
