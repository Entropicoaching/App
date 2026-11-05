// Actual copied modules, pinned dependency contracts and an in-memory DOM/store.
import test from 'node:test'
import assert from 'node:assert/strict'
import { install } from './mobility-loader.mjs'
import { dom, nodes, button } from './synthetic-dom.mjs'
const hooks = install()
const { mountMobility } = await import('./mobility-screen.mjs')
const { mobilityModel } = await import('./mobility-model.mjs')
const { saveHomework } = await import('./public-mobilityHomework.mjs')
const { coachNotes } = await import('./public-coachMobility.mjs')
const { WARMUP_BASE } = await import('./public-mobilityCatalog.mjs')
test.after(() => hooks.deregister())

const week = { id: 'week', week_number: 1, start_date: '2026-11-02', sessions: [
  { id: 'session', weekday: null, exercises: [{ id: 'lift', name: 'Squat', sets: 3 }] },
] }
function setup(extra = {}) {
  const values = new Map(), writes = []
  const storage = { getItem: key => values.get(key) ?? null,
    setItem(key, value) { writes.push(key); values.set(key, value) } }
  const options = { enabled: true, athlete: { id: 'synthetic-a' }, allWeeks: [week], currentWeek: week,
    exerciseLogs: [], now: new Date('2026-11-03T12:00Z'), storage, ...extra }
  const root = dom(), dispose = mountMobility(root, options)
  return { root, options, storage, writes, dispose }
}
const before = root => nodes(root, 'section').filter(n => n.attributes['aria-label'] === 'Før næste pas')

test('no eligible routine omits the optional card while keeping library and program navigation', () => {
  const unknown = structuredClone(week); unknown.sessions[0].exercises[0].name = 'Unknown exercise'
  const empty = { ...week, sessions: [] }
  for (const extra of [
    { allWeeks: [], currentWeek: null },
    { allWeeks: [empty], currentWeek: empty },
    { allWeeks: [unknown], currentWeek: unknown },
    { exerciseLogs: [{ exercise_id: 'lift', set_number: 1 }] },
  ]) {
    let navigations = 0
    const f = setup({ ...extra, onProgram: () => navigations++ })
    assert.equal(before(f.root).length, 0)
    assert.doesNotMatch(f.root.textContent, /Ingen kort rutine|ingen kort rutine|Dag ikke fastlagt/)
    assert.match(f.root.textContent, /Find øvelser efter problematik/)
    assert.ok(nodes(f.root, 'details').length > 0)
    assert.equal(f.writes.length, 0)
    const go = button(f.root, 'Til programmet'); go.click(); go.click()
    assert.equal(navigations, 1); assert.equal(f.root.textContent, '')
    assert.equal(f.writes.length, 0); f.dispose()
  }
})

test('flexible routines omit appointment labels; actual dated routines keep their date', () => {
  const flexible = setup()
  assert.equal(before(flexible.root).length, 1)
  assert.match(flexible.root.textContent, /Forbered din squat/)
  assert.doesNotMatch(before(flexible.root)[0].textContent, /Dag ikke fastlagt|nov\./)
  button(flexible.root, 'Start mobilitet').click()
  assert.match(flexible.root.textContent, /1 af 3/)
  assert.equal(flexible.writes.length, 0); flexible.dispose()
  const dated = structuredClone(week); dated.sessions[0].weekday = 2
  const f = setup({ allWeeks: [dated], currentWeek: dated })
  assert.match(before(f.root)[0].textContent, /4\. nov\./); f.dispose()
})

test('zero and nonzero weekly counts and day marks explicitly describe this device', () => {
  const f = setup()
  assert.match(f.root.textContent, /0 rutiner gennemført på denne enhed/)
  assert.equal(nodes(f.root, 'li').length, 7)
  assert.ok(nodes(f.root, 'li').every(n => n.attributes['aria-label'].endsWith('på denne enhed')))
  button(f.root, 'Start mobilitet').click()
  button(f.root, 'Næste øvelse').click(); button(f.root, 'Næste øvelse').click()
  button(f.root, 'Afslut mobilitet').click()
  assert.match(f.root.textContent, /1 rutine gennemført på denne enhed/)
  assert.deepEqual(f.writes, ['entropi2:mobility:done:v1:synthetic-a'])
  f.dispose()
})

test('unknown homework authors use the coach role once, retain local notice and keep known names', () => {
  const f = setup(); f.dispose()
  assert.equal(saveHomework('synthetic-a', { problemId: 'squat-ankle', exerciseIds: ['sq-mob-2'] }, f.storage).error, null)
  const notes = coachNotes('synthetic-a', '', { Bænkpres: { need: 'Skulderposition', ids: ['bp-mob-2'] } }, WARMUP_BASE)
  const options = { ...f.options, athlete: { id: 'synthetic-a', coach_id: 'synthetic-coach', notes },
    homeworkEnabled: true, coachEnabled: true }
  for (const coach of [undefined, { id: 'foreign', name: 'Other fixture' }, { id: 'synthetic-coach', name: ' ' }]) {
    const stop = mountMobility(f.root, { ...options, coach })
    assert.match(f.root.textContent, /Hjemmeøvelser fra din coach/)
    assert.match(f.root.textContent, /Gemt på denne enhed/)
    assert.doesNotMatch(f.root.textContent, /navn ikke gemt|navn er ikke tilgængeligt|Valgt af|Other fixture/)
    assert.equal(mobilityModel({ ...options, coach }).homeworkAuthor, 'Fra din coach')
    stop()
  }
  const stop = mountMobility(f.root, { ...options, coach: { id: 'synthetic-coach', name: 'Fixturecoach' } })
  assert.match(f.root.textContent, /Valgt af Fixturecoach/)
  assert.equal(f.writes.length, 1); stop()
})

test('read failures remain visible even without a routine; no false successful weekly count', () => {
  const f = setup({ allWeeks: [], currentWeek: null, homeworkEnabled: true,
    storage: { getItem() { throw Error('synthetic denied') }, setItem() { assert.fail('render wrote') } } })
  assert.equal(before(f.root).length, 0)
  assert.match(f.root.textContent, /Ugeoversigten kunne ikke læses på denne enhed/)
  assert.match(f.root.textContent, /Tildelingen kunne ikke læses/)
  assert.doesNotMatch(f.root.textContent, /0 rutiner gennemført/)
  assert.match(f.root.textContent, /Find øvelser efter problematik/)
  f.dispose()
})
