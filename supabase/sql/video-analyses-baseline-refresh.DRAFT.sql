-- Entropi VideoCoach: keep each athlete's personal v3 baseline in sync with
-- coach-approved analyses. Prepared locally; do not run before app deploy.
--
-- Baseline contract:
--   * exact athlete + lift + variation + metric method
--   * only coach-approved/shared analyses
--   * tracker low-confidence <= 15%
--   * only metrics explicitly marked eligible_for_baseline
--   * metric confidence must be null or >= 0.75
--   * robust centre = median; robust spread = MAD

begin;

create or replace function public.entropi_recompute_athlete_baseline_v3(
  p_athlete_id uuid,
  p_lift text,
  p_variation text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_baseline_version constant text := 'approved_median_mad_v1';
begin
  if p_athlete_id is null or p_lift is null or p_variation is null then
    return;
  end if;

  -- The cache is fully recomputable. Removing the old slice first also clears
  -- stale metrics when an approved analysis is later marked invalid.
  delete from public.athlete_baselines_v3
  where athlete_id = p_athlete_id
    and lift = p_lift
    and variation = p_variation
    and baseline_version = v_baseline_version;

  insert into public.athlete_baselines_v3 (
    athlete_id,
    lift,
    variation,
    metric_key,
    metric_method,
    baseline_version,
    median,
    mad,
    n_analyses,
    n_reps,
    first_analyzed_at,
    last_analyzed_at,
    filter_spec,
    source_fingerprint,
    updated_at
  )
  with eligible as (
    select
      va.id as analysis_id,
      va.analyzed_at,
      va.updated_at,
      va.reps_count,
      metric.key as metric_key,
      metric.value ->> 'method' as metric_method,
      (metric.value ->> 'value')::numeric as metric_value
    from public.video_analyses va
    cross join lateral jsonb_each(va.metrics) as metric(key, value)
    where va.athlete_id = p_athlete_id
      and va.lift = p_lift
      and va.variation = p_variation
      and va.status in ('coach_approved', 'shared')
      and coalesce(va.low_conf_pct, 0) <= 15
      and jsonb_typeof(metric.value) = 'object'
      and metric.value ->> 'eligible_for_baseline' = 'true'
      and jsonb_typeof(metric.value -> 'value') = 'number'
      and nullif(metric.value ->> 'method', '') is not null
      and (
        metric.value -> 'confidence' is null
        or jsonb_typeof(metric.value -> 'confidence') = 'null'
        or (
          jsonb_typeof(metric.value -> 'confidence') = 'number'
          and (metric.value ->> 'confidence')::numeric >= 0.75
        )
      )
  ),
  centres as (
    select
      metric_key,
      metric_method,
      percentile_cont(0.5) within group (order by metric_value)::numeric as median,
      count(*)::integer as n_analyses,
      coalesce(sum(reps_count), 0)::integer as n_reps,
      min(analyzed_at) as first_analyzed_at,
      max(analyzed_at) as last_analyzed_at,
      md5(string_agg(
        analysis_id::text || ':' || extract(epoch from updated_at)::text,
        ',' order by analysis_id
      )) as source_fingerprint
    from eligible
    group by metric_key, metric_method
  ),
  spreads as (
    select
      eligible.metric_key,
      eligible.metric_method,
      percentile_cont(0.5) within group (
        order by abs(eligible.metric_value - centres.median)
      )::numeric as mad
    from eligible
    join centres using (metric_key, metric_method)
    group by eligible.metric_key, eligible.metric_method
  )
  select
    p_athlete_id,
    p_lift,
    p_variation,
    centres.metric_key,
    centres.metric_method,
    v_baseline_version,
    centres.median,
    coalesce(spreads.mad, 0),
    centres.n_analyses,
    centres.n_reps,
    centres.first_analyzed_at,
    centres.last_analyzed_at,
    jsonb_build_object(
      'statuses', jsonb_build_array('coach_approved', 'shared'),
      'max_low_conf_pct', 15,
      'min_metric_confidence', 0.75,
      'eligible_for_baseline', true,
      'metric_contract', 'exact_method'
    ),
    centres.source_fingerprint,
    now()
  from centres
  join spreads using (metric_key, metric_method);
end
$function$;

revoke all on function public.entropi_recompute_athlete_baseline_v3(uuid, text, text)
  from public, anon, authenticated;

create or replace function public.entropi_refresh_video_analysis_baseline_v3()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  if tg_op = 'DELETE' then
    if old.status in ('coach_approved', 'shared') then
      perform public.entropi_recompute_athlete_baseline_v3(
        old.athlete_id, old.lift, old.variation
      );
    end if;
    return old;
  end if;

  -- If an approved row leaves its previous grouping, refresh that old slice.
  if tg_op = 'UPDATE'
     and old.status in ('coach_approved', 'shared')
     and (
       new.status not in ('coach_approved', 'shared')
       or new.athlete_id is distinct from old.athlete_id
       or new.lift is distinct from old.lift
       or new.variation is distinct from old.variation
     ) then
    perform public.entropi_recompute_athlete_baseline_v3(
      old.athlete_id, old.lift, old.variation
    );
  end if;

  -- INSERT of an approved row, draft -> approved, or edits to an approved row
  -- all converge on one complete refresh of the current slice.
  if new.status in ('coach_approved', 'shared') then
    perform public.entropi_recompute_athlete_baseline_v3(
      new.athlete_id, new.lift, new.variation
    );
  end if;

  return new;
end
$function$;

revoke all on function public.entropi_refresh_video_analysis_baseline_v3()
  from public, anon, authenticated;

drop trigger if exists video_analyses_refresh_baseline_v3
  on public.video_analyses;

create trigger video_analyses_refresh_baseline_v3
after insert or update or delete on public.video_analyses
for each row execute function public.entropi_refresh_video_analysis_baseline_v3();

-- Backfill any rows already approved before this migration is installed.
do $backfill$
declare
  group_row record;
begin
  for group_row in
    select distinct athlete_id, lift, variation
    from public.video_analyses
    where status in ('coach_approved', 'shared')
  loop
    perform public.entropi_recompute_athlete_baseline_v3(
      group_row.athlete_id,
      group_row.lift,
      group_row.variation
    );
  end loop;
end
$backfill$;

commit;
