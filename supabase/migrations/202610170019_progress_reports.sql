-- Stage 3. Reports are private; closed-day and closed-week snapshots never change.
begin;
create function public.get_progress_report(p_period text,p_start date,p_timezone text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); d date; last_day date; first_day date; result jsonb;
begin
 perform get_training_state(p_timezone);
 perform gf_sync_missions(u); perform gf_sync_weeks(u);
 select (now() at time zone time_zone)::date into d from training_accounts where user_id=u;
 if p_start is null or p_start<date '2000-01-01' or p_start>d or p_period not in('week','month') or
  p_start<>date_trunc(p_period,p_start)::date then raise exception 'Escolha uma semana ou mês válido.'; end if;
 last_day:=case when p_period='week' then p_start+6 else (p_start+interval '1 month'-interval '1 day')::date end;
 first_day:=greatest(p_start,gf_tracking_start(u));
 with days as (select * from gf_days_between(u,first_day,last_day)), summary as (
  select count(*) filter(where completed) completed,
  count(*) filter(where kind in('training','compensatory')) planned,
  count(*) filter(where kind in('training','compensatory') and (day<d or completed)) due,
  count(*) filter(where kind in('training','compensatory') and completed) mandatory_completed,
  count(*) filter(where kind in('training','compensatory') and day<d and not completed) missed,
  coalesce(sum(minutes) filter(where completed),0) minutes,
  round(avg(minutes) filter(where completed),1) average from days)
 select jsonb_build_object('period',p_period,'start',p_start,'end',last_day,'today',d,'timezone',
 (select time_zone from training_accounts where user_id=u),'partial',last_day>=d or first_day>p_start,
 'summary',(select to_jsonb(s)||jsonb_build_object('compliance',round(100.0*mandatory_completed/nullif(due,0),1)) from summary s),
 'streak',gf_streak(u),
 'days',coalesce((select jsonb_agg(to_jsonb(x) order by day) from days x),'[]'),
 'weeks',coalesce((select jsonb_agg((to_jsonb(w) - 'user_id')||jsonb_build_object('partial',w.week_start<gf_tracking_start(u)) order by week_start) from gf_weeks w where user_id=u and week_start>=p_start-84 and week_start<=last_day),'[]'),
 'goals',coalesce((select jsonb_agg(x order by x->>'weekStart') from
  (select jsonb_build_object('weekStart',week_start,'completed',count(*) filter(where claimed_at is not null),'total',count(*)) x
   from gf_missions where user_id=u and week_start between p_start-84 and last_day group by week_start) a),'[]'),
 'weights',coalesce((select jsonb_agg(jsonb_build_object('id',id,'date',day,'kg',kg,'recordedAt',recorded_at) order by day,recorded_at,id)
  from weight_entries where user_id=u and day between p_start and least(last_day,d)),'[]')) into result;
 return result;
end $$;
revoke all on function public.get_progress_report(text,date,text) from public,anon,authenticated;
grant execute on function public.get_progress_report(text,date,text) to authenticated;
notify pgrst,'reload schema';
commit;
