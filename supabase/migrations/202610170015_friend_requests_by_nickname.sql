-- Requires 014. Reuses the existing consent and Arena invitation rules.
begin;
do $$ begin
 if to_regclass('public.profiles_unique_nickname') is null then raise exception 'Aplique a migração 014 de nicks únicos primeiro.';end if;
end $$;
create or replace function public.find_friend_by_nickname(p_nickname text) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare u uuid:=social_require_profile(); p profiles; f friendships; n text:=regexp_replace(btrim(normalize(p_nickname,NFKC)),'^@',''); relationship text;
begin
 if n is null or n !~ '^[[:alnum:]_.-]{3,24}$' then raise exception 'Informe o nick completo do amigo.';end if;
 select * into p from profiles where lower(normalize(nickname,NFKC))=lower(n);
 if not found then return null;end if;
 select * into f from friendships where least(requester,recipient)=least(u,p.id) and greatest(requester,recipient)=greatest(u,p.id);
 relationship:=case when p.id=u then 'self' when f.status='accepted' then 'friend' when f.status='pending' and f.requester=u then 'outgoing' when f.status='pending' then 'incoming' else 'none' end;
 return jsonb_build_object('id',p.id,'nickname',p.nickname,'relationship',relationship,'requestId',case when f.status='pending' then f.id else null end);
end $$;
create or replace function public.send_friend_request_by_nickname(p_nickname text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=social_require_profile(); target profiles; n text:=regexp_replace(btrim(normalize(p_nickname,NFKC)),'^@','');
begin
 if n is null or n !~ '^[[:alnum:]_.-]{3,24}$' then raise exception 'Informe o nick completo do amigo.';end if;
 select * into target from profiles where lower(normalize(nickname,NFKC))=lower(n);
 if not found then raise exception 'Esse nick não foi encontrado.';end if;
 if target.id=u then raise exception 'Esse é o seu nick. Busque outra pessoa.';end if;
 perform send_friend_request(target.friend_code);
end $$;
revoke all on function public.find_friend_by_nickname(text),public.send_friend_request_by_nickname(text) from public,anon,authenticated;
grant execute on function public.find_friend_by_nickname(text),public.send_friend_request_by_nickname(text) to authenticated;
notify pgrst,'reload schema';
commit;
