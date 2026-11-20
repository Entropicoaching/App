// ORDRE 1952 (Marc 20. nov.: "1. ja gr det og 2 ja"): coachen kan sende video for sin egen atlet.
// Udkastet supabase/sql/udkast/20261120190000_video_coach_sender_for_egen_atlet_DRAFT.sql prøves mod
// generalprøvens kopi af produktionens athletes (PGlite, ægte RLS), med lageret og video_analyses
// genskabt efter repoets migrationer. Kun syntetiske personer fra proeveDb.mjs; ingen nøgler, intet net.
import test from 'node:test'
import assert from 'node:assert/strict'
import { PostgrestClient } from '@supabase/postgrest-js'
import { createRehearsalDb, read, PEOPLE, ATHLETES } from '../scripts/generalproeve/proeveDb.mjs'
import { listenPgRest } from '../e2e/pglite-postgrest.mjs'
import { buildAwaitingAnalysisRow, buildVideoUploadPath } from './videoCoachUpload.js'
import { saveVideoCoachDraft } from './videoCoachSubmission.js'

const UP = 'supabase/sql/udkast/20261120190000_video_coach_sender_for_egen_atlet_DRAFT.sql'
const DOWN = 'supabase/sql/udkast/20261120190000_video_coach_sender_for_egen_atlet_DRAFT_ROLLBACK.sql'

// Lageret og video_analyses, som repoets migrationer efterlader dem (kun de dele, sendingen rører):
// vc_upload_athlete_insert_own fra 20260923120000_video_upload_policy_name_fix_v1.sql:14-22,
// entropi_vc3_athlete_insert_own_draft og dublet-opslaget fra 20260815123142_..._idempotency.sql:76-131.
// Coachens læsning (coachen ser videoen) har samme coach-tjek som entropi_vc3_coach_update.
const VIDEO_SCHEMA = `
create schema storage;
grant usage on schema storage to anon, authenticated, service_role;
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text not null, name text not null,
  owner uuid default auth.uid(), unique (bucket_id, name));
alter table storage.objects enable row level security;
grant select, insert on storage.objects to anon, authenticated;
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
create policy "vc_upload_athlete_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'videocoach-uploads' and exists (select 1 from public.athletes a
    where a.id::text = (storage.foldername(objects.name))[1] and a.user_id = (select auth.uid())));
create policy "vc_upload_coach_select" on storage.objects for select to authenticated
  using (bucket_id = 'videocoach-uploads' and exists (select 1 from public.athletes a
    where a.id::text = (storage.foldername(objects.name))[1] and a.coach_id = (select auth.uid())));

create table public.video_analyses (
  id uuid primary key default gen_random_uuid(), client_analysis_id uuid, athlete_id uuid references public.athletes(id),
  athlete_name text, created_by uuid default auth.uid(), schema_version int, schema_v int, source_mode text, status text,
  lift text, variation text, load_kg numeric, rpe numeric, video_path text, analysis_state text,
  coach_note text, bias_note text, session_context jsonb, bar_path jsonb, created_at timestamptz default now());
create unique index video_analyses_client_analysis_id_v3_uidx on public.video_analyses (client_analysis_id);
alter table public.video_analyses enable row level security;
revoke all on public.video_analyses from anon, authenticated;
grant select, insert, update on public.video_analyses to authenticated;
create policy entropi_vc3_athlete_insert_own_draft on public.video_analyses for insert to authenticated
with check (
  created_by = (select auth.uid()) and client_analysis_id is not null and schema_version = 3 and schema_v = 3
  and source_mode = 'athlete_submission' and status = 'draft' and coach_note is null and bias_note is null
  and exists (select 1 from public.athletes a where a.id = video_analyses.athlete_id and a.user_id = (select auth.uid())));
create policy coach_select_own_athletes on public.video_analyses for select to authenticated
  using (exists (select 1 from public.athletes a where a.id = video_analyses.athlete_id and a.coach_id = (select auth.uid())));
create function public.get_my_video_analysis_submission_identity_v3(p_client_analysis_id uuid)
returns table (id uuid, client_analysis_id uuid, athlete_id uuid, status text, created_at timestamptz)
language sql stable security definer set search_path = pg_catalog, public as $function$
  select va.id, va.client_analysis_id, va.athlete_id, va.status::text, va.created_at
  from public.video_analyses va join public.athletes a on a.id = va.athlete_id
  where va.client_analysis_id = p_client_analysis_id and va.source_mode = 'athlete_submission'
    and va.created_by = (select auth.uid()) and a.user_id = (select auth.uid())
  limit 1
$function$;
revoke all on function public.get_my_video_analysis_submission_identity_v3(uuid) from public, anon;
grant execute on function public.get_my_video_analysis_submission_identity_v3(uuid) to authenticated;
`

