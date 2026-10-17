do $$ begin
  if exists(select 1 from auth.users where raw_user_meta_data ? 'home_state') then
    raise exception 'Retired preference remains in metadata';
  end if;
  if (select raw_user_meta_data from auth.users where id='11111111-1111-4111-8111-111111111111')
      is distinct from '{"display_name":"Ana","phrase_treatment":"feminine","custom":true}'::jsonb then
    raise exception 'Cleanup changed unrelated preferences';
  end if;
  if (select raw_user_meta_data from auth.users where id='22222222-2222-4222-8222-222222222222')
      is distinct from '{"display_name":"João","custom":[1,2]}'::jsonb then
    raise exception 'Cleanup changed metadata without the retired preference';
  end if;
  if (select raw_user_meta_data from auth.users where id='33333333-3333-4333-8333-333333333333') is not null then
    raise exception 'Cleanup replaced null metadata';
  end if;
end $$;
select 'PASS: retired preference removed; name, treatment, custom data and null metadata preserved' as result;
