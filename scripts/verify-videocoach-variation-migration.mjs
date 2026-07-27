import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const sql = await readFile(new URL('../supabase/sql/video-variation-canonicalization-v1.sql', import.meta.url), 'utf8')

assert.match(sql, /^begin;/m)
assert.match(sql, /^commit;/m)
assert.match(sql, /create or replace function public\.entropi_canonical_video_variation_v1/m)
assert.match(sql, /create trigger a_video_analyses_canonical_variation_v1/m)
assert.match(sql, /before insert or update of lift, variation on public\.video_analyses/m)
assert.match(sql, /competition_bench[\s\S]*konkurrence_b_nk_pause/m)
assert.match(sql, /konkurrence_baenk_pause[\s\S]*konkurrence_b_nk_pause/m)
assert.match(sql, /rumaensk_doedloeft[\s\S]*rum_nsk_d_dl_ft/m)
assert.match(sql, /update public\.video_analyses/m)
assert.match(sql, /where variation is distinct from/m)
assert.match(sql, /delete from public\.athlete_baselines_v3[\s\S]*baseline_version = 'approved_median_mad_v1'/m)
assert.match(sql, /perform public\.entropi_recompute_athlete_baseline_v3/m)
assert.doesNotMatch(sql, /delete from public\.video_analyses/i)
assert.doesNotMatch(sql, /truncate/i)
assert.doesNotMatch(sql, /service_role|secret|password/i)

console.log('VideoCoach variation-migrationens sikkerheds- og kompatibilitetskontrakt er gyldig.')
