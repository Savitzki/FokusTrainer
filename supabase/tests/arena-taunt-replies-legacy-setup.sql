-- Fixtures created before migration 037 in disposable PostgreSQL only.
insert into auth.users(id) values('d3790000-0000-4000-8000-000000000001'),('d3790000-0000-4000-8000-000000000002');
insert into profiles(id,nickname) values('d3790000-0000-4000-8000-000000000001','notice.legacy.a'),('d3790000-0000-4000-8000-000000000002','notice.legacy.b');
insert into arena_taunts(id,sender,recipient,message_id,seen_at) values
 ('d3791000-0000-4000-8000-000000000001','d3790000-0000-4000-8000-000000000001','d3790000-0000-4000-8000-000000000002','doubt',now()),
 ('d3791000-0000-4000-8000-000000000002','d3790000-0000-4000-8000-000000000001','d3790000-0000-4000-8000-000000000002','watching',null);
create table arena_notice_legacy_baseline as select id,to_jsonb(t) original from arena_taunts t;
