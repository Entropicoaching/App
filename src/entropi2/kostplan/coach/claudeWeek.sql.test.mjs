// U10b (ordre 115): coachens uge fra Claude mod den live kostplan-pakke i PGlite, med
// U10a-scriptets egen SQL, appens PostgREST-kald og den syntetiske testatlet.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { PostgrestClient } from '@supabase/postgrest-js'
import { ATHLETES, PEOPLE, createRehearsalDb } from '../../../../scripts/generalproeve/proeveDb.mjs'
import { listenPgRest } from '../../../../e2e/pglite-postgrest.mjs'
import { skrivForslag } from '../../../../scripts/kostplan/skriv-forslag.mjs'
import { FOODS } from '../foedevarer/catalog.mjs'
import { createPlanAdapter } from '../planAdapter.mjs'
import { plusDage, readClaudeWeek, sendClaudeWeek, weekModel } from './claudeWeekModel.mjs'
import { claudeWeekView } from './ClaudeWeek.mjs'
import PortalPlan from './PortalPlan.mjs'

const id = new Map(FOODS.map(food => [food.name, food.id]))
const meal = (name, items) => ({ name, portions: items.map(([vare, grams]) => ({ foodId: id.get(vare), grams })) })
// Samme syntetiske dag som U10a-prøven: 2.816 kcal og 185 g protein mod 2.800 kcal og 180 g.
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
const ugeplan = () => ({ athleteId: ATHLETES.mine, goal: 'vedligehold', intensity: 0.5,
  rationale: 'Syntetisk testuge med fem måltider om dagen omkring træningen.',
  basisAsOf: today, targets: { kcal: 2800, protein: 180, as_of: today },
  days: Array.from({ length: 7 }, (_, i) => ({ date: plusDage(today, i), meals: dag() })) })

