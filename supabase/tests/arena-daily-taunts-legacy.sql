-- Disposable fixtures proving that migration never replenishes a spent live quota.
insert into auth.users(id) values('d3900000-0000-4000-8000-000000000001'),('d3900000-0000-4000-8000-000000000002'),('d3900000-0000-4000-8000-000000000003');
insert into profiles(id,nickname) select id,'daily.'||right(id::text,1) from auth.users where id::text like 'd3900000%';
insert into training_accounts(user_id,time_zone,started_on) select id,'America/Sao_Paulo',current_date from profiles where id::text like 'd3900000%';
insert into friendships(requester,recipient,status) values
 ('d3900000-0000-4000-8000-000000000001','d3900000-0000-4000-8000-000000000002','accepted'),
 ('d3900000-0000-4000-8000-000000000001','d3900000-0000-4000-8000-000000000003','accepted'),
 ('d3900000-0000-4000-8000-000000000002','d3900000-0000-4000-8000-000000000003','accepted');
set request.jwt.claim.sub='d3900000-0000-4000-8000-000000000001';
select send_arena_taunt('d3900000-0000-4000-8000-000000000002','online','d3901000-0000-4000-8000-000000000001');
create table daily_legacy_before as select to_jsonb(t) original from arena_taunts t;
create table daily_receipts_before as select to_jsonb(t) original from arena_group_receipts t;
