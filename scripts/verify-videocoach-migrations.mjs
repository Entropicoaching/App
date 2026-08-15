import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'

const migrationsDir = new URL('../supabase/migrations/', import.meta.url)
const sqlDir = new URL('../supabase/sql/', import.meta.url)
const migrationNames = await readdir(migrationsDir)
const legacyNames = await readdir(sqlDir)

async function migration(suffix) {
  const matches = migrationNames.filter(name => name.endsWith(`_${suffix}.sql`))
  assert.equal(matches.length, 1, `Forventede præcis én migration for ${suffix}`)
  return readFile(new URL(matches[0], migrationsDir), 'utf8')
}

assert.equal(legacyNames.some(name => /video-analyses-(athlete-submit|baseline-refresh|review-lifecycle).*DRAFT/i.test(name)),
  false, 'Aktive VideoCoach-databasekontrakter må ikke ligge som DRAFT-filer')

const athlete = await migration('videocoach_athlete_draft_idempotency')
assert.match(athlete, /alter table public\.video_analyses enable row level security/i)
assert.match(athlete, /grant insert on table public\.video_analyses to authenticated/i)
assert.match(athlete, /alter column created_by set default auth\.uid\(\)/i)
assert.match(athlete, /having count\(\*\) > 1[\s\S]*raise exception 'duplicate video_analyses\.client_analysis_id/i)
assert.match(athlete, /create unique index if not exists video_analyses_client_analysis_id_v3_uidx[\s\S]*client_analysis_id/i)
assert.match(athlete, /add constraint video_analyses_v3_payload_bounds check[\s\S]*not valid/i)
assert.match(athlete, /coalesce\(source_mode, ''\) <> 'athlete_submission'[\s\S]*schema_version = 3[\s\S]*schema_v = 3/i)
assert.match(athlete, /reps_count between 1 and 20[\s\S]*rpe is null or rpe between 0 and 10/i)
assert.match(athlete, /jsonb_typeof\(metrics\) = 'object'[\s\S]*jsonb_typeof\(rep_details\) = 'array'/i)
assert.match(athlete, /coach_note is null[\s\S]*bias_note is null/i)
assert.match(athlete, /create policy entropi_vc3_athlete_insert_own_draft[\s\S]*for insert[\s\S]*with check/i)
assert.match(athlete, /with check \([\s\S]*client_analysis_id is not null[\s\S]*schema_version = 3[\s\S]*schema_v = 3/i)
assert.doesNotMatch(athlete, /create policy entropi_vc3_athlete_select_own_draft[\s\S]*for select/i)
assert.match(athlete, /security definer[\s\S]*va\.created_by = \(select auth\.uid\(\)\)[\s\S]*a\.user_id = \(select auth\.uid\(\)\)/i)
assert.match(athlete, /revoke all on function public\.get_my_video_analysis_submission_identity_v3\(uuid\)[\s\S]*from public, anon/i)
assert.match(athlete, /grant execute on function public\.get_my_video_analysis_submission_identity_v3\(uuid\)[\s\S]*to authenticated/i)
assert.match(athlete, /a\.user_id = \(select auth\.uid\(\)\)/i)
assert.doesNotMatch(athlete, /\bto anon\b/i)

const lifecycle = await migration('videocoach_review_lifecycle')
assert.match(lifecycle, /client_analysis_id is immutable/i)
assert.match(lifecycle, /athlete_id is immutable/i)
assert.match(lifecycle, /invalid VideoCoach status transition/i)
assert.match(lifecycle, /new\.status is distinct from old\.status[\s\S]*new\.athlete_seen_at = null/i)
assert.match(lifecycle, /before insert or update on public\.video_analyses/i)

const baseline = await migration('videocoach_baseline_refresh')
assert.match(baseline, /create or replace function public\.entropi_recompute_athlete_baseline_v3/i)
assert.match(baseline, /v_baseline_version constant text := 'approved_median_mad_v2_confident'/i)
assert.match(baseline, /pg_advisory_xact_lock\(pg_catalog\.hashtextextended\(/i)
assert.match(baseline, /security definer/i)
assert.match(baseline, /revoke all on function public\.entropi_recompute_athlete_baseline_v3[\s\S]*from public, anon, authenticated/i)
assert.match(baseline, /va\.low_conf_pct is not null[\s\S]*va\.low_conf_pct <= 15/i)
assert.match(baseline, /jsonb_each\([\s\S]*jsonb_typeof\(va\.metrics\) = 'object'[\s\S]*else '\{\}'::jsonb/i,
  'metrics=[] må give en tom metricmængde i stedet for at abortere review-triggeren')
assert.doesNotMatch(baseline, /jsonb_each\(va\.metrics\)/i)
assert.match(baseline, /case when jsonb_typeof\(metric\.value -> 'value'\) = 'number'[\s\S]*then \(metric\.value ->> 'value'\)::numeric/i,
  "value='abc' må filtreres uden et usikkert numeric-cast")
assert.match(baseline, /case when jsonb_typeof\(metric\.value -> 'confidence'\) = 'number'[\s\S]*then \(metric\.value ->> 'confidence'\)::numeric/i)
assert.match(baseline, /after insert or delete or update of status, athlete_id, lift, variation,[\s\S]*on public\.video_analyses/i)
assert.doesNotMatch(baseline, /after insert or update or delete on public\.video_analyses/i,
  'Irrelevante rækkeopdateringer må ikke genberegne hele baselinen')

for (const [name, sql] of [['athlete', athlete], ['lifecycle', lifecycle], ['baseline', baseline]]) {
  assert.doesNotMatch(sql, /drop table|truncate|service_role|secret|password/i,
    `${name}-migrationen indeholder en forbudt konstruktion`)
}

console.log('VideoCoach-migrationerne er versionsstyrede og opfylder den lokale RLS/lifecycle-kontrakt.')
