-- IKKE KOERT, kraever Marcs ja.
--
-- ORDRE 370 · Coach Briefing skarpere: training signals v2.
-- Spejl af detectSignalsV2() i src/coachBriefingRules.js (testet mod 7
-- syntetiske atleter i src/coachBriefingRules.test.js). Foer/efter:
-- outputs/briefing-370/FOER.md og EFTER.md.
--
-- Hvad aendres:
--  * Samme funktionsnavn og samme returkolonner som v1
--    (public.entropi_training_signals_v1), saa entropi_coach_briefing_v1, appen
--    og coach_signal_actions virker uaendret. Kun kroppen erstattes.
--  * Nye detektorer (raekker kun naar de fyrer):
--      pain            pas-kommentar med smerteord i denne/sidste uge (alert),
--                      ellers oemhed >=4/5 mindst 3 af 7 dage (context).
--                      Kommentaren citeres aldrig, kun kropsdelen.
--      missed_sessions seneste afsluttede uge: >=2 pas uden logget saet (alert),
--                      1 pas to uger i traek (context).
--      data_conflict   RPE <=-0,75 under plan, men check-ins siger oemhed >=4/5
--                      eller energi <=2/5 i mindst halvdelen (min. 2).
--      pr              personal_records de sidste 7 dage (context).
--  * dropout / stagnation / rpe_drift: samme raekker som v1 for ok/insufficient
--    (appen viser dem), men fyrende raekker har ny tekst:
--      o_headline = fundet med tal (loeft, vaegt x reps, RPE, uge),
--      o_detail   = hvad coachen goer nu (ogsaa i o_metrics->>'action').
--    Stagnation fanger nu plateau (>=3 uger uden ny top, alert hvis
--    topsaettets RPE stiger), ikke kun fald paa 3-ugers-snit. Et fyrende
--    stagnationssignal pr. atlet. RPE-drift naevner det tungeste loeft.
--
-- Antaget skema (ikke verificeret mod prod i denne ordre):
--   sessions(id, week_id, title, session_order, athlete_comment)
--   weeks(id, athlete_id, week_number, start_date)
--   exercises(id, session_id, name)
--   readiness_logs(athlete_id, logged_date, energy, soreness_level, sore_zones)
--   personal_records(athlete_id, exercise_name, weight, reps, created_at)
--
-- Tilbagerulning: koer supabase/sql/training-signals-v1.sql igen, og drop
-- de to hjaelpefunktioner nedenfor.

create or replace function public.entropi_briefing_num(p_value numeric, p_digits int default 1, p_signed boolean default false)
returns text
language sql immutable
set search_path to pg_catalog
as $$
  select case when p_value is null then '?' else
    (case when p_signed then case when p_value >= 0 then '+' else '-' end
          when p_value < 0 then '-' else '' end)
    || replace(to_char(round(abs(p_value), p_digits),
         'FM999990' || case when p_digits > 0 then '.' || repeat('0', p_digits) else '' end), '.', ',')
  end
$$;

-- Vaegt/RPE: heltal uden decimal, ellers en decimal med komma (97,5).
create or replace function public.entropi_briefing_kg(p_value numeric)
returns text
language sql immutable
set search_path to pg_catalog, public
as $$
  select case when p_value is null then '?'
    when p_value = trunc(p_value) then trunc(p_value)::text
    else public.entropi_briefing_num(p_value, 1) end
$$;

create or replace function public.entropi_training_signals_v1()
returns table(
  o_athlete_id uuid, o_athlete_name text, o_detector text, o_severity text,
  o_headline text, o_detail text, o_metrics jsonb
)
language plpgsql stable security definer
set search_path to pg_catalog, public as $$
declare
  NB constant text := 'belt|hack|split|bulgar|goblet|smith|pendul|maskine|machine|leg press|sissy|db |dumbbell|håndvægt';
  PAIN constant text := 'smert|ondt|skade|stikker|jager|pain|hurt|injur';
  MONTHS constant text[] := array['jan.','feb.','mar.','apr.','maj','jun.','jul.','aug.','sep.','okt.','nov.','dec.'];
