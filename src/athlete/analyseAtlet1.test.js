import { test } from 'node:test'
import assert from 'node:assert/strict'
import { load, mount, nodes, text, source, button } from './analyseAtlet1Harness.mjs'
const RealDate = Date
const today = '2026-11-01'
globalThis.Date = class extends RealDate { constructor(...args) { super(...(args.length ? args : [today + 'T12:00:00Z'])) } }
const { analyseAtlet1Model: model, analyseAtlet1Enabled: enabled } = await load('analyseAtlet1.mjs')
const entries = await Promise.all(['FremgangTab.jsx', 'EnkelFremgangTab.jsx', 'fremgangFokus.mjs'].map(async name => ({ name,
  Component: (await load(name)).default, Base: (await load(name, 'base')).default })))
const row = (day, weight = 100, extra = {}) => ({ id: day, exercises: { name: 'Squat' }, logged_at: day + 'T12:00:00Z', weight, reps_completed: 5, ...extra })
const week = { id: 'w', start_date: '2026-10-26', block_name: 'Grundstyrke', sessions: [{ exercises: [{ id: 'e', name: 'Squat', sets: 3 }] }] }
const logs = ['2026-10-04', '2026-10-11', '2026-10-18', '2026-10-25'].map((d, i) => row(d, 80 + i * 5))
const props = { rel1101: true, fremgangLogs: logs, fremgangLoading: false, currentWeek: week, allWeeks: [week],
  exerciseLogs: [row('2026-10-30', 100, { exercise_id: 'e', set_number: 1 })] }
