-- Limit future saves only; historical plan versions remain unchanged.
begin;
set local lock_timeout='5s';
set local statement_timeout='45s';
create or replace function public.save_training_plan(p_training_days integer[],p_revision integer,p_timezone text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); a training_accounts; max_scheduled_rest_days constant integer:=2;
begin
 perform get_training_state(p_timezone);
 select * into a from training_accounts where user_id=u for update;
 if p_revision is distinct from a.revision then raise exception 'Sua programação mudou em outro aparelho. Atualize e tente novamente.'; end if;
 if p_training_days is null or cardinality(p_training_days) not between 1 and 7 or
   (select count(distinct d) from unnest(p_training_days) d where d between 1 and 7)<>cardinality(p_training_days)
 then raise exception 'Escolha pelo menos um dia de treino, sem repetir os dias.'; end if;
 if 7-cardinality(p_training_days)>max_scheduled_rest_days then
   raise exception 'Escolha no máximo % dias de descanso.', max_scheduled_rest_days;
 end if;
 insert into training_plans(user_id,revision,effective_on,training_days)
 values(u,a.revision+1,(now() at time zone a.time_zone)::date+1,array(select d from unnest(p_training_days) d order by d));
 update training_accounts set revision=revision+1 where user_id=u;
 return training_state(u);
end $$;
revoke all on function public.save_training_plan(integer[],integer,text) from public,anon,authenticated;
grant execute on function public.save_training_plan(integer[],integer,text) to authenticated;
notify pgrst, 'reload schema';
commit;
