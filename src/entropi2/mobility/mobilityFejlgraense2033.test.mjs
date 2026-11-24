// Ordre 2033f (Marc 23. nov.: "mobilitets fanen kan ikke åbnes på nogle telefoner"): en fejl under
// monteringen eller i et tryk giver en rolig besked med "Prøv igen" i fanen, ikke en tom skaerm eller
// hele atletvisningens "Noget gik galt". Et tryk paa "Prøv igen" monterer igen med de samme data.
import test from 'node:test'
import assert from 'node:assert/strict'
import { install } from './mobility-loader.mjs'
import { dom, nodes, button, fakeClock } from './synthetic-dom.mjs'
const hooks = install()
const { guardedMount } = await import('./Mobility.mjs')
const { mountMobility } = await import('./mobility-screen.mjs')

function base(changes = {}) {
  const values = new Map()
  const storage = { getItem(key) { return values.get(key) ?? null }, setItem(key, value) { values.set(key, value) } }
  const week = { id: 'week', week_number: 1, start_date: '2026-11-02', sessions: [
    { id: 'session', weekday: null, exercises: [{ id: 'lift', name: 'Squat', sets: 3 }] },
  ] }
  return { enabled: true, athlete: { id: 'synthetic-a' }, storage, allWeeks: [week], currentWeek: week,
    exerciseLogs: [], now: new Date('2026-11-03T12:00Z'), clock: fakeClock(), ...changes }
}
const alerts = root => nodes(root, 'p').filter(n => n.attributes.role === 'alert').map(n => n.textContent)
const quiet = run => { const silent = console.error; console.error = () => {}; try { return run() } finally { console.error = silent } }

test('fejl i monteringen: besked med Prøv igen i stedet for en tom skaerm; et tryk monterer igen', () => quiet(() => {
  const root = dom()
  let fails = 1
  const props = base()
  Object.defineProperty(props, 'exerciseLogs', { get() { if (fails-- > 0) throw new Error('syntetisk fejl paa en gammel telefon'); return [] } })
  const dispose = guardedMount(root, props)
  assert.deepEqual(alerts(root), ['Mobilitet kunne ikke vises lige nu.'], 'en besked, ikke en tom skaerm')
  button(root, 'Prøv igen').click()
  assert.deepEqual(alerts(root), [], 'beskeden er vaek efter nyt forsoeg')
  assert.equal(nodes(root, 'h1').length, 1, 'fanen er monteret')
  assert.match(nodes(root, 'h1')[0].textContent, /Mobilitet/)
  assert.ok(button(root, 'Start mobilitet'))
  dispose()
  assert.equal(root.children.length, 0, 'dispose rydder den monterede fane')
}))

test('uden fejl monteres fanen som foer og dispose rydder', () => {
  const root = dom()
  const dispose = guardedMount(root, base())
  assert.equal(nodes(root, 'h1').length, 1); assert.deepEqual(alerts(root), [])
  assert.ok(button(root, 'Start mobilitet'))
  dispose(); assert.equal(root.children.length, 0)
})

test('fejl i et tryk giver samme besked med Prøv igen, der tegner fanen igen', () => quiet(() => {
  const root = dom()
  let fails = 1
  const stop = mountMobility(root, base({ isCurrentDay() { if (fails-- > 0) throw new Error('syntetisk fejl i trykket'); return true } }))
  try {
    button(root, 'Start mobilitet').click()
    assert.deepEqual(alerts(root), ['Mobilitet kunne ikke vises lige nu.'])
    button(root, 'Prøv igen').click()
    assert.deepEqual(alerts(root), [])
    assert.equal(nodes(root, 'h1').length, 1)
    button(root, 'Start mobilitet').click()
    assert.ok(button(root, 'Næste øvelse'), 'naeste tryk virker')
  } finally { stop() }
}))
test.after(() => hooks.deregister())