begin
  return query
  with my as (
    select a.* from public.athletes a
    where a.coach_id = auth.uid() and coalesce(a.hidden,false)=false
  ),
  logs as (
    select el.athlete_id aid, el.logged_at::date d, el.weight, el.reps_completed reps,
      el.rpe_planned, el.rpe_actual, lower(coalesce(ex.name,'')) nm, ex.session_id sid,
      case
        when lower(coalesce(ex.name,'')) ~ NB then null
        when lower(coalesce(ex.name,'')) like '%squat%' then 'Squat'
        when lower(coalesce(ex.name,'')) like '%bænk%' or lower(coalesce(ex.name,'')) like '%bench%' then 'Bænk'
        when lower(coalesce(ex.name,'')) like '%dødløft%' or lower(coalesce(ex.name,'')) like '%deadlift%'
          or lower(coalesce(ex.name,'')) ~ '(^|\s)dl(\s|$)' then 'Dødløft'
      end lift
    from public.exercise_logs el
    join my on my.id = el.athlete_id
    left join public.exercises ex on ex.id = el.exercise_id
    where not coalesce(el.skipped,false) and el.weight is not null
  ),

  -- ── Frafald (v1-regel, ny tekst) ────────────────────────────────────────
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

  -- ── Stagnation v2: plateau siden seneste nye top ────────────────────────
  e as (
    select aid, lift, date_trunc('week',d)::date w, weight, reps, rpe_actual, rpe_planned,
      weight*(1+reps/30.0) e1rm
    from logs where lift is not null and reps between 1 and 12
  ),
  ew as (
    select distinct on (aid, lift, w) aid, lift, w, e1rm best, weight top_w, reps top_r,
      rpe_actual top_rpe, rpe_planned top_plan,
      count(*) over (partition by aid, lift, w) vol
    from e
    order by aid, lift, w, e1rm desc, rpe_actual desc nulls last
  ),
  er as (
    select ew.*,
      row_number() over (partition by aid, lift order by w desc) rn,
      max(best) over (partition by aid, lift order by w rows between unbounded preceding and 1 preceding) prev_max
    from ew
  ),
  stag as (
    select aid, lift, count(*) nweeks,
      max(w) filter (where prev_max is null or best > prev_max*1.005) high_w,
      avg(best) filter (where rn<=3) r3, avg(best) filter (where rn between 4 and 6) p3,
      count(*) filter (where rn between 4 and 6) pweeks,
      sum(vol) filter (where rn<=3) rvol, sum(vol) filter (where rn between 4 and 6) pvol
    from er group by 1,2
  ),
  stag_v as (
    select s.*, m.name, m.status,
      (select count(*) from er x where x.aid=s.aid and x.lift=s.lift and x.w > s.high_w) stalled,
      hi.top_w hi_w, hi.top_r hi_r, hi.top_rpe hi_rpe, lt.top_rpe lt_rpe, lt.top_plan lt_plan,
      coalesce((select wk2.week_number::text from public.weeks wk2
        where wk2.athlete_id=s.aid and date_trunc('week',wk2.start_date)::date = s.high_w
        order by wk2.week_number desc limit 1), null) hi_week,
      round((100.0*s.r3/nullif(s.p3,0)-100)::numeric,1) pct
    from stag s
    join my m on m.id=s.aid
    join er hi on hi.aid=s.aid and hi.lift=s.lift and hi.w=s.high_w
    join er lt on lt.aid=s.aid and lt.lift=s.lift and lt.rn=1
  ),
  stag_x as (
    select v.*,
      case
        when v.nweeks >= 4 and not (coalesce(v.pvol,0) > 0 and v.rvol < 0.7*v.pvol) and v.stalled >= 3
          and v.hi_rpe is not null and v.lt_rpe is not null
          and (v.lt_rpe - v.hi_rpe >= 0.5 or (v.lt_plan is not null and v.lt_rpe >= v.lt_plan + 0.5)) then 'alert'
        when v.nweeks >= 4 and not (coalesce(v.pvol,0) > 0 and v.rvol < 0.7*v.pvol) and v.stalled >= 3 then 'context'
        when v.nweeks >= 4 and not (coalesce(v.pvol,0) > 0 and v.rvol < 0.7*v.pvol) and v.pweeks = 3 and v.pct <= -5 then 'decline'
        when v.nweeks<6 or v.r3 is null or v.p3 is null then 'insufficient'
        when v.rvol < 0.7*v.pvol then 'insufficient'
        else 'ok' end kind
    from stag_v v
  ),
  stag_r as (
    select x.*,
      case when x.kind in ('alert','context','decline')
        then row_number() over (partition by x.aid, (x.kind in ('alert','context','decline'))
          order by case x.kind when 'alert' then 0 else 1 end, x.stalled desc) end frn,
      count(*) filter (where x.kind in ('alert','context','decline')) over (partition by x.aid) nfiring
    from stag_x x
  ),

  -- ── RPE v2: pr. loeft + check-in-modstrid ───────────────────────────────
  rw as (
    select * from logs
    where rpe_actual is not null and rpe_planned is not null and d>current_date-21
  ),
  -- Som v1: en raekke pr. atlet med mindst et log.
  rpe as (
    select l.aid, m.name,
      count(*) filter (where l.rpe_actual is not null and l.rpe_planned is not null and l.d>current_date-21) n21,
      count(*) filter (where l.rpe_actual is not null and l.rpe_planned is not null and l.rpe_actual<>l.rpe_planned and l.d>current_date-21) ndiff,
      avg(l.rpe_actual-l.rpe_planned) filter (where l.rpe_actual is not null and l.rpe_planned is not null and l.d>current_date-21) drift
    from logs l join my m on m.id=l.aid group by 1,2
  ),
  rpe_lift as (
    select aid, coalesce(lift,'Øvrige') lift, avg(rpe_actual-rpe_planned) ldrift
    from rw group by 1,2
  ),
  rpe_top as (
    select distinct on (r.aid) r.aid, l.lift top_lift, l.ldrift top_drift
    from rpe r join rpe_lift l on l.aid=r.aid
    order by r.aid, (l.lift='Øvrige'),
      case when r.drift>=0 then -l.ldrift else l.ldrift end, l.lift
  ),
  chk as (
    select my.id aid,
      count(rl.*) n,
      count(rl.*) filter (where rl.soreness_level>=4 or rl.energy<=2) tired
    from my left join public.readiness_logs rl
      on rl.athlete_id=my.id and rl.logged_date>current_date-21 and rl.logged_date<=current_date
    group by 1
  ),
  rpe_v as (
    select r.*, t.top_lift, t.top_drift, c.n chk_n, c.tired chk_tired,
      case
        when r.n21<20 then 'insufficient'
        when r.ndiff < greatest(4, r.n21*0.1) then 'insufficient'
        when r.drift>=0.75 then 'alert'
        when r.drift<=-0.75 and c.n>=2 and c.tired >= greatest(2, ceil(c.n/2.0)) then 'conflict'
        when r.drift<=-0.75 then 'context'
        else 'ok' end verdict,
      case when t.top_lift='Øvrige' then 'belastningen' else lower(t.top_lift) end lift_word
    from rpe r left join rpe_top t on t.aid=r.aid left join chk c on c.aid=r.aid
  ),

  -- ── Smerte ──────────────────────────────────────────────────────────────
  pain_hit as (
    select distinct on (wk.athlete_id) wk.athlete_id aid, wk.week_number, s.title, s.id sid,
      case
        when s.athlete_comment ~* 'knæ|knae|knee' then 'knæet'
        when s.athlete_comment ~* 'hofte|hip' then 'hoften'
        when s.athlete_comment ~* 'lyske' then 'lysken'
        when s.athlete_comment ~* 'lænd|ryg|back' then 'ryggen'
        when s.athlete_comment ~* 'skulder|shoulder' then 'skulderen'
        when s.athlete_comment ~* 'albue|elbow' then 'albuen'
        when s.athlete_comment ~* 'håndled|haandled|wrist' then 'håndleddet'
        when s.athlete_comment ~* 'ankel|ankle' then 'anklen'
        when s.athlete_comment ~* 'nakke|neck' then 'nakken'
      end part,
      (select l.lift from logs l where l.sid=s.id and l.lift is not null
        group by l.lift order by count(*) desc, l.lift limit 1) lift
    from public.sessions s
    join public.weeks wk on wk.id=s.week_id
    join my on my.id=wk.athlete_id
    where wk.start_date >= date_trunc('week',current_date)::date - 7
      and s.athlete_comment ~* PAIN
    order by wk.athlete_id, wk.start_date desc, s.session_order desc nulls last, s.id desc
  ),
  sore as (
    select rl.athlete_id aid, count(*) days,
      (select string_agg(distinct z, '/') from public.readiness_logs r2,
        jsonb_array_elements_text(coalesce(to_jsonb(r2.sore_zones),'[]'::jsonb)) z
        where r2.athlete_id=rl.athlete_id and r2.logged_date>current_date-7
          and r2.logged_date<=current_date and r2.soreness_level>=4) zones
    from public.readiness_logs rl join my on my.id=rl.athlete_id
    where rl.logged_date>current_date-7 and rl.logged_date<=current_date and rl.soreness_level>=4
    group by rl.athlete_id
  ),
  pain_v as (
    select m.id aid, m.name, h.week_number, h.title, h.part, h.lift, h.sid is not null hit,
      coalesce(so.days,0) sore_days, so.zones,
      case when coalesce(so.days,0)>0
        then 'ømhed ≥4/5' || coalesce(' i '||so.zones,'') || ' ' || so.days || ' af de sidste 7 dage' end sore_text
    from my m left join pain_hit h on h.aid=m.id left join sore so on so.aid=m.id
    where h.sid is not null or coalesce(so.days,0)>=3
  ),

  -- ── Fremmoede: seneste afsluttede uge ───────────────────────────────────
  fw as (
    select wk.*, row_number() over (partition by wk.athlete_id order by wk.start_date desc) wrn
    from public.weeks wk join my on my.id=wk.athlete_id
    where wk.start_date + 7 <= current_date
      and exists (select 1 from public.sessions s where s.week_id=wk.id)
  ),
  fw_miss as (
    select fw.athlete_id aid, fw.wrn, fw.week_number, fw.start_date,
      count(s.*) planned,
      count(s.*) filter (where not exists (select 1 from logs l where l.sid=s.id)) missed,
      string_agg(s.title, ', ' order by s.session_order nulls last, s.title)
        filter (where not exists (select 1 from logs l where l.sid=s.id)) missed_titles
    from fw join public.sessions s on s.week_id=fw.id
    where fw.wrn<=2
    group by 1,2,3,4
  ),
  miss_v as (
    select m.id aid, m.name, a.week_number, a.start_date, a.planned, a.missed, a.missed_titles,
      coalesce(b.missed,0) prev_missed,
      case when a.missed>=2 then 'alert'
        when a.missed=1 and coalesce(b.missed,0)>=1 then 'context' end verdict
    from my m
    join fw_miss a on a.aid=m.id and a.wrn=1
    left join fw_miss b on b.aid=m.id and b.wrn=2
    where m.status is distinct from 'ferie'
      and not (m.vacation_until is not null and m.vacation_until>=current_date)
  ),

  -- ── PR ──────────────────────────────────────────────────────────────────
  pr_recent as (
    select p.athlete_id aid, p.exercise_name, p.weight, p.reps, p.created_at,
      row_number() over (partition by p.athlete_id order by p.created_at desc) prn,
      count(*) over (partition by p.athlete_id) n,
      prev.weight prev_w, prev.reps prev_r
    from public.personal_records p
    join my on my.id=p.athlete_id
    left join lateral (
      select p2.weight, p2.reps from public.personal_records p2
      where p2.athlete_id=p.athlete_id and p2.exercise_name=p.exercise_name and p2.created_at<p.created_at
      order by p2.weight*(1+p2.reps/30.0) desc limit 1
    ) prev on true
    where p.created_at::date > current_date-7 and p.created_at::date <= current_date
  ),
  pr_v as (
    select pr.aid, m.name, max(pr.n) n,
      string_agg(pr.exercise_name || ' ' || public.entropi_briefing_kg(pr.weight) || '×' || pr.reps
        || ' (' || extract(day from pr.created_at)::int || '. ' || MONTHS[extract(month from pr.created_at)::int]
        || coalesce('; før ' || public.entropi_briefing_kg(pr.prev_w) || '×' || pr.prev_r, '') || ')',
        ' og ' order by pr.created_at) parts
    from pr_recent pr join my m on m.id=pr.aid
    where pr.prn<=2
    group by pr.aid, m.name
  )

  -- ── Output ──────────────────────────────────────────────────────────────
  select pv.aid, pv.name, 'pain'::text,
    case when pv.hit then 'alert' else 'context' end,
    case when pv.hit then
      pv.name||': melder ondt i '||coalesce(pv.part,'kroppen')||' (pas-kommentar, uge '||pv.week_number||', '||pv.title
        ||coalesce(' med '||lower(pv.lift),'')||')'||coalesce('; '||pv.sore_text,'')
    else pv.name||': '||pv.sore_text end,
    x.action,
    jsonb_build_object('action',x.action,'sore_days_7d',pv.sore_days,'body_part',pv.part,'lift',pv.lift,'week',pv.week_number)
  from pain_v pv
  cross join lateral (select case when pv.hit
    then 'Kontakt i dag, før næste '||coalesce(lower(pv.lift)||'-pas','pas')||'. Skift til en smertefri variant og lavere vægt, indtil det er afklaret'
    else 'Spørg ind: kommer det fra træningen eller hverdagen? Overvej at tage toppen af volumen næste uge' end action) x
  union all
  select mv.aid, mv.name, 'missed_sessions'::text, mv.verdict,
    mv.name||': mistede '||mv.missed||' af '||mv.planned||' pas i uge '||mv.week_number||' ('
      ||extract(day from mv.start_date)::int||'.-'||extract(day from mv.start_date+6)::int||'. '
      ||MONTHS[extract(month from mv.start_date+6)::int]||'): '||mv.missed_titles
      ||case when mv.verdict='context' then ' (og 1 pas ugen før)' else '' end,
    x.action,
    jsonb_build_object('action',x.action,'week',mv.week_number,'planned',mv.planned,'missed',mv.missed)
  from miss_v mv
  cross join lateral (select case mv.verdict
    when 'alert' then 'Skriv i dag og spørg hvorfor, før næste uge lægges. Er tiden problemet, så gør ugen til '||greatest(1,mv.planned-1)||' pas'
    else 'Spørg ind ved næste check-in: passer antallet af pas til ugen?' end action) x
  where mv.verdict is not null
  union all
  select d.aid, d.name, 'dropout'::text, d.verdict,
    case d.verdict
      when 'alert' then d.name||': træningen er faldet til '||public.entropi_briefing_num(d.rpw)||' sæt/uge de sidste 30 dage (normalt '||round(d.norm)||')'
      when 'context' then d.name||': træningen er dalet til '||public.entropi_briefing_num(d.rpw)||' sæt/uge de sidste 30 dage (normalt '||round(d.norm)||')'
      when 'insufficient' then d.name||': for spinkelt grundlag for frafalds-varsel'
      else d.name||': træningsmængde stabil' end,
    case d.verdict
      when 'alert' then 'Ring eller skriv i dag: hvad er der sket? Læg en kortere uge ind, hvis livet fylder'
      when 'context' then 'Hold øje, og spørg ind ved næste check-in'
      when 'insufficient' then 'kræver ≥3 aktive uger med normal mængde'
      else d.rpw||' sæt/uge (norm '||round(d.norm)||')' end,
    jsonb_build_object('recent_per_week',d.rpw,'norm_per_week',d.norm,'active_weeks',d.aw,'sets_30d',d.s30)
      || case d.verdict
        when 'alert' then jsonb_build_object('action','Ring eller skriv i dag: hvad er der sket? Læg en kortere uge ind, hvis livet fylder')
        when 'context' then jsonb_build_object('action','Hold øje, og spørg ind ved næste check-in')
        else '{}'::jsonb end
  from dropout d
  union all
  select sv.aid, sv.name, 'stagnation'::text,
    case sv.kind when 'decline' then 'context' else sv.kind end,
    case sv.kind
      when 'alert' then sv.name||': '||sv.lift||' stået stille '||sv.stalled||' uger ('||public.entropi_briefing_kg(sv.hi_w)||'×'||sv.hi_r
        ||' siden '||coalesce('uge '||sv.hi_week, extract(day from sv.high_w)::int||'. '||MONTHS[extract(month from sv.high_w)::int])
        ||'), RPE '||public.entropi_briefing_kg(sv.hi_rpe)||'→'||public.entropi_briefing_kg(sv.lt_rpe)||' mod plan '||public.entropi_briefing_kg(sv.lt_plan)
      when 'context' then sv.name||': '||sv.lift||' fladt '||sv.stalled||' uger ('||public.entropi_briefing_kg(sv.hi_w)||'×'||sv.hi_r
        ||' siden '||coalesce('uge '||sv.hi_week, extract(day from sv.high_w)::int||'. '||MONTHS[extract(month from sv.high_w)::int])
        ||'), RPE uændret'||coalesce(' @'||public.entropi_briefing_kg(sv.lt_rpe),'')
      when 'decline' then sv.name||': '||sv.lift||' e1RM faldet '||round(sv.p3)||'→'||round(sv.r3)||' kg ('||public.entropi_briefing_num(sv.pct)||' %) på 3 uger med samme volumen'
      when 'insufficient' then sv.name||': '||sv.lift||' — for lidt grundlag'
      else sv.name||': '||sv.lift||' i fremgang' end
      || case when sv.frn=1 and sv.nfiring>1 then ' (+'||(sv.nfiring-1)||' løft mere fladt)' else '' end,
    coalesce(x.action, case when sv.kind='insufficient' then 'kræver ≥6 ugers data og bevaret volumen'
      else sv.lift||' e1RM '||round(sv.p3)||'→'||round(sv.r3)||' kg ('||sv.pct||'%)' end),
    jsonb_build_object('lift',sv.lift,'recent3_e1rm',round(sv.r3::numeric,1),'prior3_e1rm',round(sv.p3::numeric,1),
      'pct_change',sv.pct,'recent_vol',sv.rvol,'prior_vol',sv.pvol,'weeks',sv.nweeks,'status',sv.status,
      'stalled_weeks',sv.stalled,'rpe_from',sv.hi_rpe,'rpe_to',sv.lt_rpe,'rpe_planned',sv.lt_plan)
      || case when x.action is not null then jsonb_build_object('action',x.action) else '{}'::jsonb end
  from stag_r sv
  cross join lateral (select case sv.kind
    when 'alert' then 'Overvej deload eller en variation (fx pause- eller tempo-'||lower(sv.lift)||') i næste blok'
    when 'context' then 'Ikke akut: har planen bedt om mere? Ellers +2,5 kg næste uge'
    when 'decline' then 'Tjek søvn og restitution, bed om en video af '||lower(sv.lift)||', og overvej deload'
    end action) x
  -- Et fyrende stagnationssignal pr. atlet; ikke-fyrende raekker som i v1.
  where sv.frn is null or sv.frn=1
  union all
  select rv.aid, rv.name, 'rpe_drift'::text,
    case rv.verdict when 'conflict' then 'insufficient' else rv.verdict end,
    case rv.verdict
      when 'alert' then rv.name||': RPE i snit '||public.entropi_briefing_num(rv.drift,1,true)||' over plan de sidste 3 uger ('||rv.n21||' sæt); mest på '
        ||rv.top_lift||' '||public.entropi_briefing_num(rv.top_drift,1,true)
      when 'context' then rv.name||': RPE i snit '||public.entropi_briefing_num(rv.drift,1,true)||' under plan de sidste 3 uger ('||rv.n21||' sæt); mest på '
        ||rv.top_lift||' '||public.entropi_briefing_num(rv.top_drift,1,true)
      when 'conflict' then rv.name||': RPE-log modstrider check-ins (se Datatjek)'
      when 'insufficient' then rv.name||': ingen uafhængig RPE-log'
      else rv.name||': RPE følger planen' end,
    coalesce(x.action, case rv.verdict
      when 'conflict' then 'RPE-loggen bruges ikke, før den er afklaret'
      when 'insufficient' then 'atleten logger ikke faktisk RPE adskilt fra plan'
      else 'afvigelse '||round(rv.drift::numeric,2)||' RPE ('||rv.n21||' sæt)' end),
    jsonb_build_object('avg_drift',round(rv.drift::numeric,2),'sets_21d',rv.n21,'sets_differing',rv.ndiff,
      'top_lift',rv.top_lift,'top_lift_drift',round(rv.top_drift::numeric,2))
      || case when x.action is not null then jsonb_build_object('action',x.action) else '{}'::jsonb end
  from rpe_v rv
  cross join lateral (select case
    when rv.verdict='alert' and rv.drift>=1.25 then 'Sænk '||rv.lift_word||' ~5 % næste uge, og spørg til søvn, stress og restitution'
    when rv.verdict='alert' then 'Hold belastningen næste uge i stedet for at øge; spørg til restitution'
    when rv.verdict='context' then 'Plads til mere: øg '||rv.lift_word||' 2,5-5 % næste uge'
    end action) x
  union all
  select rv.aid, rv.name, 'data_conflict'::text, 'context'::text,
    rv.name||': modstridende data: RPE i snit '||public.entropi_briefing_num(rv.drift,1,true)||' under plan (3 uger, '||rv.n21
      ||' sæt), men ømhed ≥4/5 eller energi ≤2/5 i '||rv.chk_tired||' af '||rv.chk_n||' check-ins',
    'Øg ikke belastningen endnu: afklar, om RPE logges rigtigt, eller om træthed bliver skjult',
    jsonb_build_object('action','Øg ikke belastningen endnu: afklar, om RPE logges rigtigt, eller om træthed bliver skjult',
      'avg_drift',round(rv.drift::numeric,2),'sets_21d',rv.n21,'checkins_21d',rv.chk_n,'tired_checkins',rv.chk_tired)
  from rpe_v rv
  where rv.verdict='conflict'
  union all
  select p.aid, p.name, 'pr'::text, 'context'::text,
    p.name||': PR på '||p.parts,
    'Anerkend det i en kort besked; planen virker, ingen ændring nødvendig',
    jsonb_build_object('action','Anerkend det i en kort besked; planen virker, ingen ændring nødvendig','prs_7d',p.n)
  from pr_v p;
end $$;

grant execute on function public.entropi_training_signals_v1() to authenticated;
