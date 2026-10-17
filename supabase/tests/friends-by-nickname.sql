begin;
insert into auth.users(id,email) select ('18181818-1818-4818-8818-'||lpad(i::text,12,'0'))::uuid,'friend.fixture.'||i||'@example.invalid' from generate_series(1,3) i;
insert into profiles(id,nickname) select ('18181818-1818-4818-8818-'||lpad(i::text,12,'0'))::uuid,'Nick.Friend.'||i from generate_series(1,3) i;
set local role anon;
do $$ begin
 begin perform find_friend_by_nickname('Nick.Friend.1');raise exception 'Guest search allowed';exception when insufficient_privilege then null;end;
 begin perform send_friend_request_by_nickname('Nick.Friend.1');raise exception 'Guest request allowed';exception when insufficient_privilege then null;end;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','18181818-1818-4818-8818-000000000001',true);
do $$ declare result jsonb; i integer; begin
 result:=find_friend_by_nickname('@ＮＩＣＫ.Friend.2');
 if result->>'relationship'<>'none' or result->>'nickname'<>'Nick.Friend.2' or (select count(*) from jsonb_object_keys(result))<>4 then raise exception 'Search incorrect or extra personal data exposed';end if;
 if find_friend_by_nickname('not.existing') is not null then raise exception 'Missing nick returned a profile';end if;
 begin perform send_friend_request_by_nickname('Nick.Friend.1');raise exception 'Self request allowed';
 exception when raise_exception then if sqlerrm<>'Esse é o seu nick. Busque outra pessoa.' then raise;end if;end;
 for i in 1..2 loop perform send_friend_request_by_nickname('@nick.friend.2');end loop;
 result:=find_friend_by_nickname('Nick.Friend.2');
 if result->>'relationship'<>'outgoing' or result->>'requestId' is null then raise exception 'Outgoing request missing';end if;
 begin perform reply_friend_request((result->>'requestId')::uuid,true);raise exception 'Sender accepted own request';
 exception when raise_exception then if sqlerrm<>'Convite indisponível.' then raise;end if;end;
 begin perform create_streak_group('Too early',array['18181818-1818-4818-8818-000000000002'::uuid],'UTC');raise exception 'Arena allowed before friendship consent';
 exception when raise_exception then if sqlerrm<>'Convide somente amigos que aceitaram seu pedido.' then raise;end if;end;
end $$;
select set_config('request.jwt.claim.sub','18181818-1818-4818-8818-000000000003',true);
do $$ declare request uuid; begin
 -- Search does not authorize accepting someone else's friendship.
 select (find_friend_by_nickname('Nick.Friend.1')->>'requestId')::uuid into request;
 if request is not null then raise exception 'Third-party request exposed';end if;
end $$;
select set_config('request.jwt.claim.sub','18181818-1818-4818-8818-000000000002',true);
do $$ declare result jsonb; begin
 result:=find_friend_by_nickname('@nick.friend.1');
 if result->>'relationship'<>'incoming' then raise exception 'Recipient cannot see request';end if;
 perform reply_friend_request((result->>'requestId')::uuid,true);
 if find_friend_by_nickname('Nick.Friend.1')->>'relationship'<>'friend' then raise exception 'Accepted friendship missing';end if;
end $$;
select set_config('request.jwt.claim.sub','18181818-1818-4818-8818-000000000001',true);
select create_streak_group('Accepted friends',array['18181818-1818-4818-8818-000000000002'::uuid],'UTC');
reset role;
do $$ begin
 if (select count(*) from friendships where requester='18181818-1818-4818-8818-000000000001' and recipient='18181818-1818-4818-8818-000000000002')<>1 then raise exception 'Duplicate request created';end if;
 if (select status from group_members where user_id='18181818-1818-4818-8818-000000000002' and group_id in(select id from streak_groups where name='Accepted friends'))<>'invited' then raise exception 'Arena consent bypassed';end if;
end $$;
rollback;
select 'PASS: nickname search, request deduplication, recipient-only acceptance, privacy and Arena consent' result;
