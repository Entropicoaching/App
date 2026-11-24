// 2137: coachens niveau for fri kcal-pulje. Ren model og skrivning mod en syntetisk klient. Ingen database.
import test from 'node:test'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import { plusDage, readClaudeWeek, setClaudeWeekFri, weekModel } from './claudeWeekModel.mjs'
import { claudeWeekView } from './ClaudeWeek.mjs'
import { nutritionGoalWeek } from '../../kostMaal/nutritionWeek.mjs'

const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const athlete = { id: uuid(1), kcal_target: 2800, protein_target: 180 }
const today = '2026-11-16'
const meals = [{ name: 'Morgenmad', portions: [{ foodId: 'havregryn', grams: 90 }] }]
const dage = Array.from({ length: 7 }, (_, i) => plusDage(today, i))
const plans = dage.map((date, i) => ({ id: uuid(100 + i), athlete_id: athlete.id, valid_from: date, status: 'forslag' }))
const baseVersions = basis => plans.map((p, i) => ({ id: uuid(200 + i), plan_id: p.id, version_no: 1, effective_from: p.valid_from,
  basis_as_of: today, rationale: 'Syntetisk uge', goal: 'vedligehold', intensity: 0.5, meals, calculation_basis: basis, portion_guidance: null }))

test('weekModel: friPct læses fra calculation_basis, mangler = 0, blandede dage = null', () => {
  const uden = weekModel({ plans, versions: baseVersions(undefined), athlete, today })
  assert.equal(uden.friPct, 0)
  assert.ok(uden.days.every(d => d.friPct === 0))
  assert.equal(weekModel({ plans, versions: baseVersions({ fri_pct: 20 }), athlete, today }).friPct, 20)
  const blandet = baseVersions({ fri_pct: 20 }); blandet[3].calculation_basis = { fri_pct: 10 }
  assert.equal(weekModel({ plans, versions: blandet, athlete, today }).friPct, null)
})

test('visningen: niveauknapperne findes kun på en uge, der ikke er sendt', () => {
  const udkast = weekModel({ plans, versions: baseVersions({ fri_pct: 15 }), athlete, today })
  const html = renderToStaticMarkup(claudeWeekView(udkast, { onFri: () => {} }))
  assert.match(html, /Fri pulje: 15 % af dagens kcal/)
  for (const n of [0, 10, 15, 20, 30]) assert.match(html, new RegExp(`>${n} %<`))
  assert.doesNotMatch(html, />25 %</)
  const sendt = weekModel({ plans, versions: baseVersions({ fri_pct: 15 }), athlete, today,
    approvals: baseVersions().map(v => ({ version_id: v.id, plan_id: v.plan_id, athlete_id: athlete.id, approved_at: '2026-11-16T09:00:00Z', approval_kind: 'coach' })) })
  assert.doesNotMatch(renderToStaticMarkup(claudeWeekView(sendt, { onFri: () => {} })), />30 %</)
})

// Syntetisk klient med de tre tabeller; insert lægger en ny version til.
function fakeClient(versions, { failAt = null } = {}) {
  const data = { kostplan_v1_plans: plans, kostplan_v1_versions: [...versions], kostplan_v1_approvals: [], kostplan_v1_seen: [] }
  let inserts = 0
  const client = { data, from: table => {
    const q = { select: () => q, eq: () => q, gte: () => q, in: () => q, order: () => q, limit: () => ({ data: data[table] }),
      insert: row => { inserts++; if (failAt === inserts) return { select: async () => ({ error: { code: 'XX' } }) }
        data[table].push({ id: uuid(1000 + inserts), ...structuredClone(row) }); return { select: async () => ({ data: [{ id: 'x' }] }) } } }
    return q } }
  return client
}

