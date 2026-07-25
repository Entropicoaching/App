-- Analyse-lag v1: regelbaserede, forklarlige detektorer (frafald, stagnation,
-- RPE-drift). Én sandhed for app + søndags-review. Additiv: kun ny SECURITY
-- DEFINER-funktion, ingen data røres. Anvendt på prod 2026-07-25 via migration
-- training_signals_v1 (+ _fix_ambiguous). severity: alert | context |
-- insufficient | ok.
--
-- Tærskler (kalibreret mod eksisterende data, verificeret før UI):
--  Frafald:  norm = median af aktive uger (>=10 saet) foer seneste 30 dage;
--            kraever >=3 aktive uger og norm>=15/uge; alert < 0.4x norm,
--            context < 0.65x; ferie/vacation_until => insufficient.
--  Stagnation: recent-3-ugers snit bedste-e1RM (Epley, barbell hovedloeft) vs
--            prior-3; kraever >=6 ugers data OG bevaret volumen (>=0.7x); context
--            ved fald <= -5%. Aldrig 'alert' (offseason = fladt e1RM forventet).
--  RPE-drift: kun ved UAFHAENGIG actual-log (>=20 saet/21d OG >=10% afviger fra
--            plan; ellers insufficient); alert >= +0.75, context <= -0.75.

