// ORDRE 2053: RLS for coachens svar på en indsendt video, prøvet i PGlite mod generalprøvens athletes.
// Coachens læsning af rækken og skrivning af svaret (en betinget UPDATE draft til shared, som
// videoSaveApproveShare.mjs sender), og atletens læsning gennem get_my_shared_video_analyses_v3.
// Policies og funktion er kopieret fra supabase/migrations/20260815123142_... og supabase/sql/message-tracks-and-athlete-seen.sql.
// Kun syntetiske personer fra proeveDb.mjs; ingen nøgler, intet net.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRehearsalDb, PEOPLE, ATHLETES } from '../scripts/generalproeve/proeveDb.mjs'

const SCHEMA = `
create table public.video_analyses (
  id uuid primary key default gen_random_uuid(), athlete_id uuid references public.athletes(id), source_mode text, status text,
  lift text, variation text, load_kg numeric, rpe numeric, reps_count int, analyzed_at timestamptz default now(),
  bar_path jsonb, athlete_feedback jsonb, feedback_version text, shared_at timestamptz, athlete_seen_at timestamptz);
alter table public.video_analyses enable row level security;
revoke all on public.video_analyses from anon, authenticated;
grant select, update on public.video_analyses to authenticated;
create policy coach_select_own_athletes on public.video_analyses for select to authenticated
  using (exists (select 1 from public.athletes a where a.id = video_analyses.athlete_id and a.coach_id = (select auth.uid())));
create policy entropi_vc3_coach_update on public.video_analyses for update to authenticated
using (exists (select 1 from public.athletes a where a.id = video_analyses.athlete_id and a.coach_id = (select auth.uid())))
with check (source_mode in ('coach_web', 'desktop_import', 'athlete_submission')
  and exists (select 1 from public.athletes a where a.id = video_analyses.athlete_id and a.coach_id = (select auth.uid())));
create function public.get_my_shared_video_analyses_v3(p_limit integer default 50, p_offset integer default 0)
returns table(id uuid, lift text, athlete_feedback jsonb, athlete_seen_at timestamptz)
language sql stable security definer set search_path to pg_catalog, public as $$
  select va.id, va.lift, va.athlete_feedback, va.athlete_seen_at
  from public.video_analyses va join public.athletes a on a.id = va.athlete_id
  where a.user_id = auth.uid() and va.status = 'shared'
  order by va.analyzed_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 100) offset greatest(coalesce(p_offset, 0), 0)
$$;
revoke execute on function public.get_my_shared_video_analyses_v3(integer, integer) from public, anon;
grant execute on function public.get_my_shared_video_analyses_v3(integer, integer) to authenticated;
`

const FEEDBACK = JSON.stringify({ focus: [{ text: 'hold brystet oppe' }], next_set: [{ text: 'pres gulvet fra start' }] })

test('ordre 2053: coach læser og deler svar for egen atlet, atleten læser det, fremmede og anonym nej', { timeout: 180000 }, async () => {
  const { db } = await createRehearsalDb({ withExtra: false })
  await db.exec(SCHEMA)
  const { coach, athlete, otherCoach } = PEOPLE
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
    } catch (error) { await db.exec('rollback'); return { ok: false, error: error.message } }
  }
  const seed = async athleteId => (await db.query(`insert into public.video_analyses (athlete_id, source_mode, status, lift)
    values ($1, 'athlete_submission', 'draft', 'squat') returning id`, [athleteId])).rows[0].id
  const mine = await seed(ATHLETES.mine)
  const foreign = await seed(ATHLETES.other)
  const share = (person, id) => as(person, `update public.video_analyses set athlete_feedback = $2::jsonb, status = 'shared',
    feedback_version = 'v1' where id = $1 and status = 'draft' returning id, status`, [id, FEEDBACK])

  // Læsning af klippet (rækken): coach for egen atlet ja, fremmed coach og anonym nej.
  assert.equal((await as(coach, 'select id from public.video_analyses where id = $1', [mine])).rows.length, 1)
  assert.equal((await as(otherCoach, 'select id from public.video_analyses where id = $1', [mine])).rows.length, 0)
  assert.equal((await as(null, 'select id from public.video_analyses where id = $1', [mine])).ok, false)

  // Skrivning af svaret: kun egen coach rammer rækken; atleten og fremmed coach opdaterer intet (RLS skjuler rækken).
  assert.equal((await share(athlete, mine)).rows?.length ?? 0, 0, 'atleten kan ikke dele sit eget svar')
  assert.equal((await share(otherCoach, mine)).rows?.length ?? 0, 0, 'fremmed coach kan ikke skrive')
  assert.equal((await share(null, mine)).ok, false)
  assert.equal((await share(coach, foreign)).rows?.length ?? 0, 0, 'coach kan ikke skrive på en fremmed atlets række')
  assert.equal((await as(athlete, 'select id from public.video_analyses where id = $1', [mine])).rows.length, 0, 'atleten ser intet før deling')
  assert.equal((await as(athlete, 'select * from public.get_my_shared_video_analyses_v3()')).rows.length, 0)

  const written = await share(coach, mine)
  assert.deepEqual(written.rows.map(r => r.status), ['shared'])
  // Samme betingede skrivning to gange rammer ikke igen (status er ikke længere draft).
  assert.equal((await share(coach, mine)).rows.length, 0)

  // Atleten læser svaret gennem RPC'en; fremmed atlet og coach ser det ikke.
  const seen = await as(athlete, 'select * from public.get_my_shared_video_analyses_v3()')
  assert.equal(seen.rows.length, 1)
  assert.equal(seen.rows[0].athlete_feedback.focus[0].text, 'hold brystet oppe')
  assert.equal((await as(coach, 'select * from public.get_my_shared_video_analyses_v3()')).rows.length, 0)
  assert.equal((await as(otherCoach, 'select * from public.get_my_shared_video_analyses_v3()')).rows.length, 0)
  assert.equal((await as(null, 'select * from public.get_my_shared_video_analyses_v3()')).ok, false)
})
