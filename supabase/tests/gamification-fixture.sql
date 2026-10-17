-- Test accounts only, inside a disposable PostgreSQL transaction.
begin;
create function pg_temp.check_ok(ok boolean,label text) returns void language plpgsql as $$ begin
 if ok is distinct from true then raise exception 'FAIL: %',label; end if; end $$;
insert into auth.users(id) values
 ('a0000000-0000-4000-8000-000000000001'),('a0000000-0000-4000-8000-000000000002'),('a0000000-0000-4000-8000-000000000003');
insert into profiles(id,nickname) values
 ('a0000000-0000-4000-8000-000000000001','gamify.alpha'),('a0000000-0000-4000-8000-000000000002','gamify.beta'),('a0000000-0000-4000-8000-000000000003','gamify.other');
insert into training_accounts(user_id,time_zone,started_on) select id,'UTC',date_trunc('week',now())::date-70 from auth.users where id::text like 'a0000000-%';
insert into training_plans(user_id,revision,effective_on,training_days,created_at) select user_id,1,started_on,array[1,2,3,4,5],started_on::timestamp from training_accounts where user_id::text like 'a0000000-%';
update training_accounts set revision=1 where user_id::text like 'a0000000-%';
insert into gf_accounts(user_id) select user_id from training_accounts where user_id::text like 'a0000000-%';
insert into coin_wallets(user_id) select user_id from gf_accounts where user_id::text like 'a0000000-%';
select economy_post(user_id,'fixture','workout','Test fixture',1000,current_date-100) from gf_accounts where user_id::text like 'a0000000-%';
insert into friendships(requester,recipient,status) values('a0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000002','accepted');
set request.jwt.claim.sub='a0000000-0000-4000-8000-000000000001';