const metrics = tree => nodes(tree, n => n.props['data-analyse-metric'])
const section = (tree, key) => nodes(tree, n => n.props['aria-labelledby'] === 'analyse-atlet1-' + key)[0]
const serial = tree => JSON.stringify(tree, (k, v) => typeof v === 'function' ? v.toString() : v)
for (const { name, Component, Base } of entries) {
  test(name + ': each answer has exactly one supported actual metric and coherent Danish', () => {
    const tree = mount(Component, props).render()
    assert.equal(nodes(tree, n => n.type === 'h1').length, 1)
    assert.deepEqual(nodes(tree, n => n.type === 'h2').map(text), ['Hvor står jeg?', 'Hvad går godt?', 'Hvad arbejder vi med nu?'])
    for (const key of ['status', 'good', 'focus']) assert.equal(metrics(section(tree, key)).length, 1)
    assert.equal(text(metrics(section(tree, 'status'))[0]), '100 kg')
    assert.equal(text(metrics(section(tree, 'good'))[0]), '+20 kg')
    assert.equal(text(metrics(section(tree, 'focus'))[0]), '1 registreret sæt')
    assert.match(text(tree), /Grundstyrke/)
    assert.match(text(tree), /årsagen kan ikke udledes/)
    assert.equal(nodes(tree, n => n.type === 'svg').length, 0)
  })
  test(name + ': empty, unknown, loading, malformed and sparse histories show logging guidance', () => {
    for (const history of [[], [row('2026-10-30')], [null, {}, row('2026-10-30', Infinity)], 'bad']) {
      const tree = mount(Component, { rel1101: true, fremgangLogs: history }).render()
      assert.equal(metrics(section(tree, 'good')).length, 0)
      assert.match(text(section(tree, 'good')), Array.isArray(history) ? /Log tunge sæt/ : /historikken er ikke klar/)
      assert.match(text(section(tree, 'focus')), /Åbn dit program/)
      assert.doesNotMatch(text(tree), /NaN|Infinity|undefined/)
    }
    for (const extra of [{ fremgangLoading: true }, { fremgangLogs: null }]) {
      const tree = mount(Component, { ...props, ...extra }).render()
      assert.equal(metrics(section(tree, 'status')).length, 0)
      assert.equal(metrics(section(tree, 'good')).length, 0)
    }
  })
  test(name + ': OFF DOM and handler bodies equal exact pinned baseline', () => {
    globalThis.window = { location: { search: '' } }
    for (const extra of [{}, { fremgangLinjer: true }, { enkelDel: 'rekorder' }, { personalRecords: true, repRecords: true }]) {
      const p = { ...props, ...extra, rel1101: false }
      const actual = mount(Component, p).render(), expected = mount(Base, p).render()
      assert.equal(serial(actual), serial(expected))
      assert.equal(nodes(actual, n => n.props['data-analyse-atlet1']).length, 0)
    }
    delete globalThis.window
  })
  test(name + ': strict existing URL opt-in works at actual entry without parent edits', () => {
    for (const search of ['?rel1101=1', '?rel1101=0', '?rel1101=true', '?rel1101=1&rel1101=1']) {
      globalThis.window = { location: { search } }
      const tree = mount(Component, { ...props, rel1101: undefined }).render()
      assert.equal(nodes(tree, n => n.props['data-analyse-atlet1']).length, search === '?rel1101=1' ? 1 : 0)
    }
    delete globalThis.window
  })
}
test('strict release values remain default OFF', () => {
  for (const rel1101 of [undefined, false, 1, '1', 'true']) assert.equal(enabled({ rel1101 }), false)
  assert.equal(enabled({ rel1101: true }), true)
})
test('comparison threshold: four distinct days AND at least 21 days; exact reps and raw variant', () => {
  const good = hs => model({ fremgangLogs: hs })[1].value
  assert.equal(good(logs), '+15 kg')
  assert.equal(good(logs.slice(1)), undefined)
  assert.equal(good(logs.map((r, i) => row(['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-25'][i], 80 + i * 5))), undefined)
  assert.equal(good([...logs.slice(0, 3), ...Array(20).fill(logs[2])]), undefined)
  assert.equal(good(logs.map((r, i) => i ? r : { ...r, reps_completed: 4 })), undefined)
  assert.equal(good(logs.map((r, i) => i ? r : { ...r, exercises: { name: 'Pause squat' } })), undefined)
})
test('invalid, nonfinite, fractional, skipped, light, deload, future and stale rows do not create claims', () => {
  const bad = [null, {}, row('2026-02-30'), row('2026-11-02'), row('2026-10-30', NaN), row('2026-10-30', Infinity),
    row('2026-10-30', true), row('2026-10-30', ''), row('2026-10-30', 0), row('2026-10-30', -5),
    row('2026-10-30', 100, { reps_completed: 1.5 }), row('2026-10-30', 100, { reps_completed: 0 }),
    row('2026-10-30', 100, { skipped: true }), row('2026-10-30', 100, { exercises: { name: 'Squat backoff' } }),
    row('2026-10-30', 100, { exercises: { name: 'Squat', sessions: { weeks: { block_name: 'Deload' } } } }), row('2026-10-30', 100, { logged_at: undefined })]
  for (const r of bad) assert.equal(model({ fremgangLogs: [r] })[0].value, undefined, JSON.stringify(r))
  assert.equal(model({ fremgangLogs: [row('2026-10-01')] })[0].value, undefined)
  assert.equal(model({ fremgangLogs: [row('2026-10-18')] })[0].value, '100 kg')
  assert.equal(model({ fremgangLogs: [row('2026-10-17')] })[0].value, undefined)
})
test('flat and falling histories make no positive claim', () => {
  for (const hs of [logs.map(r => ({ ...r, weight: 100 })), logs.map((r, i) => ({ ...r, weight: 100 - i * 5 }))]) {
    const a = model({ fremgangLogs: hs })[1]
    assert.equal(a.value, undefined); assert.match(a.message, /ingen stigning/)
  }
})
test('local undo and edits own current exercise IDs; duplicates and conflicting positions fail closed', () => {
  const h = [...logs, row('2026-10-30', 200, { exercise_id: 'e', set_number: 1 })]
  assert.equal(model({ ...props, fremgangLogs: h, exerciseLogs: [] })[0].value, '95 kg')
  assert.equal(model({ ...props, fremgangLogs: h })[0].value, '100 kg')
  assert.equal(model({ ...props, exerciseLogs: [...props.exerciseLogs, ...props.exerciseLogs] })[2].value, '1 registreret sæt')
  assert.equal(model({ ...props, exerciseLogs: [...props.exerciseLogs, { ...props.exerciseLogs[0], weight: 120 }] })[2].value, undefined)
  for (const extra of [{ skipped: true }, { logged_at: undefined }, { exercise_id: 'foreign' }, { set_number: NaN }, { logged_at: '2026-10-25' }]) {
    assert.equal(model({ ...props, exerciseLogs: [{ ...props.exerciseLogs[0], ...extra }] })[2].value, undefined)
  }
})
test('selected old/future/undated program is not current focus; no invented coach objective', () => {
  for (const start_date of ['2026-10-19', '2026-11-02', undefined, '2026-02-30']) {
    const a = model({ ...props, currentWeek: { ...week, start_date } })[2]
    assert.equal(a.value, undefined); assert.doesNotMatch(a.message, /Grundstyrke/)
  }
})
test('exact legacy source and handlers are retained byte-for-byte behind the wrapper', () => {
  for (const { name } of entries) {
    const base = source(name, 'base'), final = source(name)
    const legacy = base.replace('export default function ', 'function Legacy')
    assert.ok(final.includes(legacy))
    assert.match(final, /analyseAtlet1Enabled\(props\)/)
  }
})
test('legacy handlers still operate when OFF', () => {
  const { Component } = entries.find(e => e.name === 'fremgangFokus.mjs')
  const mounted = mount(Component, { ...props, rel1101: false })
  button(mounted.render(), 'Se alle detaljer').props.onClick()
  assert.equal(button(mounted.render(), 'Skjul detaljer').props['aria-expanded'], true)
  button(mounted.render(), 'Skjul detaljer').props.onClick()
  assert.equal(button(mounted.render(), 'Se alle detaljer').props['aria-expanded'], false)
})
