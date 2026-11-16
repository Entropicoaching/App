// Ordre 1537a: skriv-forslag --send efter coachens ja i chatten. Ugen skal ende præcis som
// efter "Send uge til atleten": godkendt af atletens egen coach, synlig for atleten straks.
// Mod den live kostplan-pakke i PGlite med den syntetiske testatlet. Ingen nøgler, intet net.
import test from 'node:test'
import assert from 'node:assert/strict'
import { PostgrestClient } from '@supabase/postgrest-js'
import { ATHLETES, PEOPLE, createRehearsalDb } from '../generalproeve/proeveDb.mjs'
import { listenPgRest } from '../../e2e/pglite-postgrest.mjs'
import { FOODS } from '../../src/entropi2/kostplan/foedevarer/catalog.mjs'
import { createPlanAdapter } from '../../src/entropi2/kostplan/planAdapter.mjs'
import { plusDage, readClaudeWeek } from '../../src/entropi2/kostplan/coach/claudeWeekModel.mjs'
import { skrivForslag } from './skriv-forslag.mjs'

const id = new Map(FOODS.map(food => [food.name, food.id]))
const meal = (name, items) => ({ name, portions: items.map(([vare, grams]) => ({ foodId: id.get(vare), grams })) })
const dag = () => [
  meal('Morgenmad', [['Havregryn', 90], ['Skyr naturel', 250], ['Banan', 120], ['Blåbær', 100]]),
  meal('Frokost', [['Rugbrød', 150], ['Kyllingebryst', 125], ['Agurk', 100], ['Tomat', 100]]),
  meal('Mellemmåltid', [['Skyr naturel', 200], ['Mandler', 25], ['Æble', 150]]),
  meal('Aftensmad', [['Ris kogt', 400], ['Laks fersk', 175], ['Broccoli', 200], ['Olivenolie', 10]]),
  meal('Aftensnack', [['Hytteost', 150], ['Knækbrød', 40]]),
]
const kbh = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Copenhagen', year: 'numeric', month: '2-digit', day: '2-digit' })
const today = kbh.format(new Date())
const athlete = { id: ATHLETES.mine, kcal_target: 2800, protein_target: 180 }
const ugeplan = (patch = {}) => ({ athleteId: ATHLETES.mine, goal: 'vedligehold', intensity: 0.5,
  rationale: 'Syntetisk testuge med fem måltider om dagen omkring træningen.',
  basisAsOf: today, targets: { kcal: 2800, protein: 180, as_of: today },
  days: Array.from({ length: 7 }, (_, i) => ({ date: plusDage(today, i), meals: dag() })), ...patch })

async function scene() {
  const rehearsal = await createRehearsalDb()
  const server = await listenPgRest(rehearsal.rest, 0)
  const clientFor = person => {
    const rest = new PostgrestClient(`${server.url}/rest/v1`, { schema: 'public',
      headers: { apikey: 'anon-proeve', Authorization: `Bearer tok-${person.id}` } })
    return { from: table => rest.from(table) }
  }
  const atletSer = date => createPlanAdapter({ enabled: true, client: clientFor(PEOPLE.athlete),
    athleteId: ATHLETES.mine, date }).loadActive({ freshAvailability: true })
  return { ...rehearsal, coach: clientFor(PEOPLE.coach), atletSer,
    close: async () => { await server.close(); await rehearsal.db.close() } }
}

test('--send: ugen er sendt af atletens coach, og atleten ser den straks', { timeout: 60000 }, async () => {
  const s = await scene()
  try {
    const { sql } = await skrivForslag(ugeplan(), { send: true })
    assert.equal((sql.match(/insert into public\.kostplan_v1_approvals/g) ?? []).length, 1)
    await s.db.exec(sql)
    assert.equal(await s.count('kostplan_v1_plans'), 7)
    assert.equal(await s.count('kostplan_v1_approvals'), 7)
    const { rows } = await s.db.query(`select p.status, ap.coach_id, ap.approval_kind, ap.athlete_id
      from public.kostplan_v1_plans p join public.kostplan_v1_approvals ap on ap.plan_id = p.id`)
    for (const r of rows) {
      assert.equal(r.status, 'godkendt'); assert.equal(r.approval_kind, 'coach')
      assert.equal(r.coach_id, PEOPLE.coach.id); assert.equal(r.athlete_id, ATHLETES.mine)
    }
    // Coachen står i auth.uid() kun inde i transaktionen.
    assert.equal((await s.db.query('select auth.uid() uid')).rows[0].uid, null)
    const week = await readClaudeWeek({ client: s.coach, athlete, today })
    assert.equal(week.status, 'sendt')
    assert.deepEqual(week.days.map(d => d.state), Array(7).fill('sendt'))
    for (const i of [0, 3, 6]) {
      const active = await s.atletSer(plusDage(today, i))
      assert.equal(active?.active, true, `dag ${i + 1}`)
      assert.equal(active.meals.length, 5)
    }
  } finally { await s.close() }
})

test('--send godkender altid som atletens egen coach i databasen', { timeout: 60000 }, async () => {
  const s = await scene()
  try {
    await s.db.query('update public.athletes set coach_id = $1 where id = $2', [PEOPLE.otherCoach.id, ATHLETES.mine])
    await s.db.exec((await skrivForslag(ugeplan(), { send: true })).sql)
    const { rows } = await s.db.query('select distinct coach_id from public.kostplan_v1_approvals')
    assert.deepEqual(rows.map(r => r.coach_id), [PEOPLE.otherCoach.id])
  } finally { await s.close() }
})

test('--send er alt eller intet: et ændret kostmål gemmer hverken plan eller godkendelse', { timeout: 60000 }, async () => {
  const s = await scene()
  try {
    const { sql } = await skrivForslag(ugeplan({ targets: { kcal: 2850, protein: 180, as_of: today } }), { send: true })
    await assert.rejects(() => s.db.exec(sql), /kostmålet er ændret/)
    await s.db.exec('rollback;').catch(() => {})
    assert.equal(await s.count('kostplan_v1_plans'), 0)
    assert.equal(await s.count('kostplan_v1_approvals'), 0)
  } finally { await s.close() }
})

test('--send uden coach på atleten stopper i databasen, og intet gemmes', { timeout: 60000 }, async () => {
  const s = await scene()
  try {
    const nullable = (await s.db.query(`select is_nullable from information_schema.columns
      where table_schema = 'public' and table_name = 'athletes' and column_name = 'coach_id'`)).rows[0].is_nullable
    if (nullable !== 'YES') return
    await s.db.query('update public.athletes set coach_id = null where id = $1', [ATHLETES.mine])
    const { sql } = await skrivForslag(ugeplan(), { send: true })
    await assert.rejects(() => s.db.exec(sql), /Coach required/)
    await s.db.exec('rollback;').catch(() => {})
    assert.equal(await s.count('kostplan_v1_plans'), 0)
    assert.equal(await s.count('kostplan_v1_approvals'), 0)
  } finally { await s.close() }
})
