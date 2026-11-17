// Ordre 1611: den rigtige briefing-SQL (koert i produktion 26. jul.) og den nye
// coach-besked-ved-behov-v1.sql i PGlite med syntetiske atleter. Svaret koeres gennem
// n8n-flowets egen kontraktkontrol og filter, saa det beviser, hvad mailen faar.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { MELDINGER } from './meldModel.mjs'

const fil = navn => readFileSync(new URL(`../../../${navn}`, import.meta.url), 'utf8')
const gammel = fil('supabase/sql/coach-briefing-v1.sql')
const ny = fil('supabase/sql/coach-besked-ved-behov-v1.sql')
const tilbage = fil('supabase/sql/coach-besked-ved-behov-v1_ROLLBACK.sql')
const flow = JSON.parse(fil('n8n/coach-briefing-v1.json'))
const kode = navn => flow.nodes.find(n => n.name === navn).parameters.jsCode

const coach = '00000000-0000-4000-8000-0000000000c0'
const [atletA, atletB, skjult] = ['a1', 'b2', 'c3'].map(x => `00000000-0000-4000-8000-0000000000${x}`)

async function db() {
  const d = new PGlite()
  await d.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create table public.profiles(id uuid primary key, role text);
    create table public.athletes(id uuid primary key, name text, coach_id uuid, hidden boolean);
    create table public.messages(id uuid primary key default gen_random_uuid(), athlete_id uuid, sender_role text,
      content text, category text, read_by_coach boolean, created_at timestamptz not null default now());
    create table public.video_analyses(id uuid primary key default gen_random_uuid(), athlete_id uuid, lift text,
      variation text, load_kg numeric, reps_count int, status text, created_at timestamptz default now());
    create table public.coach_signal_actions(coach_id uuid, athlete_id uuid, detector text, snoozed_until timestamptz, signal_fingerprint text);
    create table public.fake_signals(coach_id uuid, athlete_id uuid, name text, detector text, severity text, lift text);
    create function public.entropi_training_signals_v1()
    returns table(o_athlete_id uuid, o_athlete_name text, o_detector text, o_severity text, o_headline text, o_detail text, o_metrics jsonb)
    language sql stable as $$
      select athlete_id, name, detector, severity, name || ': ' || lift || ' stået stille 3 uger', 'Overvej deload eller en variation',
        jsonb_build_object('lift', lift, 'action', 'Overvej deload eller en variation')
      from public.fake_signals where coach_id = auth.uid() $$;
    insert into public.profiles values ('${coach}', 'coach');
    insert into public.athletes values ('${atletA}', 'Atlet A', '${coach}', false), ('${atletB}', 'Atlet B', '${coach}', false),
      ('${skjult}', 'Atlet C', '${coach}', true);
  `)
  await d.exec(gammel)
  return d
}

async function kald(d) {
  await d.exec(`select set_config('request.jwt.claims', '{"role":"service_role"}', false)`)
  const { rows } = await d.query('select public.entropi_coach_briefing_v1($1) as svar', [coach])
  return rows[0].svar
}

// n8n-flowets egne noder: kontraktkontrol og filteret, der afgoer om der mailes.
function n8n(svar) {
  const item = { json: JSON.parse(JSON.stringify(svar)) }
  const $ = () => ({ first: () => ({ json: { coachId: coach } }) })
  const valider = new Function('$input', '$', kode('Validate briefing contract'))
  valider({ first: () => item }, $)
  const behold = new Function('$input', '$execution', kode('Keep unresolved backup items'))
  return behold({ first: () => item }, { mode: 'trigger' })
}

async function med(fn) {
  const d = await db()
  try { await fn(d) } finally { await d.close() }
}

test('1611: knappernes tekster er netop dem SQL-filen laeser', () => {
  for (const m of Object.values(MELDINGER)) assert.ok(ny.includes(`'${m.tekst}'`), m.tekst)
})

test('1611: gammel daglig briefing mailer ulaeste beskeder og videoer (foer)', () => med(async d => {
  await d.exec(`insert into public.messages(athlete_id, sender_role, content, category, created_at)
    values ('${atletA}', 'athlete', 'hej', 'besked', now() - interval '2 days');
    insert into public.video_analyses(athlete_id, lift, status, created_at) values ('${atletB}', 'Squat', 'draft', now() - interval '3 days')`)
  const ud = n8n(await kald(d))
  assert.equal(ud.length, 1)
  assert.equal(ud[0].json.unread_messages.length, 1)
  assert.equal(ud[0].json.video_drafts.length, 1)
}))

test('1611: efter SQL ingen daglig mail for beskeder, videoer eller andre signaler', () => med(async d => {
  await d.exec(ny)
  await d.exec(`insert into public.messages(athlete_id, sender_role, content, category, created_at)
    values ('${atletA}', 'athlete', 'hej', 'besked', now() - interval '2 days');
    insert into public.video_analyses(athlete_id, lift, status, created_at) values ('${atletB}', 'Squat', 'draft', now() - interval '3 days');
    insert into public.fake_signals values ('${coach}', '${atletA}', 'Atlet A', 'rpe_drift', 'alert', 'Squat'),
      ('${coach}', '${atletB}', 'Atlet B', 'stagnation', 'context', 'Bænkpres'), ('${coach}', '${atletB}', 'Atlet B', 'pain', 'alert', 'Squat')`)
  const svar = await kald(d)
  assert.deepEqual([svar.unread_messages, svar.video_drafts, svar.training_signals], [[], [], []])
  assert.deepEqual(n8n(svar), [])
}))

test('1611: syg og skadet giver een mail pr. atlet, uden forslag', () => med(async d => {
  await d.exec(ny)
  await d.exec(`insert into public.messages(athlete_id, sender_role, content, category) values
    ('${atletA}', 'athlete', '${MELDINGER.syg.tekst}', 'besked'),
    ('${atletA}', 'athlete', '${MELDINGER.syg.tekst}', 'besked'),
    ('${atletB}', 'athlete', '${MELDINGER.skadet.tekst}', 'besked'),
    ('${skjult}', 'athlete', '${MELDINGER.syg.tekst}', 'besked'),
    ('${atletB}', 'coach', '${MELDINGER.syg.tekst}', 'besked')`)
  const ud = n8n(await kald(d))
  assert.equal(ud.length, 1)
  const signaler = ud[0].json.training_signals
  assert.deepEqual(signaler.map(x => [x.athlete_name, x.detector, x.severity, x.headline]), [
    ['Atlet A', 'syg', 'alert', 'Atlet A: Meldt syg'],
    ['Atlet B', 'pain', 'alert', 'Atlet B: Meldt skadet'],
  ])
  for (const x of signaler) {
    assert.equal(x.detail, null)
    assert.deepEqual(x.metrics, {})
    assert.doesNotMatch(x.headline, /overvej|variation|kg/i)
  }
}))

test('1611: en melding mailes kun de foerste 2 doegn, en gammel melding aldrig', () => med(async d => {
  await d.exec(ny)
  await d.exec(`insert into public.messages(athlete_id, sender_role, content, category) values ('${atletA}', 'athlete', '${MELDINGER.skadet.tekst}', 'besked');
    insert into public.messages(athlete_id, sender_role, content, category, created_at)
      values ('${atletB}', 'athlete', '${MELDINGER.syg.tekst}', 'besked', now() - interval '3 days')`)
  assert.equal((await kald(d)).training_signals.length, 1)
  await d.exec(`update public.coach_besked_haendelser_v1 set foerst_set = foerst_set - interval '49 hours'`)
  assert.deepEqual((await kald(d)).training_signals, [])
}))

test('1611: tid til deload kommer een gang pr. haendelse og igen efter 7 dage uden', () => med(async d => {
  await d.exec(ny)
  await d.exec(`insert into public.fake_signals values ('${coach}', '${atletA}', 'Atlet A', 'stagnation', 'alert', 'Squat')`)
  const foerste = (await kald(d)).training_signals
  assert.deepEqual(foerste.map(x => [x.detector, x.headline]), [['deload', 'Atlet A: Tid til deload/deintensivering (Squat)']])
  assert.doesNotMatch(JSON.stringify(foerste), /Overvej|variation/)
  // Signalet staar stadig: efter 2 doegn naevnes det ikke igen.
  await d.exec(`update public.coach_besked_haendelser_v1 set foerst_set = now() - interval '3 days'`)
  assert.deepEqual((await kald(d)).training_signals, [])
  // Vaek i over 7 dage og saa tilbage: ny haendelse.
  await d.exec(`update public.coach_besked_haendelser_v1 set foerst_set = now() - interval '20 days', sidst_set = now() - interval '8 days'`)
  assert.equal((await kald(d)).training_signals.length, 1)
}))

test('1611: kun service_role, og tilbageruldning giver den daglige briefing igen', () => med(async d => {
  await d.exec(ny)
  await d.exec(`select set_config('request.jwt.claims', '{"role":"authenticated"}', false)`)
  await assert.rejects(d.query('select public.entropi_coach_briefing_v1($1)', [coach]), /requires service_role/)
  await d.exec(tilbage)
  await d.exec(`insert into public.messages(athlete_id, sender_role, content, category, created_at)
    values ('${atletA}', 'athlete', 'hej', 'besked', now() - interval '2 days')`)
  assert.equal((await kald(d)).unread_messages.length, 1)
}))
