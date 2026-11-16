// Coachens Set-mærke (ordre 1507): ren model og visning med syntetiske rækker. Ingen database.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { plusDage, readClaudeWeek, weekModel } from './claudeWeekModel.mjs'
import { claudeWeekView, seenText } from './ClaudeWeek.mjs'

const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const athlete = { id: uuid(1), kcal_target: 2800, protein_target: 180 }
const today = '2026-11-16'
const meals = [{ name: 'Morgenmad', portions: [{ foodId: 'havregryn', grams: 90 }] }]
const dage = Array.from({ length: 7 }, (_, i) => plusDage(today, i))
const plans = dage.map((date, i) => ({ id: uuid(100 + i), athlete_id: athlete.id, valid_from: date, status: 'godkendt' }))
const versions = plans.map((p, i) => ({ id: uuid(200 + i), plan_id: p.id, version_no: 1, effective_from: p.valid_from,
  basis_as_of: today, rationale: 'Syntetisk uge', goal: 'vedligehold', intensity: 0.5, meals }))
const approvals = (n = 7) => versions.slice(0, n).map(v => ({ version_id: v.id, plan_id: v.plan_id, athlete_id: athlete.id,
  approved_at: '2026-11-16T09:00:00Z', approval_kind: 'coach' }))
const seenRows = (n, at = '2026-11-17T10:00:00Z') => versions.slice(0, n).map(v => ({ version_id: v.id, athlete_id: athlete.id, seen_at: at }))
const model = (seen, n = 7) => weekModel({ plans, versions, approvals: approvals(n), seen, athlete, today })

test('sendt uge: alle dage set, delvist set, ikke set', () => {
  const set = model(seenRows(7)); assert.equal(set.seen, 'set'); assert.equal(set.seenOn, '2026-11-17')
  assert.equal(seenText(set), 'Set af atleten 17. nov.')
  const delvist = model(seenRows(3)); assert.equal(delvist.seen, 'delvist'); assert.equal(seenText(delvist), 'Delvist set af atleten (3 af 7 dage)')
  const ikke = model([]); assert.equal(ikke.seen, 'ikke'); assert.equal(seenText(ikke), 'Ikke set af atleten endnu')
})

test('intet mærke når set-tabellen ikke kan læses eller ugen ikke er sendt', () => {
  assert.equal(model(null).seen, null); assert.equal(seenText(model(null)), null)
  assert.equal(model(seenRows(7), 0).seen, null)
  assert.equal(model(seenRows(7), 4).seen, null)
})

test('set-rækker for en anden version tæller ikke', () => {
  const other = versions.map(v => ({ version_id: uuid(900), athlete_id: athlete.id, seen_at: '2026-11-17T10:00:00Z' }))
  assert.equal(model(other).seen, 'ikke')
})

test('visningen viser mærket, og kun når der er et', () => {
  const med = renderToStaticMarkup(claudeWeekView(model(seenRows(7))))
  assert.match(med, /data-seen="set"[^>]*>Set af atleten 17\. nov\./)
  assert.doesNotMatch(renderToStaticMarkup(claudeWeekView(model(null))), /data-seen/)
})

test('readClaudeWeek: manglende set-tabel giver samme uge uden mærke', async () => {
  const data = { kostplan_v1_plans: plans, kostplan_v1_versions: versions, kostplan_v1_approvals: approvals() }
  const client = { from: table => { const q = { select: () => q, eq: () => q, gte: () => q, in: () => q, order: () => q,
    limit: () => table === 'kostplan_v1_seen' ? { error: { code: '42P01' }, data: null } : { data: data[table] } }; return q } }
  const week = await readClaudeWeek({ client, athlete, today })
  assert.equal(week.status, 'sendt'); assert.equal(week.seen, null)
  const withSeen = { from: table => table === 'kostplan_v1_seen' ? (() => { const q = { select: () => q, eq: () => q, in: () => q,
    limit: () => ({ data: seenRows(7) }) }; return q })() : client.from(table) }
  assert.equal((await readClaudeWeek({ client: withSeen, athlete, today })).seen, 'set')
})
