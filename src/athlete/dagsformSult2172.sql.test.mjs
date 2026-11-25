// Ordre 2172: migrationsudkastet for kort Dagsform (readiness_logs.hunger og null i motivation, stress og soreness_level)
// prøvet i PGlite mod generalprøvens skema (produktionens katalog 8. nov. plus kostplanen, som den blev kørt live).
// readiness_logs står ikke i katalogudtrækket; prøven giver tabellen appens kolonner (docs/tracking-dataordbog.md)
// i værste fald: motivation, stress og soreness_level NOT NULL, og RLS som i produktionen (atlet egne rækker, coach egne atleter).
// Appens kald går gennem generalprøvens PostgREST med rigtige roller. Kun syntetiske personer.
import test from 'node:test'
import assert from 'node:assert/strict'
import { PGlite } from '@electric-sql/pglite'
import { createRehearsalDb, read, PEOPLE, ATHLETES } from '../../scripts/generalproeve/proeveDb.mjs'

const UP = 'supabase/sql/udkast/20261124000000_dagsform_sult_kostklient_DRAFT.sql'
const DOWN = 'supabase/sql/udkast/20261124000000_dagsform_sult_kostklient_DRAFT_ROLLBACK.sql'

// Appens readiness_logs i værste fald, oven på generalprøvens tre kolonner.
const APP_KOLONNER = `
alter table public.readiness_logs add column sleep_hours numeric, add column motivation integer not null,
  add column stress integer not null, add column sore_zones text[], add column readiness_score integer;
alter table public.readiness_logs alter column soreness_level set not null;
grant select, insert, update, delete on public.readiness_logs to authenticated;
`
const POLICIES = `
create policy readiness_athlete_own on public.readiness_logs for all to authenticated
  using (athlete_id in (select id from public.athletes where user_id = (select auth.uid())))
  with check (athlete_id in (select id from public.athletes where user_id = (select auth.uid())));
create policy readiness_coach_read on public.readiness_logs for select to authenticated
  using (athlete_id in (select id from public.athletes where coach_id = (select auth.uid())));
`
async function prøveDb({ policies = true } = {}) {
  const r = await createRehearsalDb({ PGlite })
  await r.db.exec(APP_KOLONNER + (policies ? POLICIES : ''))
  return r
}
const tok = person => `tok-${person.id}`
const post = (r, person, body) => r.rest.handle({ method: 'POST', table: 'readiness_logs', params: new URLSearchParams(), body,
  headers: { authorization: `Bearer ${tok(person)}`, prefer: 'return=minimal' } })
const get = (r, person) => r.rest.handle({ method: 'GET', table: 'readiness_logs', params: new URLSearchParams('select=*'), body: null,
  headers: { authorization: `Bearer ${tok(person)}` } })
const skema = async db => JSON.stringify((await db.query(`select column_name, data_type, is_nullable from information_schema.columns
  where table_schema = 'public' and table_name = 'readiness_logs' order by column_name`)).rows) +
  JSON.stringify((await db.query(`select conname, pg_get_constraintdef(oid) d from pg_constraint
    where conrelid = 'public.readiness_logs'::regclass order by 1`)).rows) +
  JSON.stringify((await db.query(`select policyname, cmd, qual, with_check from pg_policies where tablename = 'readiness_logs' order by 1`)).rows)
const kort = (dato, sult) => ({ athlete_id: ATHLETES.mine, logged_date: dato, sleep_hours: 7.5, energy: 4,
  motivation: null, stress: null, soreness_level: null, sore_zones: null, readiness_score: 80, ...(sult === undefined ? {} : { hunger: sult }) })
const fuld = dato => ({ athlete_id: ATHLETES.mine, logged_date: dato, sleep_hours: 8, energy: 3, motivation: 3, stress: 2,
  soreness_level: 1, sore_zones: null, readiness_score: 70 })