let counter = 0
const newId = () => `5e000000-0000-4000-8000-${String(++counter).padStart(12, '0')}`

test('ordre 1952: atlet ja, coach for egen atlet ja efter migrationen, fremmed atlet og anonym nej', { timeout: 180000 }, async () => {
  const { db, rest } = await createRehearsalDb({ withExtra: false })
  await db.exec(VIDEO_SCHEMA)
  const { coach, athlete, otherCoach } = PEOPLE

  // Én transaktion pr. forsøg med rollen og claims som PostgREST; nej giver en fejl og ruller tilbage.
  const as = async (person, sql, params = []) => {
    await db.exec('begin')
    try {
      const role = person ? 'authenticated' : 'anon'
      await db.query(`select set_config('request.jwt.claims', $1, true), set_config('request.jwt.claim.sub', $2, true)`,
        [JSON.stringify(person ? { sub: person.id, role } : { role }), person?.id ?? ''])
      await db.exec(`set local role ${role}`)
      const result = await db.query(sql, params)
      await db.exec('commit')
      return { ok: true, rows: result.rows }
    } catch (error) {
      await db.exec('rollback')
      return { ok: false, error: error.message }
    }
  }
  const sendRow = (person, athleteId, clientId = newId()) => as(person, `insert into public.video_analyses
    (client_analysis_id, athlete_id, schema_version, schema_v, source_mode, status, video_path, analysis_state)
    values ($1, $2, 3, 3, 'athlete_submission', 'draft', $3, 'awaiting_analysis')`,
  [clientId, athleteId, `${athleteId}/${clientId}.mp4`])
  const sendClip = (person, athleteId, clientId = newId()) => as(person,
    `insert into storage.objects (bucket_id, name) values ('videocoach-uploads', $1)`, [`${athleteId}/${clientId}.mp4`])
  const matrix = async () => ({
    athleteOwnRow: (await sendRow(athlete, ATHLETES.mine)).ok,
    athleteOwnClip: (await sendClip(athlete, ATHLETES.mine)).ok,
    coachOwnAthleteRow: (await sendRow(coach, ATHLETES.unclaimed)).ok,
    coachOwnAthleteClip: (await sendClip(coach, ATHLETES.unclaimed)).ok,
    coachClaimedAthleteRow: (await sendRow(coach, ATHLETES.mine)).ok,
    coachClaimedAthleteClip: (await sendClip(coach, ATHLETES.mine)).ok,
    coachForeignRow: (await sendRow(coach, ATHLETES.other)).ok,
    coachForeignClip: (await sendClip(coach, ATHLETES.other)).ok,
    otherCoachForeignRow: (await sendRow(otherCoach, ATHLETES.mine)).ok,
    athleteForeignRow: (await sendRow(athlete, ATHLETES.other)).ok,
    athleteForeignClip: (await sendClip(athlete, ATHLETES.other)).ok,
    anonRow: (await sendRow(null, ATHLETES.mine)).ok,
    anonClip: (await sendClip(null, ATHLETES.mine)).ok,
  })
  const foer = {
    athleteOwnRow: true, athleteOwnClip: true,
    coachOwnAthleteRow: false, coachOwnAthleteClip: false, coachClaimedAthleteRow: false, coachClaimedAthleteClip: false,
    coachForeignRow: false, coachForeignClip: false, otherCoachForeignRow: false,
    athleteForeignRow: false, athleteForeignClip: false, anonRow: false, anonClip: false,
  }
  const efter = { ...foer, coachOwnAthleteRow: true, coachOwnAthleteClip: true, coachClaimedAthleteRow: true, coachClaimedAthleteClip: true }

  assert.deepEqual(await matrix(), foer, 'før migrationen: kun atletens eget login')
  await db.exec(read(UP))
  assert.deepEqual(await matrix(), efter, 'efter migrationen: også coachen for sin egen atlet, aldrig en fremmed')

  // Coachen kan ikke snyde med rækkens felter: anden created_by, færdig status eller coachnote giver nej.
  assert.equal((await as(coach, `insert into public.video_analyses (client_analysis_id, athlete_id, created_by, schema_version,
    schema_v, source_mode, status) values ($1, $2, $3, 3, 3, 'athlete_submission', 'draft')`,
  [newId(), ATHLETES.unclaimed, athlete.id])).ok, false)
  assert.equal((await as(coach, `insert into public.video_analyses (client_analysis_id, athlete_id, schema_version, schema_v,
    source_mode, status) values ($1, $2, 3, 3, 'athlete_submission', 'shared')`, [newId(), ATHLETES.unclaimed])).ok, false)
  assert.equal((await as(coach, `insert into public.video_analyses (client_analysis_id, athlete_id, schema_version, schema_v,
    source_mode, status, coach_note) values ($1, $2, 3, 3, 'athlete_submission', 'draft', 'x')`, [newId(), ATHLETES.unclaimed])).ok, false)

  // Appens eget kald gennem PostgREST: coachen sender for sin atlet, og rækken ses bagefter af coachen.
  const server = await listenPgRest(rest, 0)
  try {
    const client = person => new PostgrestClient(`${server.url}/rest/v1`, { schema: 'public',
      headers: { apikey: 'anon-proeve', Authorization: `Bearer tok-${person.id}` } })
    const clientId = newId()
    const path = buildVideoUploadPath(ATHLETES.unclaimed, clientId, 'video/mp4')
    const row = buildAwaitingAnalysisRow({ athleteId: ATHLETES.unclaimed, athleteName: 'Syntetisk', clientAnalysisId: clientId,
      lift: 'squat', variation: 'competition', loadKg: 100, rpe: 8, athleteNote: 'god dybde i bunden', videoPath: path })
    const saved = await saveVideoCoachDraft(client(coach), row, { athleteSubmission: true })
    assert.equal(saved.error ?? null, null)
    assert.equal(saved.data.athlete_id, ATHLETES.unclaimed)
    const seen = await client(coach).from('video_analyses').select('athlete_id,analysis_state,session_context').eq('client_analysis_id', clientId)
    assert.equal(seen.data.length, 1)
    assert.equal(seen.data[0].analysis_state, 'awaiting_analysis')
    assert.equal(seen.data[0].session_context.athlete_note, 'god dybde i bunden')
    const foreignId = newId()
    const foreign = await saveVideoCoachDraft(client(coach), buildAwaitingAnalysisRow({ athleteId: ATHLETES.other, clientAnalysisId: foreignId,
      lift: 'squat', variation: 'competition', videoPath: buildVideoUploadPath(ATHLETES.other, foreignId, 'video/mp4') }), { athleteSubmission: true })
    assert.ok(foreign.error, 'coachen kan ikke sende for en fremmed atlet gennem appen')
  } finally { await server.close?.() }

  // Dublet-opslaget: samme klip sendt igen finder coachens egen afsendelse, men ikke atletens række.
  const coachClip = newId()
  assert.equal((await sendRow(coach, ATHLETES.unclaimed, coachClip)).ok, true)
  const lookup = (person, id) => as(person, 'select * from public.get_my_video_analysis_submission_identity_v3($1)', [id])
  assert.equal((await lookup(coach, coachClip)).rows.length, 1)
  const athleteClip = newId()
  assert.equal((await sendRow(athlete, ATHLETES.mine, athleteClip)).ok, true)
  assert.equal((await lookup(athlete, athleteClip)).rows.length, 1)
  assert.equal((await lookup(coach, athleteClip)).rows.length, 0)
  assert.equal((await lookup(otherCoach, coachClip)).rows.length, 0)

  // Rollback: tilbage til i dag, og atletens egen vej virker stadig.
  await db.exec(read(DOWN))
  assert.deepEqual(await matrix(), foer, 'efter rollback: som før migrationen')
  assert.equal((await lookup(coach, coachClip)).rows.length, 0)
  // Migrationen kan køres to gange (drop if exists / create or replace).
  await db.exec(read(UP)); await db.exec(read(UP))
  assert.deepEqual(await matrix(), efter)
})