async function scene() {
  const rehearsal = await createRehearsalDb()
  await rehearsal.db.exec((await skrivForslag(ugeplan())).sql)
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

test('forslaget fra Claude vises som udkast med 7 dage, og atletens visning er tom', { timeout: 60000 }, async () => {
  const s = await scene()
  try {
    const week = await readClaudeWeek({ client: s.coach, athlete, today })
    assert.equal(week.status, 'udkast')
    assert.equal(week.days.length, 7)
    assert.deepEqual(week.days.map(d => d.date), ugeplan().days.map(d => d.date))
    for (const d of week.days) {
      assert.equal(d.state, 'udkast'); assert.equal(d.mealCount, 5); assert.equal(d.ok, true)
      assert.equal(Math.round(d.kcal), 2816); assert.equal(Math.round(d.protein), 185)
    }
    assert.equal(week.lock, null)
    assert.equal(week.rationale, 'Syntetisk testuge med fem måltider om dagen omkring træningen.')
    const html = renderToStaticMarkup(claudeWeekView(week))
    assert.match(html, /Forslag fra Claude[\s\S]*Udkast fra Claude/)
    assert.equal((html.match(/data-day="/g) ?? []).length, 7)
    assert.match(html, /<button[^>]*>Send uge til atleten<\/button>/)
    assert.doesNotMatch(html, /<button[^>]*disabled/)
    assert.equal(await s.atletSer(today), null)
    assert.equal(await s.atletSer(plusDage(today, 3)), null)
  } finally { await s.close() }
})

test('Send uge giver 7 godkendelser, planerne bliver godkendt, og atleten ser dagen', { timeout: 60000 }, async () => {
  const s = await scene()
  try {
    const shown = await readClaudeWeek({ client: s.coach, athlete, today })
    assert.equal(await s.count('kostplan_v1_approvals'), 0)
    const sent = await sendClaudeWeek({ client: s.coach, athlete, today, shown })
    assert.equal(await s.count('kostplan_v1_approvals'), 7)
    const { rows } = await s.db.query(`select status, count(*)::int n from public.kostplan_v1_plans group by status`)
    assert.deepEqual(rows, [{ status: 'godkendt', n: 7 }])
    assert.equal(sent.status, 'sendt'); assert.equal(sent.sentOn, today)
    assert.match(renderToStaticMarkup(claudeWeekView(sent)), /Sendt \d+\. [a-zæøå]+/)
    assert.doesNotMatch(renderToStaticMarkup(claudeWeekView(sent)), /Send uge til atleten/)
    for (const date of [today, plusDage(today, 6)]) {
      const plan = await s.atletSer(date)
      assert.equal(plan.meals.length, 5, date)
      assert.equal(plan.meals[0].name, 'Morgenmad')
      assert.equal(Math.round(plan.targets.kcal), 2816)
    }
    // At sende igen tilføjer intet: ugen er allerede sendt.
    assert.equal((await readClaudeWeek({ client: s.coach, athlete, today })).status, 'sendt')
  } finally { await s.close() }
})

test('Send uge stopper, hvis ugen er ændret siden visningen, og godkender intet', { timeout: 60000 }, async () => {
  const s = await scene()
  try {
    const shown = await readClaudeWeek({ client: s.coach, athlete, today })
    const stale = { ...shown, days: shown.days.map((d, i) => i === 2 ? { ...d, versionId: shown.days[0].versionId } : d) }
    await assert.rejects(sendClaudeWeek({ client: s.coach, athlete, today, shown: stale }), /ændret/)
    assert.equal(await s.count('kostplan_v1_approvals'), 0)
  } finally { await s.close() }
})

const version = (planId, n, meals) => ({ id: `00000000-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`,
  plan_id: planId, version_no: 1, effective_from: plusDage('2026-11-16', n), goal: 'vedligehold', intensity: 0.5,
  rationale: 'Syntetisk.', meals })
function syntetiskUge(mealsFor) {
  const plans = [], versions = []
  for (let n = 0; n < 7; n++) {
    const planId = `00000000-0000-4000-8000-0000000001${String(n).padStart(2, '0')}`
    plans.push({ id: planId, athlete_id: athlete.id, valid_from: plusDage('2026-11-16', n), status: 'forslag' })
    versions.push(version(planId, n, mealsFor(n)))
  }
  return { plans, versions }
}
const fodevare = { id: 'syntetisk:ris', name: 'Syntetisk ris', basisGrams: 100,
  source: { citation: 'syntetisk', verification: 'syntetisk' },
  nutrientsPer100g: { energyKcal: 280, proteinG: 18, carbohydrateG: 30, fatG: 8 } }
const fuldDag = [{ name: 'Dagens mad', portions: [{ grams: 1000, food: fodevare }] }]

test('en dag med 0 måltider låser knappen og siger hvorfor', () => {
  const week = weekModel({ ...syntetiskUge(n => n === 3 ? [] : fuldDag), athlete, today: '2026-11-15' })
  assert.equal(week.days[3].mealCount, 0)
  assert.equal(week.days[0].ok, true)
  assert.match(week.lock, /0 måltider/)
  const html = renderToStaticMarkup(claudeWeekView(week))
  assert.match(html, /<button[^>]*disabled=""[^>]*>Send uge til atleten<\/button>/)
  assert.match(html, /data-lock="true"[^>]*>[^<]*0 måltider/)
})

test('afvigelse over 10 % fra athletes-målet og et manglende mål låser også knappen', () => {
  const skaev = weekModel({ ...syntetiskUge(n => n === 5
    ? [{ name: 'Lille', portions: [{ grams: 800, food: fodevare }] }] : fuldDag), athlete, today: '2026-11-15' })
  assert.match(skaev.lock, /afviger \d+ % fra målet/)
  const udenMaal = weekModel({ ...syntetiskUge(() => fuldDag), athlete: { id: athlete.id }, today: '2026-11-15' })
  assert.equal(udenMaal.lock, 'Atleten mangler et kostmål.')
  const ok = weekModel({ ...syntetiskUge(() => fuldDag), athlete, today: '2026-11-15' })
  assert.equal(ok.lock, null)
  // Målet er athletes-målet, aldrig planens egen total.
  assert.deepEqual(ok.targets, { kcal: 2800, protein: 180 })
})

test('ingen forslag giver én kort linje, og en ny version efter sending viser "Ændret efter sending"', () => {
  assert.match(renderToStaticMarkup(claudeWeekView(weekModel({ athlete, today: '2026-11-15' }))), /Intet forslag endnu/)
  const uge = syntetiskUge(() => fuldDag)
  const approvals = uge.versions.map(v => ({ version_id: v.id, plan_id: v.plan_id, athlete_id: athlete.id,
    approved_at: '2026-11-15T09:00:00.000000+00:00', approval_kind: 'coach' }))
  assert.equal(weekModel({ ...uge, approvals, athlete, today: '2026-11-15' }).status, 'sendt')
  const rettet = { ...version(uge.plans[2].id, 2, fuldDag), id: '00000000-0000-4000-8000-000000000099', version_no: 2 }
  const week = weekModel({ ...uge, versions: [...uge.versions, rettet], approvals, athlete, today: '2026-11-15' })
  assert.equal(week.status, 'aendret')
  assert.match(renderToStaticMarkup(claudeWeekView(week)), /Ændret efter sending/)
})

test('coachens kostplan viser forslaget først og byg-fra-bunden bag "Ret"', () => {
  const props = { enabled: true, athlete, today: '2026-11-16', session: { user: { id: PEOPLE.coach.id } } }
  const med = renderToStaticMarkup(h(PortalPlan, { ...props, weekClient: { from: () => { throw Error('ingen læsning ved server-render') } } }))
  assert.match(med, /Forslag fra Claude[\s\S]*<details[^>]*data-ret="true"[^>]*><summary[^>]*>Ret<\/summary>[\s\S]*Åbn kostplan med Frida-fødevarer/)
  assert.doesNotMatch(med, /<details[^>]* open/)
  // Uden værtens klient er den gamle kostplan uændret.
  const uden = renderToStaticMarkup(h(PortalPlan, props))
  assert.doesNotMatch(uden, /Forslag fra Claude|data-ret/)
})
