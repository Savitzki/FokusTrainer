-- Disposable database only. Exercise cleanup of legacy account metadata.
update auth.users set raw_user_meta_data = '{"home_state":"SP","display_name":"Ana","phrase_treatment":"feminine","custom":true}'::jsonb
where id='11111111-1111-4111-8111-111111111111';
update auth.users set raw_user_meta_data = '{"display_name":"João","custom":[1,2]}'::jsonb
where id='22222222-2222-4222-8222-222222222222';
update auth.users set raw_user_meta_data = null
where id='33333333-3333-4333-8333-333333333333';