drop function if exists public.entropi_training_signals_v1();
create function public.entropi_training_signals_v1()
returns table(
  o_athlete_id uuid, o_athlete_name text, o_detector text, o_severity text,
  o_headline text, o_detail text, o_metrics jsonb
)
language plpgsql stable security definer
set search_path to pg_catalog, public as $$
declare NB constant text := 'belt|hack|split|bulgar|goblet|smith|pendul|maskine|machine|leg press|sissy|db |dumbbell|håndvægt';
begin
  return query
  with my as (
    select a.* from public.athletes a
    where a.coach_id = auth.uid() and coalesce(a.hidden,false)=false
  ),
  logs as (
    select el.athlete_id aid, el.logged_at::date d, el.weight, el.reps_completed reps,
      el.rpe_planned, el.rpe_actual, lower(coalesce(ex.name,'')) nm
    from public.exercise_logs el
    join my on my.id = el.athlete_id
    left join public.exercises ex on ex.id = el.exercise_id
    where not coalesce(el.skipped,false) and el.weight is not null
  ),
  wk as (select aid, date_trunc('week',d)::date w, count(*) s from logs group by 1,2),
  base as (select aid, percentile_cont(0.5) within group (order by s) norm, count(*) aw
    from wk where s>=10 and w < date_trunc('week',(current_date-30)::timestamp) group by 1),
  rec as (select aid, count(*) s30 from logs where d>current_date-30 group by 1),
  dropout as (
    select m.id aid, m.name, b.norm, b.aw, coalesce(r.s30,0) s30,
      round((coalesce(r.s30,0)/(30.0/7))::numeric,1) rpw,
      case
        when m.status='ferie' or (m.vacation_until is not null and m.vacation_until>=current_date) then 'insufficient'
        when b.aw is null or b.aw<3 or b.norm<15 then 'insufficient'
        when coalesce(r.s30,0)/(30.0/7) < 0.4*b.norm then 'alert'
        when coalesce(r.s30,0)/(30.0/7) < 0.65*b.norm then 'context'
        else 'ok' end verdict
    from my m left join base b on b.aid=m.id left join rec r on r.aid=m.id
  ),
  e as (
    select aid, date_trunc('week',d)::date w, weight*(1+reps/30.0) e1rm,
      case
        when nm like '%squat%' and nm !~ NB then 'Squat'
        when (nm like '%bænk%' or nm like '%bench%') and nm !~ NB then 'Bænk'
        when (nm like '%dødløft%' or nm like '%deadlift%' or nm ~ '(^|\s)dl(\s|$)') and nm !~ NB then 'Dødløft'
      end lift
    from logs where reps between 1 and 12
  ),
  ew as (select aid, lift, w, max(e1rm) best, count(*) vol from e where lift is not null group by 1,2,3),
  er as (select *, row_number() over (partition by aid,lift order by w desc) rn from ew),
  stag as (
    select aid, lift, count(*) nweeks,
      avg(best) filter (where rn<=3) r3, avg(best) filter (where rn between 4 and 6) p3,
      sum(vol) filter (where rn<=3) rvol, sum(vol) filter (where rn between 4 and 6) pvol
    from er group by 1,2
  ),
  stag_v as (
    select s.*, m.name, m.status,
      round((100.0*s.r3/nullif(s.p3,0)-100)::numeric,1) pct,
      case
        when s.nweeks<6 or s.r3 is null or s.p3 is null then 'insufficient'
        when s.rvol < 0.7*s.pvol then 'insufficient'
        when (100.0*s.r3/nullif(s.p3,0)-100) <= -5 then 'context'
        else 'ok' end verdict
    from stag s join my m on m.id=s.aid
  ),
  rpe as (
    select aid,
      count(*) filter (where rpe_actual is not null and rpe_planned is not null and d>current_date-21) n21,
      count(*) filter (where rpe_actual is not null and rpe_planned is not null and rpe_actual<>rpe_planned and d>current_date-21) ndiff,
      avg(rpe_actual-rpe_planned) filter (where rpe_actual is not null and rpe_planned is not null and d>current_date-21) drift
    from logs group by 1
  ),
  rpe_v as (
    select r.*, m.name,
      case
        when r.n21<20 then 'insufficient'
        when r.ndiff < greatest(4, r.n21*0.1) then 'insufficient'
        when r.drift>=0.75 then 'alert'
        when r.drift<=-0.75 then 'context'
        else 'ok' end verdict
    from rpe r join my m on m.id=r.aid
  )
  select d.aid, d.name, 'dropout'::text, d.verdict,
    case d.verdict when 'alert' then d.name||': træningen er faldet markant'
      when 'context' then d.name||': træningen er dalet lidt'
      when 'insufficient' then d.name||': for spinkelt grundlag for frafalds-varsel'
      else d.name||': træningsmængde stabil' end,
    case when d.verdict in ('alert','context') then d.rpw||' sæt/uge nu mod '||round(d.norm)||' historisk'
      when d.verdict='insufficient' then 'kræver ≥3 aktive uger med normal mængde'
      else d.rpw||' sæt/uge (norm '||round(d.norm)||')' end,
    jsonb_build_object('recent_per_week',d.rpw,'norm_per_week',d.norm,'active_weeks',d.aw,'sets_30d',d.s30)
  from dropout d
  union all
  select sv.aid, sv.name, 'stagnation'::text, sv.verdict,
    case sv.verdict when 'context' then sv.name||': '||sv.lift||' e1RM fladt/faldende'
      when 'insufficient' then sv.name||': '||sv.lift||' — for lidt grundlag' else sv.name||': '||sv.lift||' i fremgang' end,
    case when sv.verdict='context' then sv.lift||' e1RM '||round(sv.p3)||'→'||round(sv.r3)||' kg ('||sv.pct||'%) over 3 uger, volumen bevaret'
      when sv.verdict='insufficient' then 'kræver ≥6 ugers data og bevaret volumen'
      else sv.lift||' e1RM '||round(sv.p3)||'→'||round(sv.r3)||' kg ('||sv.pct||'%)' end,
    jsonb_build_object('lift',sv.lift,'recent3_e1rm',round(sv.r3::numeric,1),'prior3_e1rm',round(sv.p3::numeric,1),'pct_change',sv.pct,'recent_vol',sv.rvol,'prior_vol',sv.pvol,'weeks',sv.nweeks,'status',sv.status)
  from stag_v sv
  union all
  select rv.aid, rv.name, 'rpe_drift'::text, rv.verdict,
    case rv.verdict when 'alert' then rv.name||': træner tungere end planlagt'
      when 'context' then rv.name||': træner lettere end planlagt'
      when 'insufficient' then rv.name||': ingen uafhængig RPE-log' else rv.name||': RPE følger planen' end,
    case when rv.verdict in ('alert','context') then 'snit-afvigelse '||round(rv.drift::numeric,2)||' RPE over 3 uger ('||rv.n21||' sæt)'
      when rv.verdict='insufficient' then 'atleten logger ikke faktisk RPE adskilt fra plan'
      else 'afvigelse '||round(rv.drift::numeric,2)||' RPE ('||rv.n21||' sæt)' end,
    jsonb_build_object('avg_drift',round(rv.drift::numeric,2),'sets_21d',rv.n21,'sets_differing',rv.ndiff)
  from rpe_v rv;
end $$;
grant execute on function public.entropi_training_signals_v1() to authenticated;
