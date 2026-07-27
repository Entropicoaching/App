-- Entropi VideoCoach: keep legacy, corrected and human-readable variation
-- aliases in one personal baseline group. The existing production keys remain
-- canonical so the migration does not split or rewrite working history.
-- Applied to production 2026-07-27 after Marc's explicit approval.

begin;

create or replace function public.entropi_canonical_video_variation_v1(
  p_lift text,
  p_variation text
)
returns text
language sql
immutable
set search_path = pg_catalog
as $function$
  select case lower(btrim(coalesce(p_variation, '')))
    when '' then case lower(btrim(coalesce(p_lift, '')))
      when 'squat' then 'konkurrence_squat'
      when 'bench' then 'konkurrence_b_nk_pause'
      when 'deadlift' then 'konkurrence_konventionel'
      else 'standard'
    end
    when 'standard' then case lower(btrim(coalesce(p_lift, '')))
      when 'squat' then 'konkurrence_squat'
      when 'bench' then 'konkurrence_b_nk_pause'
      when 'deadlift' then 'konkurrence_konventionel'
      else 'standard'
    end

    when 'competition_squat' then 'konkurrence_squat'
    when 'konkurrence squat' then 'konkurrence_squat'
    when 'konkurrence_squat' then 'konkurrence_squat'
    when 'low-bar squat' then 'low_bar_squat'
    when 'low bar squat' then 'low_bar_squat'
    when 'low_bar_squat' then 'low_bar_squat'
    when 'high-bar squat' then 'high_bar_squat'
    when 'high bar squat' then 'high_bar_squat'
    when 'high_bar_squat' then 'high_bar_squat'
    when 'pause squat' then 'pause_squat'
    when 'pause_squat' then 'pause_squat'
    when 'tempo squat' then 'tempo_squat'
    when 'tempo_squat' then 'tempo_squat'
    when 'front squat' then 'front_squat'
    when 'front_squat' then 'front_squat'
    when 'safety-bar squat' then 'safety_bar_squat'
    when 'safety bar squat' then 'safety_bar_squat'
    when 'safety_bar_squat' then 'safety_bar_squat'
    when 'box squat' then 'box_squat'
    when 'box_squat' then 'box_squat'

    when 'competition_bench' then 'konkurrence_b_nk_pause'
    when 'competition_bench_pause' then 'konkurrence_b_nk_pause'
    when 'konkurrence bænk' then 'konkurrence_b_nk_pause'
    when 'konkurrence bænk (pause)' then 'konkurrence_b_nk_pause'
    when 'konkurrence_baenk' then 'konkurrence_b_nk_pause'
    when 'konkurrence_baenk_pause' then 'konkurrence_b_nk_pause'
    when 'konkurrence_b_nk_pause' then 'konkurrence_b_nk_pause'
    when 'touch-and-go bænk' then 'touch_and_go_b_nk'
    when 'touch_and_go_baenk' then 'touch_and_go_b_nk'
    when 'touch_and_go_b_nk' then 'touch_and_go_b_nk'
    when 'close-grip bænk' then 'close_grip_b_nk'
    when 'close_grip_baenk' then 'close_grip_b_nk'
    when 'close_grip_b_nk' then 'close_grip_b_nk'
    when 'wide-grip bænk' then 'wide_grip_b_nk'
    when 'wide_grip_baenk' then 'wide_grip_b_nk'
    when 'wide_grip_b_nk' then 'wide_grip_b_nk'
    when 'spoto press' then 'spoto_press'
    when 'spoto_press' then 'spoto_press'
    when 'incline bænk' then 'incline_b_nk'
    when 'incline_baenk' then 'incline_b_nk'
    when 'incline_b_nk' then 'incline_b_nk'

    when 'competition_conventional' then 'konkurrence_konventionel'
    when 'konkurrence konventionel' then 'konkurrence_konventionel'
    when 'konkurrence_konventionel' then 'konkurrence_konventionel'
    when 'pause deadlift' then 'pause_deadlift'
    when 'pause_deadlift' then 'pause_deadlift'
    when 'deficit deadlift' then 'deficit_deadlift'
    when 'deficit_deadlift' then 'deficit_deadlift'
    when 'block pull' then 'block_pull'
    when 'block_pull' then 'block_pull'
    when 'rumænsk dødløft' then 'rum_nsk_d_dl_ft'
    when 'rumaensk_doedloeft' then 'rum_nsk_d_dl_ft'
    when 'rum_nsk_d_dl_ft' then 'rum_nsk_d_dl_ft'
    when 'competition_sumo' then 'konkurrence_sumo'
    when 'konkurrence sumo' then 'konkurrence_sumo'
    when 'konkurrence_sumo' then 'konkurrence_sumo'
    when 'pause sumo' then 'pause_sumo'
    when 'pause_sumo' then 'pause_sumo'
    when 'deficit sumo' then 'deficit_sumo'
    when 'deficit_sumo' then 'deficit_sumo'
    when 'sumo block pull' then 'sumo_block_pull'
    when 'sumo_block_pull' then 'sumo_block_pull'
    else lower(btrim(p_variation))
  end
$function$;

revoke all on function public.entropi_canonical_video_variation_v1(text, text)
  from public, anon, authenticated;

create or replace function public.entropi_normalize_video_analysis_variation_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  new.variation := public.entropi_canonical_video_variation_v1(
    new.lift,
    new.variation
  );
  return new;
end
$function$;

revoke all on function public.entropi_normalize_video_analysis_variation_v1()
  from public, anon, authenticated;

drop trigger if exists a_video_analyses_canonical_variation_v1
  on public.video_analyses;

create trigger a_video_analyses_canonical_variation_v1
before insert or update of lift, variation on public.video_analyses
for each row execute function public.entropi_normalize_video_analysis_variation_v1();

-- Existing rows are only touched when an alias differs from the established
-- production identity. The current three keys therefore remain unchanged.
update public.video_analyses
set variation = public.entropi_canonical_video_variation_v1(lift, variation)
where variation is distinct from
  public.entropi_canonical_video_variation_v1(lift, variation);

-- This table is a fully recomputable cache. Rebuild its sole active version in
-- the same transaction so no observer can see a partially normalized history.
delete from public.athlete_baselines_v3
where baseline_version = 'approved_median_mad_v1';

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