test('før migrationen (live i dag): sult giver 42703, kort Dagsform i værste fald 23502; fuld Dagsform virker', async () => {
  const r = await prøveDb()
  assert.equal((await post(r, PEOPLE.athlete, kort('2026-11-20', 2))).body.code, '42703')
  assert.equal((await post(r, PEOPLE.athlete, kort('2026-11-20'))).body.code, '23502')
  assert.equal((await post(r, PEOPLE.athlete, fuld('2026-11-20'))).status, 201)
})

test('fremad: sult gemmes, kort og fuld Dagsform virker, RLS uændret, to kørsler giver samme skema', async () => {
  const r = await prøveDb()
  const policiesFør = JSON.stringify((await r.db.query(`select policyname, cmd, qual, with_check from pg_policies where tablename = 'readiness_logs' order by 1`)).rows)
  await r.rest.exec(read(UP))
  const efterEn = await skema(r.db)
  await r.rest.exec(read(UP))
  assert.equal(await skema(r.db), efterEn, 'anden kørsel ændrer intet')
  assert.equal(JSON.stringify((await r.db.query(`select policyname, cmd, qual, with_check from pg_policies where tablename = 'readiness_logs' order by 1`)).rows), policiesFør)
  assert.equal((await post(r, PEOPLE.athlete, kort('2026-11-21', 2))).status, 201)
  assert.equal((await post(r, PEOPLE.athlete, kort('2026-11-22'))).status, 201)
  assert.equal((await post(r, PEOPLE.athlete, fuld('2026-11-23'))).status, 201)
  assert.equal((await post(r, PEOPLE.athlete, kort('2026-11-24', 7))).body.code, '23514', 'sult uden for 1 til 5 afvises')
  // Fremmed atlet må ikke skrive i min atlets række; fremmed coach ser intet; egen coach ser rækkerne.
  assert.equal((await post(r, PEOPLE.otherAthlete, kort('2026-11-25', 3))).status, 403)
  assert.equal((await get(r, PEOPLE.otherCoach)).body.length, 0)
  const coach = (await get(r, PEOPLE.coach)).body
  assert.equal(coach.length, 3)
  assert.equal(coach.find(x => x.logged_date === '2026-11-21').hunger, 2)
  assert.equal((await get(r, PEOPLE.athlete)).body.length, 3)
})

test('fremad stopper uden policies, og intet er ændret', async () => {
  const r = await prøveDb({ policies: false })
  const før = await skema(r.db)
  await assert.rejects(r.rest.exec(read(UP)), /ingen policies/)
  await r.db.exec('rollback').catch(() => {})
  assert.equal(await skema(r.db), før)
})

test('tilbage: nægter og bevarer data, når der er gemt sult (Marc 3. nov.: "ingen sletning")', async () => {
  const r = await prøveDb()
  await r.rest.exec(read(UP))
  assert.equal((await post(r, PEOPLE.athlete, kort('2026-11-21', 2))).status, 201)
  const før = await skema(r.db)
  await assert.rejects(r.rest.exec(read(DOWN)), /tilbagerulning stoppet/)
  await r.db.exec('rollback').catch(() => {})
  assert.equal(await skema(r.db), før, 'kolonnen står stadig')
  assert.equal((await r.db.query('select hunger from public.readiness_logs')).rows[0].hunger, 2, 'sulten er bevaret')
})

test('tilbage uden gemt sult: kolonnen fjernes, kan køres to gange, og fremad igen giver samme skema', async () => {
  const r = await prøveDb()
  await r.rest.exec(read(UP))
  const op = await skema(r.db)
  assert.equal((await post(r, PEOPLE.athlete, kort('2026-11-22'))).status, 201)
  await r.rest.exec(read(DOWN))
  await r.rest.exec(read(DOWN))
  const cols = (await r.db.query(`select column_name from information_schema.columns where table_name = 'readiness_logs'`)).rows.map(x => x.column_name)
  assert.equal(cols.includes('hunger'), false)
  assert.equal(Number((await r.db.query('select count(*) n from public.readiness_logs')).rows[0].n), 1, 'rækken er bevaret')
  await r.rest.exec(read(UP))
  assert.equal(await skema(r.db), op)
})
