import test from 'node:test'
import assert from 'node:assert/strict'
import { act, createElement as h } from 'react'
import { createRoot } from 'react-dom/client'
import VaegtMaal from './VaegtMaal.mjs'
import { vaegtMaalLinje, vaegtRaekker, planMaal } from './vaegtMaalModel.mjs'
import { all, tick, hostFixture } from '../../nutrition/diaryTemplate.fixture.mjs'

// Ordre 1574: atletens Kost viser, om vægten følger planens mål. Syntetiske data, kun læsning.
const athleteId = 'synthetic-vaegt-athlete', date = '2026-11-16'
const dag = n => new Date(Date.parse(date + 'T00:00:00Z') - n * 864e5).toISOString().slice(0, 10)
// 14 dage i træk, startvægt 80 kg, ændring pr. dag
const logs = (perDag, dage = 14) => Array.from({ length: dage }, (_, i) => ({ id: 'w' + i, athlete_id: athleteId,
  logged_at: dag(dage - 1 - i), weight: Math.round((80 + perDag * i) * 100) / 100 }))
const ready = { athleteId, state: 'ready' }
const version = (goal, intensity) => ({ goal, intensity })
const cut = version('cut', 0.1) // mål -0,5 % pr. uge, cirka -0,4 kg pr. uge ved 80 kg

test('model: de tre tilstande for et cut-mål (tolerance 0,1 procentpoint)', () => {
  const rows = perDag => vaegtRaekker(logs(perDag), athleteId)
  assert.equal(vaegtMaalLinje({ rows: rows(-0.057), date, version: cut }).status, 'paa-sporet') // cirka -0,4 kg pr. uge
  assert.equal(vaegtMaalLinje({ rows: rows(-0.2), date, version: cut }).status, 'hurtigere')
  assert.equal(vaegtMaalLinje({ rows: rows(0), date, version: cut }).status, 'langsommere')
  assert.match(vaegtMaalLinje({ rows: rows(-0.057), date, version: cut }).text, /^Vægten falder 0,4 kg pr\. uge de seneste 14 dage\. På sporet\.$/)
})

test('model: bulk går den modsatte vej; vedligehold har kun over og under', () => {
  const rows = perDag => vaegtRaekker(logs(perDag), athleteId)
  const bulk = version('bulk', 0.1) // mål +0,25 % pr. uge, cirka +0,2 kg
  assert.equal(vaegtMaalLinje({ rows: rows(0.029), date, version: bulk }).status, 'paa-sporet')
  assert.equal(vaegtMaalLinje({ rows: rows(0.2), date, version: bulk }).status, 'hurtigere')
  assert.equal(vaegtMaalLinje({ rows: rows(-0.1), date, version: bulk }).status, 'langsommere')
  const hold = version('vedligehold', 0.1)
  assert.equal(vaegtMaalLinje({ rows: rows(0), date, version: hold }).status, 'paa-sporet')
  assert.equal(vaegtMaalLinje({ rows: rows(0.1), date, version: hold }).label, 'Højere end målet')
})

test('model: for få målinger, intet mål eller fremmede rækker giver ingen linje (aldrig gættet, aldrig nul)', () => {
  assert.equal(vaegtMaalLinje({ rows: vaegtRaekker(logs(-0.057, 9), athleteId), date, version: cut }), null)
  assert.equal(vaegtMaalLinje({ rows: vaegtRaekker(logs(-0.057).filter((_, i) => i % 2), athleteId), date, version: cut }), null)
  assert.equal(vaegtMaalLinje({ rows: vaegtRaekker(logs(-0.057), athleteId), date, version: version('vedligehold', 0) }), null)
  assert.equal(vaegtMaalLinje({ rows: vaegtRaekker(logs(-0.057), athleteId), date, version: null }), null)
  assert.equal(planMaal(version('ukendt', 0.1)), null)
  assert.deepEqual(vaegtRaekker(logs(-0.057), 'en-anden'), [])
})

async function mount(t, props, client) {
  t.mock.timers.enable({ apis: ['Date'], now: new Date(date + 'T12:00:00+01:00') })
  const dom = hostFixture(), root = createRoot(dom.host)
  t.after(async () => { await act(async () => { root.unmount(); await tick() }); dom.restore() })
  await act(async () => { root.render(h(VaegtMaal, { athleteId, date, client, planId: 'p1', revision: 'v1', weightStatus: ready, ...props })); await tick() })
  return dom.host
}
const fakeClient = (data, calls = []) => ({ calls, from(table) {
  const q = { select(columns) { calls.push({ table, columns, action: 'select' }); return q }, eq() { return q },
    limit() { return Promise.resolve({ data, error: null }) } }
  return q
} })

test('vises med nok målinger: én linje med tendens og status, fold med grundlaget, ingen skrivning', async t => {
  const client = fakeClient([cut])
  const host = await mount(t, { weightLogs: logs(-0.057) }, client)
  const line = all(host, '[data-vaegt-maal]')
  assert.equal(line.length, 1)
  assert.equal(line[0].getAttribute('data-vaegt-maal'), 'paa-sporet')
  assert.match(line[0].textContent, /Vægten falder 0,4 kg pr\. uge de seneste 14 dage\. På sporet\./)
  assert.equal(all(host, 'details').length, 1)
  assert.match(all(host, 'details')[0].textContent, /14 vejninger de seneste 14 dage/)
  assert.deepEqual(client.calls.map(c => [c.table, c.action]), [['kostplan_v1_versions', 'select']])
})

test('skjules med for få målinger (ingen forespørgsel) og uden mål, og mens vægten ikke er læst', async t => {
  const few = fakeClient([cut])
  assert.equal(all(await mount(t, { weightLogs: logs(-0.057, 9) }, few), '[data-vaegt-maal]').length, 0)
  assert.equal(few.calls.length, 0, 'ingen læsning af planversionen uden nok vejninger')
})
test('skjules uden mål i planen', async t => {
  assert.equal(all(await mount(t, { weightLogs: logs(-0.057) }, fakeClient([version('vedligehold', 0)])), '[data-vaegt-maal]').length, 0)
})
test('skjules mens vægten læses eller hvis den fejlede', async t => {
  assert.equal(all(await mount(t, { weightLogs: logs(-0.057), weightStatus: { athleteId, state: 'loading' } }, fakeClient([cut])), '[data-vaegt-maal]').length, 0)
})
