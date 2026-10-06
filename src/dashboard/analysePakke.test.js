import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { validerAnalysePakke, pakkeTilReviewRaekke, indlaesAnalysePakke, ANALYSE_PAKKE_MAX_BYTES } from './analysePakke.js'
const fixture = JSON.parse(readFileSync(new URL('../../test/fixtures/analyse-pakke/syntetisk.json', import.meta.url), 'utf8'))
const kopi = () => structuredClone(fixture)

test('real pakke.mjs output maps velocity, findings and limits', () => {
  assert.deepEqual(validerAnalysePakke(fixture), [])
  const r = pakkeTilReviewRaekke(fixture, { loadKg: 100 })
  assert.equal(r.load_kg, 100)
  assert.equal(r.reps_count, 3)
  assert.deepEqual(r.reps, fixture.reps)
  assert.deepEqual(r.saet, fixture.saet)
  assert.equal(r.metrics.velocity_loss_pct.value, 15)
  assert.equal(r.metrics.velocity_loss_pct.method, 'analyse-pakke-v1')
  assert.equal(r.metrics.velocity_loss_pct.confidence, 'lav')
  assert.deepEqual(r.findings.map(x => [x.summary, x.confidence]), fixture.fund.map(x => [x.linje, x.sikkerhed]))
  assert.deepEqual(r.ikkeRegnet, fixture.ikkeRegnet)
})
test('null stays null and zero stays measured zero', () => {
  const p = kopi(); p.saet[0].tabPct = null
  const r = pakkeTilReviewRaekke(p)
  assert.equal(r.reps[0].tabPct, 0)
  assert.deepEqual(r.reps[1], { rep: 2, meanMs: null, topMs: null, tabPct: null })
  assert.equal(r.metrics.velocity_loss_pct.value, null)
  assert.equal(r.load_kg, null)
})
test('multiple sets, empty findings and no reps preserve semantics', () => {
  const p = kopi(); p.saet.push({ reps: [4], tabPct: null }); p.fund = []
  assert.equal(pakkeTilReviewRaekke(p).saet.length, 2)
  p.reps = []; p.saet = [{ reps: [], tabPct: null }]
  assert.equal(pakkeTilReviewRaekke(p).reps_count, 0)
  assert.deepEqual(pakkeTilReviewRaekke(p).findings, [])
})
test('calibrated scale keeps its label without claiming high confidence', () => {
  const p = kopi(); p.kvalitet.skala = 'meta'
  assert.equal(pakkeTilReviewRaekke(p).metrics.velocity_loss_pct.confidence, 'middel')
  p.kvalitet.seed = 'automatisk'
  assert.equal(pakkeTilReviewRaekke(p).metrics.velocity_loss_pct.confidence, 'lav')
})
test('mapping copies arrays and drops unknown identity/payload fields', () => {
  const p = kopi(); p.athlete_id = 'synthetic'; p.session_context = { anything: true }
  const r = pakkeTilReviewRaekke(p)
  r.reps[0].meanMs = 123; r.saet[0].reps.push(4); r.ikkeRegnet.push('test')
  assert.equal(p.reps[0].meanMs, 0.6)
  assert.deepEqual(p.saet[0].reps, [1, 2, 3])
  assert.equal(p.ikkeRegnet.length, 2)
  assert.ok(!('athlete_id' in r) && !('session_context' in r))
})
for (const [label, edit] of [
  ['missing rep field', p => { delete p.reps[0].meanMs }],
  ['numeric string', p => { p.reps[0].topMs = '0.9' }],
  ['infinite velocity', p => { p.reps[0].topMs = Infinity }],
  ['null rep', p => { p.reps[0] = null }],
  ['null set', p => { p.saet[0] = null }],
  ['null finding', p => { p.fund[0] = null }],
  ['wrong version', p => { p.format = 'analyse-pakke-v2' }],
  ['unknown confidence', p => { p.fund[0].sikkerhed = 'certain' }],
  ['unknown scale', p => { p.kvalitet.skala = 'unknown' }],
  ['non-text limit', p => { p.ikkeRegnet = [{}] }],
  ['invalid hashes', p => { p.kilde.bane = 'bad' }],
]) test(`rejects ${label} without crashing validator`, () => {
  const p = kopi(); edit(p)
  assert.ok(validerAnalysePakke(p).length)
  assert.throws(() => pakkeTilReviewRaekke(p))
})
test('non-object input fails safely', () => {
  for (const p of [null, [], 'text', 123]) assert.ok(validerAnalysePakke(p).length)
})
test('local reader parses a generated package', async () => {
  const r = await indlaesAnalysePakke({ size: 3000, text: async () => JSON.stringify(fixture) })
  assert.equal(r.reps_count, 3)
})
test('local reader rejects oversized file before reading', async () => {
  await assert.rejects(indlaesAnalysePakke({ size: ANALYSE_PAKKE_MAX_BYTES + 1, text: () => { throw new Error('must not read') } }), /512 KB/)
})
test('local reader reports malformed/unreadable JSON without leaking file text', async () => {
  for (const text of [async () => '{private-text', async () => { throw new Error('private-path') }])
    await assert.rejects(indlaesAnalysePakke({ size: 20, text }), /^Error: Filen kunne ikke læses som JSON\.$/)
})
