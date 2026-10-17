-- Retire the removed registration preference while preserving all other metadata.
begin;
set local lock_timeout = '5s';
update auth.users
set raw_user_meta_data = raw_user_meta_data - 'home_state'
where raw_user_meta_data ? 'home_state';
commit;
