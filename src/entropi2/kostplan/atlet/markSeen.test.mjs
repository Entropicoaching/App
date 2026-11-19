// Ordre 1891: atleten åbner den sendte uge -> én række pr. dag; coachen ser "Set". Syntetiske rækker, ingen database.
import test from 'node:test'
import assert from 'node:assert/strict'
import { markSentWeekSeen, seenRows } from './markSeen.mjs'
import { plusDage, readClaudeWeek } from '../coach/claudeWeekModel.mjs'
import { seenText } from '../coach/ClaudeWeek.mjs'

const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const athlete = { id: uuid(1), kcal_target: 2800, protein_target: 180 }
const sentDay = '2026-11-16', openDay = '2026-11-18'
const meals = [{ name: 'Morgenmad', portions: [{ foodId: 'havregryn', grams: 90 }] }]
const plans = Array.from({ length: 7 }, (_, i) => ({ id: uuid(100 + i), athlete_id: athlete.id, valid_from: plusDage(sentDay, i), status: 'godkendt' }))
const versions = plans.map((p, i) => ({ id: uuid(200 + i), plan_id: p.id, version_no: 1, effective_from: p.valid_from,
  basis_as_of: sentDay, rationale: 'Syntetisk uge', goal: 'vedligehold', intensity: 0.5, meals }))
const approvals = versions.map(v => ({ version_id: v.id, plan_id: v.plan_id, athlete_id: athlete.id,
  approved_at: '2026-11-16T09:00:00Z', approval_kind: 'coach' }))

// Lille hukommelsesdatabase med de filtre, koden bruger. upsert med ignoreDuplicates som ON CONFLICT DO NOTHING.
function memory({ seenTable = true, failing = [] } = {}) {
  const data = { kostplan_v1_plans: plans, kostplan_v1_versions: versions, kostplan_v1_approvals: approvals, kostplan_v1_seen: [] }
  const writes = []
  const client = { from(table) {
    let out = [...(data[table] ?? [])]
    const missing = (table === 'kostplan_v1_seen' && !seenTable) || failing.includes(table)
    const result = () => missing ? { data: null, error: { code: '42P01', message: 'relation does not exist' } } : { data: out, error: null }
    const q = {
      select: () => q, order: () => q, limit: n => ({ ...result(), data: missing ? null : out.slice(0, n) }),
      eq: (k, v) => { out = out.filter(r => r[k] === v); return q },
      gte: (k, v) => { out = out.filter(r => r[k] >= v); return q },
      lte: (k, v) => { out = out.filter(r => r[k] <= v); return q },
      in: (k, vs) => { out = out.filter(r => vs.includes(r[k])); return q },
      async upsert(rows, options) {
        writes.push({ table, rows, options })
        if (missing) return result()
        for (const row of rows) if (!data[table].some(r => r.athlete_id === row.athlete_id && r.version_id === row.version_id))
          data[table].push({ ...row, seen_at: `${openDay}T07:30:00Z` })
        return { data: null, error: null }
      },
    }
    return q
  } }
  return { client, data, writes }
}

test('atleten åbner den sendte uge: én række pr. sendt dag, og en ny åbning giver ingen dubletter', async () => {
  const db = memory()
  assert.deepEqual(await markSentWeekSeen({ client: db.client, athleteId: athlete.id, date: openDay }), { written: 7 })
  assert.equal(db.data.kostplan_v1_seen.length, 7)
  assert.deepEqual(db.writes[0].options, { onConflict: 'athlete_id,version_id', ignoreDuplicates: true })
  assert.deepEqual(Object.keys(db.writes[0].rows[0]).sort(), ['athlete_id', 'plan_id', 'version_id'])
  await markSentWeekSeen({ client: db.client, athleteId: athlete.id, date: openDay })
  assert.equal(db.data.kostplan_v1_seen.length, 7)
})

test('coachen ser "Set" ved "Sendt", efter at atleten har åbnet ugen', async () => {
  const db = memory()
  const before = await readClaudeWeek({ client: db.client, athlete, today: sentDay })
  assert.equal(before.status, 'sendt'); assert.equal(seenText(before), 'Ikke set af atleten endnu')
  await markSentWeekSeen({ client: db.client, athleteId: athlete.id, date: openDay })
  const after = await readClaudeWeek({ client: db.client, athlete, today: sentDay })
  assert.equal(after.sentOn, '2026-11-16'); assert.equal(after.seen, 'set'); assert.equal(after.seenOn, openDay)
  assert.equal(seenText(after), 'Set af atleten 18. nov.')
})

test('tabellen mangler (produktion i dag): ingen fejl, ingen mærke, ugen læses som før', async () => {
  const db = memory({ seenTable: false })
  assert.deepEqual(await markSentWeekSeen({ client: db.client, athleteId: athlete.id, date: openDay }), { written: 0 })
  const week = await readClaudeWeek({ client: db.client, athlete, today: sentDay })
  assert.equal(week.status, 'sendt'); assert.equal(week.seen, null); assert.equal(seenText(week), null)
})

test('fejl må aldrig vælte siden: kast, afvisning og læsefejl giver blot 0', async () => {
  const throwing = { from() { throw Error('offline') } }
  assert.deepEqual(await markSentWeekSeen({ client: throwing, athleteId: athlete.id, date: openDay }), { written: 0 })
  const rejecting = { from: () => { const q = { select: () => q, eq: () => q, gte: () => q, lte: () => q, limit: () => Promise.reject(Error('net')) }; return q } }
  assert.deepEqual(await markSentWeekSeen({ client: rejecting, athleteId: athlete.id, date: openDay }), { written: 0 })
  for (const table of ['kostplan_v1_plans', 'kostplan_v1_versions', 'kostplan_v1_approvals']) {
    const db = memory({ failing: [table] })
    assert.deepEqual(await markSentWeekSeen({ client: db.client, athleteId: athlete.id, date: openDay }), { written: 0 })
    assert.equal(db.writes.length, 0)
  }
  for (const bad of [{ client: null }, { client: memory().client, athleteId: '' }, { client: memory().client, athleteId: athlete.id, date: 'i dag' }])
    assert.deepEqual(await markSentWeekSeen({ athleteId: athlete.id, date: openDay, ...bad }), { written: 0 })
})

test('kun nyeste sendte version pr. udgivet plan; udkast, arkiverede og andres planer skrives ikke', () => {
  const v2 = { id: uuid(300), plan_id: plans[0].id, version_no: 2 }, vUnsent = { id: uuid(301), plan_id: plans[0].id, version_no: 3 }
  const rows = seenRows({ athleteId: athlete.id,
    plans: [plans[0], { ...plans[1], status: 'udkast' }, { ...plans[2], athlete_id: uuid(2) }],
    versions: [versions[0], v2, vUnsent, versions[1], versions[2]],
    approvals: [approvals[0], { version_id: v2.id, plan_id: v2.plan_id, athlete_id: athlete.id }, approvals[1], approvals[2]] })
  assert.deepEqual(rows, [{ athlete_id: athlete.id, plan_id: plans[0].id, version_id: v2.id }])
})
