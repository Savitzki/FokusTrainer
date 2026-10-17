begin;
insert into auth.users(id) values('abababab-abab-4bab-8bab-000000000001'),('abababab-abab-4bab-8bab-000000000002');
set local role authenticated;
select set_config('request.jwt.claim.sub','abababab-abab-4bab-8bab-000000000001',true);
do $$ declare s jsonb; wallet jsonb; a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); stamp timestamptz:=clock_timestamp(); entries jsonb; begin
 entries:=jsonb_build_array(jsonb_build_object('id',a,'date',current_date,'kg',75,'recordedAt',stamp),jsonb_build_object('id',b,'date',current_date,'kg',74.8,'recordedAt',stamp));
 s:=sync_weight_entries(auth.uid(),entries,'UTC');
 if jsonb_array_length(s->'records')<>2 or jsonb_array_length(s->'applied')<>2 then raise exception 'Same-date weights replaced each other'; end if;
 s:=sync_weight_entries(auth.uid(),entries,'Pacific/Kiritimati');
 if jsonb_array_length(s->'records')<>2 then raise exception 'Retry duplicated weight'; end if;
 wallet:=get_economy_state('UTC');
 if (wallet->>'balance')::int<>2 or jsonb_array_length(wallet#>'{history,entries}')<>1 then raise exception 'Multiple entries farmed coins'; end if;
 s:=sync_weight_entries(auth.uid(),jsonb_build_array(jsonb_build_object('id',a,'date',current_date,'kg',80,'recordedAt',stamp)),'UTC');
 if jsonb_array_length(s->'applied')<>0 or not exists(select 1 from jsonb_array_elements(s->'records') r where r->>'id'=a::text and (r->>'kg')::numeric=75) then raise exception 'Saved value was changed'; end if;
 s:=sync_weight_entries(auth.uid(),jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'date',current_date,'kg',75,'recordedAt',stamp)),'UTC');
 if jsonb_array_length(s->'records')<>3 then raise exception 'Same value with independent ID was incorrectly deduplicated'; end if;
 begin perform sync_weight_entries(auth.uid(),jsonb_build_array(jsonb_build_object('id',a,'date',current_date,'kg',null,'recordedAt',stamp)),'UTC'); raise exception 'Null/deletion accepted';
 exception when raise_exception then if sqlerrm='Null/deletion accepted' then raise; end if; end;
 begin perform sync_weights(auth.uid(),jsonb_build_array(jsonb_build_object('date',current_date,'kg',99,'baseVersion',0,'mutationId',gen_random_uuid())),'UTC'); raise exception 'Old endpoint still mutates';
 exception when raise_exception then if sqlerrm='Old endpoint still mutates' then raise; end if; end;
 begin update weight_entries set kg=80; raise exception 'Direct edit permitted'; exception when insufficient_privilege then null; end;
 begin delete from weight_entries; raise exception 'Direct delete permitted'; exception when insufficient_privilege then null; end;
 begin perform sync_weight_entries('abababab-abab-4bab-8bab-000000000002','[]','UTC'); raise exception 'Other account write permitted';
 exception when raise_exception then if sqlerrm='Other account write permitted' then raise; end if; end;
 s:=sync_weight_entries(auth.uid(),jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'date',current_date-1,'kg',74,'recordedAt',stamp)),'UTC');
 if (get_economy_state('UTC')->>'balance')::int<>2 then raise exception 'Backdated weight rewarded'; end if;
end $$;
select set_config('request.jwt.claim.sub','abababab-abab-4bab-8bab-000000000002',true);
do $$ declare s jsonb; begin
 s:=sync_weight_entries(auth.uid(),'[]','UTC');
 if jsonb_array_length(s->'records')<>0 then raise exception 'Weights leaked between accounts'; end if;
end $$;
-- Migration preserves the legacy account, with no reward or duplicate when its lost old response is retried.
select set_config('request.jwt.claim.sub','cccccccc-cccc-4ccc-8ccc-000000000009',true);
reset role;
do $$ declare old weight_logs; payload jsonb; result jsonb; begin
 select * into old from weight_logs where user_id='cccccccc-cccc-4ccc-8ccc-000000000009' and day=current_date;
 if not exists(select 1 from weight_entries where user_id=old.user_id and legacy_day=old.day and kg=old.kg and recorded_at=old.updated_at) then raise exception 'Legacy value/time not preserved'; end if;
 payload:=jsonb_build_array(jsonb_build_object('id',old.mutation_id,'date',old.day,'kg',old.kg,'recordedAt',clock_timestamp()));
 result:=sync_weight_entries(old.user_id,payload,'UTC');
 if jsonb_array_length(result->'records')<>1 or jsonb_array_length(result->'applied')<>1 then raise exception 'Legacy lost response duplicated entry'; end if;
 if (get_economy_state('UTC')->>'balance')::int<>0 then raise exception 'Legacy copy was rewarded'; end if;
end $$;
set local role anon;
do $$ begin
 begin perform sync_weight_entries('abababab-abab-4bab-8bab-000000000001','[]','UTC'); raise exception 'Guest endpoint allowed'; exception when insufficient_privilege then null; end;
end $$;
rollback;
select 'PASS: independent immutable weights, retries, one daily reward, legacy preservation, isolation and old endpoint frozen' as result;
