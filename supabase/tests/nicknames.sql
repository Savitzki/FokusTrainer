begin;
do $$ begin
 if (select md5(coalesce(string_agg(to_jsonb(p)::text,'|' order by id),'')) from profiles p)<>(select digest from nickname_migration_baseline)
 then raise exception 'Migration modified existing profiles';end if;
end $$;
insert into auth.users(id,email) select ('15151515-1515-4515-8515-'||lpad(i::text,12,'0'))::uuid,'nick.fixture.'||i||'@example.invalid' from generate_series(1,5) i;
set local role authenticated;
select set_config('request.jwt.claim.sub','19191919-1919-4919-8919-000000000001',true);
insert into profiles(id,nickname,avatar_color) values(auth.uid(),'Ｗide.Legacy','forest') on conflict(id) do update set nickname=excluded.nickname,avatar_color=excluded.avatar_color;
do $$ begin
 if (select nickname from profiles where id=auth.uid())<>'Ｗide.Legacy' or (select avatar_color from profiles where id=auth.uid())<>'forest' then raise exception 'Legacy spelling/avatar upsert not preserved';end if;
end $$;
select set_config('request.jwt.claim.sub','15151515-1515-4515-8515-000000000001',true);
insert into profiles(id,nickname) values(auth.uid(),'  @Dani.Unique  ');
do $$ declare result jsonb; begin
 if (select nickname from profiles where id=auth.uid())<>'Dani.Unique' then raise exception 'New handle not normalized';end if;
 result:=check_nickname('@ＤＡＮＩ.Unique');
 if not (result->>'available')::boolean then raise exception 'Own handle unavailable';end if;
 begin update profiles set nickname='dani.unique' where id=auth.uid();raise exception 'Case edit allowed';
 exception when raise_exception then if sqlerrm<>'Seu nick é permanente e não pode ser alterado.' then raise;end if;end;
 begin insert into profiles(id,nickname) values(auth.uid(),'New.Handle') on conflict(id) do update set nickname=excluded.nickname;raise exception 'Upsert changed identity';
 exception when raise_exception then if sqlerrm<>'Seu nick é permanente e não pode ser alterado.' then raise;end if;end;
 update profiles set avatar_color='blue' where id=auth.uid();
 if (select avatar_color from profiles where id=auth.uid())<>'blue' then raise exception 'Avatar locked';end if;
 begin perform begin_nickname_login('Dani.Unique');raise exception 'Email resolver exposed';exception when insufficient_privilege then null;end;
 begin perform * from nickname_login_attempts;raise exception 'Login attempts exposed';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','15151515-1515-4515-8515-000000000002',true);
do $$ declare result jsonb; candidate text; begin
 begin insert into profiles(id,nickname) values(auth.uid(),'dani.unique');raise exception 'Case duplicate allowed';exception when unique_violation then null;end;
 begin insert into profiles(id,nickname) values(auth.uid(),'ＤＡＮＩ.Unique');raise exception 'NFKC duplicate allowed';exception when unique_violation then null;end;
 result:=check_nickname('DANI.Unique');
 if (result->>'available')::boolean or jsonb_array_length(result->'suggestions')<>3 then raise exception 'Missing suggestions';end if;
 for candidate in select jsonb_array_elements_text(result->'suggestions') loop
  if length(candidate)>24 or not (check_nickname(candidate)->>'available')::boolean then raise exception 'Invalid/occupied suggestion';end if;
 end loop;
 insert into profiles(id,nickname) values(auth.uid(),result#>>'{suggestions,0}');
 if (check_nickname('bad space')->>'valid')::boolean then raise exception 'Invalid nickname accepted';end if;
 if exists(select 1 from profiles where id<>'15151515-1515-4515-8515-000000000002') then raise exception 'Profiles leaked across users';end if;
end $$;
set local role anon;
do $$ begin
 begin perform check_nickname('Dani.Unique');raise exception 'Guest suggestions exposed';exception when insufficient_privilege then null;end;
 begin perform begin_nickname_login('Dani.Unique');raise exception 'Guest email resolver exposed';exception when insufficient_privilege then null;end;
end $$;
set local role service_role;
do $$ declare result jsonb; i integer; begin
 for i in 1..10 loop
  result:=begin_nickname_login(case when i%2=0 then '@ＤＡＮＩ.Unique' else 'dani.unique' end);
  if not (result->>'allowed')::boolean or result->>'email'<>'nick.fixture.1@example.invalid' then raise exception 'Nickname resolution or rate window incorrect';end if;
 end loop;
 result:=begin_nickname_login('Dani.Unique');
 if (result->>'allowed')::boolean or result->>'email' is not null then raise exception 'Rate exceeded';end if;
 result:=begin_nickname_login('unknown.nick');
 if not (result->>'allowed')::boolean or result->>'email' is not null then raise exception 'Unknown nickname resolved';end if;
end $$;
reset role;
update nickname_login_attempts set window_started_at=clock_timestamp()-interval '16 minutes';
set local role service_role;
do $$ begin
 if not (begin_nickname_login('Dani.Unique')->>'allowed')::boolean then raise exception 'Rate window not reset';end if;
end $$;
rollback;
select 'PASS: immutable unique case/NFKC handles, suggestions, avatars, isolation, private email resolver and throttling' result;
