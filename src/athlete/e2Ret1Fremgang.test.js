// E2-SAMLING-RET1: med flaget entropi2 (e2Atlet) vises kun den nye analyse; den gamle analysesektion
// skjules i fremgangsvisningen, og resten af fremgang er den uændrede visning. Faktiske moduler via harnessen.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { load, mount, nodes } from './analyseAtlet1Harness.mjs'

const RealDate = Date
globalThis.Date = class extends RealDate { constructor(...args) { super(...(args.length ? args : ['2026-11-01T12:00:00Z'])) } }
const { analyseAtlet1Enabled: enabled } = await load('analyseAtlet1.mjs')
const entries = await Promise.all(['FremgangTab.jsx', 'EnkelFremgangTab.jsx', 'fremgangFokus.mjs'].map(async name => ({ name,
  Component: (await load(name)).default })))
const row = (day, weight = 100) => ({ id: day, exercises: { name: 'Squat' }, logged_at: day + 'T12:00:00Z', weight, reps_completed: 5 })
const week = { id: 'w', start_date: '2026-10-26', block_name: 'Grundstyrke', sessions: [{ exercises: [{ id: 'e', name: 'Squat', sets: 3 }] }] }
const props = { rel1101: true, fremgangLogs: ['2026-10-04', '2026-10-11', '2026-10-18', '2026-10-25'].map((d, i) => row(d, 80 + i * 5)),
  fremgangLoading: false, currentWeek: week, allWeeks: [week], exerciseLogs: [] }
const serial = tree => JSON.stringify(tree, (k, v) => typeof v === 'function' ? v.toString() : v)
const oldAnalysis = tree => nodes(tree, n => n.props?.['data-analyse-atlet1']).length

test('RET1: den gamle analyse slås kun fra med entropi2Analyse === true', () => {
  assert.equal(enabled({ rel1101: true }), true)
  assert.equal(enabled({ rel1101: true, entropi2Analyse: true }), false)
  for (const entropi2Analyse of [false, undefined, 'true', 1]) assert.equal(enabled({ rel1101: true, entropi2Analyse }), true, String(entropi2Analyse))
  assert.equal(enabled({ rel1101: false }), false)
})

for (const { name, Component } of entries) {
  test(`RET1 ${name}: med entropi2Analyse ingen gammel analyse, men den uændrede fremgangsvisning`, () => {
    const on = mount(Component, { ...props, entropi2Analyse: true }).render()
    assert.equal(oldAnalysis(on), 0)
    // Resten af fremgang er præcis den visning, appen har uden den gamle analyse.
    assert.equal(serial(on), serial(mount(Component, { ...props, rel1101: false }).render()))
    // Flaget slukket (ingen entropi2Analyse): den gamle analyse vises som før.
    assert.equal(oldAnalysis(mount(Component, props).render()), 1)
  })
}

test('RET1: AthleteView giver kun entropi2Analyse med e2Atlet til fremgangsvisningen', () => {
  const source = readFileSync(new URL('../AthleteView.jsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
  assert.equal(source.split('entropi2Analyse').length, 2)
  assert.match(source, /\n {12}componentProps=\{\{ \.\.\.\(e2Atlet \? \{ entropi2Analyse: true \} : \{\}\), \.\.\.repRecords === true \? \(fremgangFokus/)
  assert.match(source, /exerciseLogs, currentWeek \}\}\}\n/)
  const spread = new Function('e2Atlet', 'return { ...(e2Atlet ? { entropi2Analyse: true } : {}) }')
  assert.deepEqual(spread(true), { entropi2Analyse: true })
  assert.deepEqual(spread(false), {})
})

test('RET1: den faktiske componentProps-linje giver de gamle props plus kun entropi2Analyse med e2Atlet', () => {
  const source = readFileSync(new URL('../AthleteView.jsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
  const line = source.split('\n').find(l => l.startsWith('            componentProps={{ ...(e2Atlet'))
  const expr = line.trim().slice('componentProps={'.length, -1)
  const old = expr.replace('{ ...(e2Atlet ? { entropi2Analyse: true } : {}), ...', '').slice(0, -1).trim()
  const names = ['e2Atlet', 'repRecords', 'fremgangFokus', 'blokStyrke', 'blokFremgang', 'personalRecords', 'fremgangLinjer',
    'enkelOn', 'route', 'athlete', 'weightLogs', 'fremgangLogs', 'fremgangLoading', 'allWeeks', 'exerciseLogs', 'currentWeek']
  const run = (code, values) => new Function(...names, 'return (' + code + ')')(...names.map(n => values[n]))
  for (const e2Atlet of [false, true]) for (const repRecords of [false, true]) for (const fremgangFokus of [false, true]) {
    const values = { e2Atlet, repRecords, fremgangFokus, blokStyrke: true, blokFremgang: false, personalRecords: true, fremgangLinjer: false,
      enkelOn: false, route: 'traening', athlete: { id: 'syn' }, weightLogs: [], fremgangLogs: [], fremgangLoading: false, allWeeks: [], exerciseLogs: [], currentWeek: null }
    const expected = run(old, values)
    assert.deepEqual(run(expr, values), e2Atlet ? { entropi2Analyse: true, ...expected } : expected, JSON.stringify({ e2Atlet, repRecords, fremgangFokus }))
  }
})
