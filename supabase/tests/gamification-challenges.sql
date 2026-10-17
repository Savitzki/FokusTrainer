\ir gamification-fixture.sql
create temp table saved_challenge(id uuid);
insert into saved_challenge select create_friend_challenge('Parceria','consistency',7,array['a0000000-0000-4000-8000-000000000002'::uuid],null,'UTC');
select pg_temp.check_ok(jsonb_array_length(get_friend_challenges())=1,'creator sees challenge');
set request.jwt.claim.sub='a0000000-0000-4000-8000-000000000002';
select pg_temp.check_ok((get_friend_challenges()->0->>'invited')::boolean,'friend must accept invitation');
select reply_challenge_invite((select id from saved_challenge),true,'UTC');
do $$ begin begin perform reply_challenge_invite((select id from saved_challenge),true,'UTC');raise exception 'duplicate acceptance';exception when raise_exception then if sqlerrm='duplicate acceptance' then raise;end if;end;end $$;
set request.jwt.claim.sub='a0000000-0000-4000-8000-000000000003';
select pg_temp.check_ok(get_friend_challenges()='[]'::jsonb,'strangers cannot list challenge');
do $$ begin begin perform reply_challenge_invite((select id from saved_challenge),true,'UTC');raise exception 'stranger accepted';exception when raise_exception then if sqlerrm='stranger accepted' then raise;end if;end;end $$;
-- End a disposable fixture period with equal results. All public creation/acceptance already validated above.
update gf_challenges set starts_on=date_trunc('week',now())::date-7,ends_on=date_trunc('week',now())::date-1,invite_until=date_trunc('week',now())-interval '7 days';
update gf_challenge_members set quota=6;
insert into workout_days(user_id,day,activity,minutes,confirmed_at) select u,date_trunc('week',now())::date-7+x,'Caminhada',30,(date_trunc('week',now())::date-7+x)::timestamp+interval '12 hours'
 from unnest(array['a0000000-0000-4000-8000-000000000001'::uuid,'a0000000-0000-4000-8000-000000000002'::uuid]) u cross join generate_series(0,4) x;
delete from workout_days where user_id='a0000000-0000-4000-8000-000000000002' and day=date_trunc('week',now())::date-6;
insert into training_extra_rests(user_id,day,authorized_at) values('a0000000-0000-4000-8000-000000000002',date_trunc('week',now())::date-6,date_trunc('week',now())-interval '6 days');
-- A voluntary Saturday never gives a competitive advantage.
insert into workout_days(user_id,day,activity,minutes,confirmed_at) values('a0000000-0000-4000-8000-000000000001',date_trunc('week',now())::date-2,'Passeio',30,date_trunc('week',now())-interval '1 day 12 hours');
set request.jwt.claim.sub='a0000000-0000-4000-8000-000000000001';
do $$ begin perform get_friend_challenges(); end $$;select get_friend_challenges();
select pg_temp.check_ok((select count(*)=2 from gf_challenges c cross join lateral jsonb_array_elements(c.results) r where (r->>'place')::integer=1),'ties share victory');
select pg_temp.check_ok((select bool_and((r->>'percent')::numeric=100) from gf_challenges c cross join lateral jsonb_array_elements(c.results) r),'effective fulfilled schedules stay 100 percent even if initial quota differed');
select pg_temp.check_ok((select count(*)=2 and sum(amount)=14 from coin_movements where kind='challenge'),'moderate unique 2+5 rewards');
create temp table challenge_baseline as select results from gf_challenges;
update workout_days set minutes=120 where user_id=auth.uid();
do $$ begin perform get_friend_challenges(); end $$;
select pg_temp.check_ok((select c.results=b.results from gf_challenges c cross join challenge_baseline b),'results immutable after settlement');
select pg_temp.check_ok(not has_function_privilege('authenticated','gf_settle_challenge(uuid)','EXECUTE'),'clients cannot choose results or rewards');
do $$ declare kind_value text; id_value uuid; begin
 foreach kind_value in array array['frequency','collective','frequency'] loop
  perform set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000001',true);
  id_value:=create_friend_challenge('Mais atitude',kind_value,7,array['a0000000-0000-4000-8000-000000000002'::uuid],case when kind_value='collective' then 9 end,'UTC');
  perform set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000002',true);
  perform reply_challenge_invite(id_value,true,'UTC');
  update gf_challenges set starts_on=date_trunc('week',now())::date-7,ends_on=date_trunc('week',now())::date-1,invite_until=date_trunc('week',now())-interval '7 days' where id=id_value;
  update gf_challenge_members set quota=5 where challenge_id=id_value;
  perform get_friend_challenges();
 end loop;
end $$;
select pg_temp.check_ok((select count(*)=6 and sum(amount)=37 from coin_movements where kind='challenge'),'monthly cap, frequency ranking and collective reward');
select pg_temp.check_ok(gf_collective_wins('a0000000-0000-4000-8000-000000000001')=1,'collective completion recognized');
select pg_temp.check_ok(not (get_friend_challenges()::text like '%"kg"%'),'challenge response contains no weight');
set request.jwt.claim.sub='a0000000-0000-4000-8000-000000000001';
update training_accounts set time_zone='Pacific/Kiritimati' where user_id='a0000000-0000-4000-8000-000000000002';
select create_friend_challenge('Trinta dias','frequency',30,array['a0000000-0000-4000-8000-000000000002'::uuid],null,'Pacific/Kiritimati');
select pg_temp.check_ok(exists(select 1 from gf_challenges where name='Trinta dias' and ends_on-starts_on=29),'30-day duration supported with pinned owner timezone');
select pg_temp.check_ok((select starts_on>greatest((now() at time zone 'UTC')::date,(now() at time zone 'Pacific/Kiritimati')::date) from gf_challenges where name='Trinta dias'),'starting date is future in both account timezones');
update gf_challenges set invite_until=now()-interval '1 second' where name='Trinta dias';
do $$ begin perform get_friend_challenges();end $$;
select pg_temp.check_ok((select cancelled from gf_challenges where name='Trinta dias'),'expired invitation without two acceptances cancels without reward');
select 'PASS challenges: create, consent, isolation, quotas, voluntary exclusion, ranking, ties, modest idempotent rewards, immutable results';
rollback;