test('setClaudeWeekFri: én ny version pr. dag med fri_pct, samme måltider, intet sendt; rette dage springes over', async () => {
  const client = fakeClient(baseVersions({ weight_trend: null }))
  const shown = await readClaudeWeek({ client, athlete, today })
  const { week } = await setClaudeWeekFri({ client, athlete, today, shown, pct: 20 })
  assert.equal(week.friPct, 20)
  const nye = client.data.kostplan_v1_versions.filter(v => v.version_no === 2)
  assert.equal(nye.length, 7)
  assert.ok(nye.every(v => v.calculation_basis.fri_pct === 20 && v.calculation_basis.weight_trend === null && JSON.stringify(v.meals) === JSON.stringify(meals)))
  assert.equal(client.data.kostplan_v1_approvals.length, 0)
  // Igen med samme niveau skriver intet; 0 skriver en ny version pr. dag.
  await setClaudeWeekFri({ client, athlete, today, shown: week, pct: 20 })
  assert.equal(client.data.kostplan_v1_versions.length, 14)
})

test('setClaudeWeekFri: ugyldigt niveau, sendt uge og ændret uge afvises; en fejl gemmer ikke "bekræftet"', async () => {
  const client = fakeClient(baseVersions(undefined))
  const shown = await readClaudeWeek({ client, athlete, today })
  await assert.rejects(setClaudeWeekFri({ client, athlete, today, shown, pct: 25 }), /Vælg 0, 10, 15, 20 eller 30/)
  await assert.rejects(setClaudeWeekFri({ client, athlete, today, shown: { ...shown, status: 'sendt' }, pct: 10 }), /før ugen er sendt/)
  client.data.kostplan_v1_versions.push({ ...baseVersions(undefined)[0], id: uuid(999), version_no: 2 })
  await assert.rejects(setClaudeWeekFri({ client, athlete, today, shown, pct: 10 }), /Ugen er ændret/)
  const fejlende = fakeClient(baseVersions(undefined), { failAt: 3 })
  const vist = await readClaudeWeek({ client: fejlende, athlete, today })
  await assert.rejects(setClaudeWeekFri({ client: fejlende, athlete, today, shown: vist, pct: 30 }), /ikke gemt for alle dage/)
})

test('ugens tal: basemåltider fulgt og pulje holdt står i linjen, kun med et niveau', () => {
  const day = (date, extra = {}) => ({ date, state: 'approved', targets: { kcal: 2000, protein: 100 }, ...extra })
  const rows = [
    { id: 'r1', athlete_id: 'a', date: '2026-11-22', meal: 'Morgen', kcal: 900, protein: 50 },
    { id: 'r2', athlete_id: 'a', date: '2026-11-22', meal: 'Middag', kcal: 800, protein: 45 },
    { id: 'r3', athlete_id: 'a', date: '2026-11-22', meal: 'Fri: mellem', kcal: 250, protein: 0 },
    ...[23, 24, 25, 26].map(n => ({ id: `x${n}`, athlete_id: 'a', date: `2026-11-${n}`, meal: 'Morgen', kcal: 1800, protein: 100 })),
  ]
  const props = (planDays) => ({ athlete: { id: 'a', kcal_target: 2000, protein_target: 100 }, today: '2026-11-26', planDays,
    coachNutrition: { rows }, session: { user: { id: 'c' } }, readContext: { coachId: 'c', day: '2026-11-26', athleteIds: ['a'] } })
  const basis = { state: 'ready', days: new Map([['2026-11-22', { kcal: 1950, protein: 95 }], ['2026-11-23', { kcal: 1800, protein: 100 }], ['2026-11-24', { kcal: 1800, protein: 100 }], ['2026-11-25', { kcal: 1800, protein: 100 }], ['2026-11-26', { kcal: 1800, protein: 100 }]]) }
  const medFri = nutritionGoalWeek(props([day('2026-11-22', { friPct: 15, maaltider: ['Morgen', 'Middag'] }), day('2026-11-23'), day('2026-11-24'), day('2026-11-25'), day('2026-11-26')]), basis)
  assert.match(medFri.text, /Basemåltider fulgt: 2 af 2\. Fri pulje holdt: 1 af 1 logget dag\./)
  const uden = nutritionGoalWeek(props([day('2026-11-22'), day('2026-11-23'), day('2026-11-24'), day('2026-11-25'), day('2026-11-26')]), basis)
  assert.doesNotMatch(uden.text, /Basemåltider|Fri pulje/)
})
