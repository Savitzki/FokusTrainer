\ir gamification-fixture.sql
do $$ begin perform get_gamification_state('UTC'); end $$;
do $$ begin perform buy_cosmetic('frame-ember','UTC'); end $$;
do $$ begin perform buy_cosmetic('frame-ember','Pacific/Kiritimati'); end $$;
select pg_temp.check_ok((select balance=900 from coin_wallets where user_id=auth.uid()),'buy once for server price');
select pg_temp.check_ok((select count(*)=1 from coin_movements where user_id=auth.uid() and kind='cosmetic-purchase'),'one traceable permanent purchase');
do $$ begin perform equip_cosmetic('frame','frame-ember','UTC'); end $$;
select pg_temp.check_ok((select item_id='frame-ember' from gf_equipped where user_id=auth.uid()),'equip owned item');
do $$ begin perform equip_cosmetic('frame',null,'UTC'); end $$;
select pg_temp.check_ok(not exists(select 1 from gf_equipped where user_id=auth.uid()),'unequip without removing ownership');
do $$ begin
 begin perform equip_cosmetic('frame','frame-gold','UTC');raise exception 'unowned item equipped';exception when raise_exception then if sqlerrm='unowned item equipped' then raise;end if;end;
 begin perform buy_cosmetic('frame-champion','UTC');raise exception 'locked item bought';exception when raise_exception then if sqlerrm='locked item bought' then raise;end if;end;
end $$;
select economy_post(auth.uid(),'fixture-spend','cosmetic-purchase','Test debit',-900,current_date);
do $$ begin begin perform buy_cosmetic('theme-copper','UTC');raise exception 'negative balance accepted';exception when raise_exception then if sqlerrm='negative balance accepted' then raise;end if;end;end $$;
select pg_temp.check_ok((select balance=0 from coin_wallets where user_id=auth.uid()),'insufficient funds rollback balance');
set request.jwt.claim.sub='a0000000-0000-4000-8000-000000000002';
select pg_temp.check_ok(not exists(select 1 from jsonb_array_elements(gf_cosmetics_state(auth.uid())) x where (x->>'owned')::boolean),'inventory account isolation');
select pg_temp.check_ok(not has_table_privilege('authenticated','gf_inventory','INSERT') and not has_function_privilege('authenticated','economy_post(uuid,text,text,text,integer,date)','EXECUTE'),'server owns inventory and coins');
select pg_temp.check_ok((get_economy_state('UTC')->'rules'->>'kitPrice')::integer=250,'existing kit shop preserved');
select 'PASS cosmetics: one purchase, persistent ownership, equip, unequip, prerequisite, insufficient balance, isolation, kit compatibility';
rollback;
