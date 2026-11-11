import test from 'node:test'
import assert from 'node:assert/strict'
import { install } from './mobility-loader.mjs'
import { dom, nodes, button, fakeClock } from './synthetic-dom.mjs'

// U9 punkt 2 (Marc 11. nov.): ingen tekstvæg før start; forklaringen står kun ét sted, i den førte vejledning.
// Vejledningen har ét fokus pr. skærm og tydelig fremdrift: "Øvelse 2 af 3", en bjælke og tiden.
const hooks = install()
const { mountMobility } = await import('./mobility-screen.mjs')
const { mobilityModel } = await import('./mobility-model.mjs')
test.after(() => hooks.deregister())

const week = { id: 'week', start_date: '2026-10-26', week_number: 1,
  sessions: [{ id: 'session', weekday: 3, exercises: [{ id: 'lift', name: 'Squat', sets: 2 }] }] }
const options = clock => {
  const values = new Map()
  return { enabled: true, athlete: { id: 'synthetic-u9' }, clock,
    storage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) },
    allWeeks: [week], currentWeek: week, exerciseLogs: [], now: new Date('2026-10-29T12:00:00Z'), onProgram() {} }
}
const before = root => nodes(root, 'section').find(n => n.attributes['aria-label'] === 'Før næste pas')

test('U9 2: før start kun navnene på øvelserne, ingen beskrivelser og ingen doseringstekst', () => {
  const root = dom(), clock = fakeClock(), o = options(clock)
  const routine = mobilityModel(o).routine
  assert.ok(routine.length >= 2)
  const dispose = mountMobility(root, o)
  try {
    const intro = before(root)
    assert.ok(intro)
    assert.equal(nodes(intro, 'article').length, 0, 'ingen øvelseskort før start')
    for (const ex of routine) {
      assert.ok(intro.textContent.includes(ex.name), ex.name)
      assert.equal(intro.textContent.includes(ex.desc), false, 'beskrivelsen står kun i vejledningen')
    }
    assert.doesNotMatch(intro.textContent, /Følg øvelsernes dosering/)
    assert.equal(nodes(intro, 'button').filter(n => n.textContent === 'Start mobilitet').length, 1)
  } finally { dispose() }
})

test('U9 2: vejledningen viser "Øvelse 1 af N", en fremdriftsbjælke og tiden; forklaringen står her', () => {
  const root = dom(), clock = fakeClock(), o = options(clock)
  const routine = mobilityModel(o).routine
  const dispose = mountMobility(root, o)
  try {
    button(root, 'Start mobilitet').click()
    assert.match(root.textContent, new RegExp(`Øvelse 1 af ${routine.length}`))
    const bar = nodes(root, 'div').find(n => n.attributes.role === 'progressbar')
    assert.ok(bar, 'fremdriftsbjælke')
    assert.equal(bar.attributes['aria-valuenow'], '1'); assert.equal(bar.attributes['aria-valuemax'], String(routine.length))
    assert.match(root.textContent, /Tid 0:00/)
    assert.ok(root.textContent.includes(routine[0].desc), 'forklaringen står i vejledningen')
    assert.equal(nodes(root, 'h2').length, 1, 'ét fokus pr. skærm')
    clock.advance(65000)
    button(root, 'Næste øvelse').click()
    assert.match(root.textContent, new RegExp(`Øvelse 2 af ${routine.length}`))
    assert.match(root.textContent, /Tid 1:05/)
    assert.equal(nodes(root, 'div').find(n => n.attributes.role === 'progressbar').attributes['aria-valuenow'], '2')
    assert.equal(clock.count, 0, 'tiden kræver ingen ekstra timer')
  } finally { dispose() }
})
