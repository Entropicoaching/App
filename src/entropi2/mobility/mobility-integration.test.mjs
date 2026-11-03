import test from 'node:test'
import assert from 'node:assert/strict'
import { install } from './mobility-loader.mjs'
import { dom, nodes, button, fakeClock } from './synthetic-dom.mjs'
const hooks = install()
const { mountMobility } = await import('./mobility-screen.mjs')
const { mobilityModel } = await import('./mobility-model.mjs')
const { MOBILITY_DONE_PREFIX } = await import('./mobilityDone.mjs')
test.after(() => hooks.deregister())

function fixture(changes = {}) {
  const values = new Map(), writes = [], reads = []
  const storage = {
    getItem(key) { reads.push(key); return values.get(key) ?? null },
    setItem(key, value) { writes.push(key); values.set(key, value) },
  }
  const week = { id: 'week', week_number: 1, start_date: '2026-11-02', sessions: [
    { id: 'session', weekday: null, exercises: [{ id: 'lift', name: 'Squat', sets: 3 }] },
  ] }
  const options = { enabled: true, athlete: { id: 'synthetic-a' }, storage,
    allWeeks: [week], currentWeek: week, exerciseLogs: [], now: new Date('2026-11-03T12:00Z'), ...changes }
  const root = dom(), clock = fakeClock()
  const dispose = mountMobility(root, { ...options, clock })
  return { root, clock, options, storage, values, reads, writes, dispose }
}
function lastStep(root) {
  button(root, 'Start mobilitet').click()
  button(root, 'Næste øvelse').click()
  button(root, 'Næste øvelse').click()
}
function finish(root) { lastStep(root); button(root, 'Afslut mobilitet').click() }

test('recommendation is first, full catalog routine runs, marking survives remount and duplicates', () => {
  const f = fixture()
  const sections = nodes(f.root, 'section')
  assert.equal(sections[0].attributes['aria-label'], 'Før næste pas')
  assert.match(sections[0].textContent, /Dagens squat får fokus på ankler og hofter/)
  assert.deepEqual(mobilityModel(f.options).routine.map(ex => ex.id), ['sq-mob-2', 'sq-mob-3', 'sq-mov-1'])
  assert.equal(f.writes.length, 0)
  finish(f.root)
  assert.match(f.root.textContent, /Rutine gennemført i dag/)
  assert.match(f.root.textContent, /1 rutine gennemført/)
  assert.deepEqual(f.writes, [MOBILITY_DONE_PREFIX + 'synthetic-a'])
  assert.equal(f.clock.count, 0)
  finish(f.root); assert.equal(f.writes.length, 1)
  f.dispose()
  const dispose = mountMobility(f.root, f.options)
  assert.match(f.root.textContent, /Rutine gennemført i dag/)
  const marks = nodes(f.root, 'li')
  assert.equal(marks.length, 7)
  assert.match(marks[1].attributes['aria-label'], /Tir 3\. nov\.: 1 rutine gennemført/)
  assert.ok(marks.filter(n => n.textContent.includes('✓')).length === 1)
  dispose()
})

test('start, skip, navigation and disposed handlers never mark; OFF never reads storage', () => {
  const f = fixture({ onProgram() {} })
  lastStep(f.root); const staleFinish = button(f.root, 'Afslut mobilitet')
  button(f.root, 'Spring over').click(); staleFinish.click()
  lastStep(f.root); const disposedFinish = button(f.root, 'Afslut mobilitet')
  button(f.root, 'Til programmet').click(); disposedFinish.click()
  f.dispose(); assert.equal(f.writes.length, 0); assert.equal(f.clock.count, 0)
  const poison = new Proxy({}, { get() { assert.fail('OFF input access') } })
  for (const enabled of [undefined, false, 'true', 1]) mountMobility(poison, { enabled, athlete: poison, storage: poison })()
})

test('storage failures keep final action available for retry, no false completion or history repair', () => {
  const f = fixture()
  const set = f.storage.setItem
  f.storage.setItem = () => { throw Error('quota') }
  lastStep(f.root); button(f.root, 'Afslut mobilitet').click()
  assert.match(f.root.textContent, /kunne ikke gemmes/)
  assert.doesNotMatch(f.root.textContent, /Rutine gennemført i dag/)
  assert.equal(f.values.size, 0)
  f.storage.setItem = set
  button(f.root, 'Afslut mobilitet').click()
  assert.match(f.root.textContent, /Rutine gennemført i dag/)
  f.dispose()
  for (const raw of ['{', JSON.stringify({ version: 1, athleteId: 'other', entries: [] })]) {
    f.values.set(MOBILITY_DONE_PREFIX + 'synthetic-a', raw)
    const stop = mountMobility(f.root, f.options)
    assert.match(f.root.textContent, /Ugeoversigten kunne ikke læses/)
    assert.doesNotMatch(f.root.textContent, /0 rutiner gennemført/)
    finish(f.root); assert.match(f.root.textContent, /kunne ikke gemmes/)
    assert.equal(f.values.get(MOBILITY_DONE_PREFIX + 'synthetic-a'), raw)
    stop()
  }
  f.storage.getItem = () => { throw Error('denied') }
  const stop = mountMobility(f.root, f.options)
  assert.match(f.root.textContent, /Ugeoversigten kunne ikke læses/)
  finish(f.root); assert.match(f.root.textContent, /kunne ikke gemmes/)
  stop()
  assert.equal(f.writes.length, 1)
})

test('athletes, Danish completion date and routine identities remain separate', () => {
  const f = fixture({ now: new Date('2026-11-02T23:30Z') })
  finish(f.root); f.dispose()
  const saved = JSON.parse(f.values.get(MOBILITY_DONE_PREFIX + 'synthetic-a'))
  assert.equal(saved.entries[0].day, '2026-11-03')
  let stop = mountMobility(f.root, { ...f.options, athlete: { id: 'synthetic-b' } })
  assert.doesNotMatch(f.root.textContent, /Rutine gennemført i dag/)
  assert.match(f.root.textContent, /0 rutiner gennemført/)
  finish(f.root); stop()
  const benchWeek = structuredClone(f.options.currentWeek)
  benchWeek.sessions[0].exercises[0].name = 'Bench press'
  stop = mountMobility(f.root, { ...f.options, allWeeks: [benchWeek], currentWeek: benchWeek })
  assert.match(f.root.textContent, /Dagens bænkpres/)
  assert.doesNotMatch(f.root.textContent, /Rutine gennemført i dag/)
  finish(f.root)
  assert.match(f.root.textContent, /2 rutiner gennemført/)
  stop()
  assert.deepEqual([...f.values.keys()].sort(), [MOBILITY_DONE_PREFIX + 'synthetic-a', MOBILITY_DONE_PREFIX + 'synthetic-b'])
})

test('stale-day Finish refuses a write and requests refresh; invalid screen date also cannot mark', () => {
  let current = true, refreshes = 0
  const f = fixture({ isCurrentDay: () => current, onStaleDay: () => { refreshes++ } })
  lastStep(f.root); current = false
  button(f.root, 'Afslut mobilitet').click()
  assert.equal(refreshes, 1); assert.equal(f.writes.length, 0)
  assert.match(f.root.textContent, /Dagen er skiftet/)
  f.dispose()
  const invalid = fixture({ now: new Date(NaN) })
  assert.match(invalid.root.textContent, /Ugeoversigten kunne ikke læses/)
  assert.equal(nodes(invalid.root, 'button').length, 0)
  assert.equal(invalid.writes.length, 0); invalid.dispose()
})

test('week count rolls over Monday and includes separate daily completions without an invented target', () => {
  const f = fixture(); finish(f.root); f.dispose()
  let stop = mountMobility(f.root, { ...f.options, now: new Date('2026-11-04T12:00Z') })
  assert.doesNotMatch(f.root.textContent, /Rutine gennemført i dag/)
  finish(f.root); assert.match(f.root.textContent, /2 rutiner gennemført/); stop()
  stop = mountMobility(f.root, { ...f.options, now: new Date('2026-11-09T12:00Z') })
  assert.match(f.root.textContent, /0 rutiner gennemført/)
  assert.equal(nodes(f.root, 'li').filter(n => n.textContent.includes('✓')).length, 0)
  assert.equal(f.writes.length, 2); stop()
})

test('screen follows all four recommendations; future session reason and completion day stay distinct', () => {
  for (const [name, ids, reason] of [
    ['Squat', ['sq-mob-2', 'sq-mob-3', 'sq-mov-1'], /ankler og hofter/],
    ['Bench press', ['bp-mob-2', 'bp-akt-3', 'bp-akt-1'], /skulderposition/],
    ['Deadlift', ['dk-mob-3', 'dk-akt-1', 'dk-mov-1'], /hofteposition/],
    ['Sumo deadlift', ['ds-mob-2', 'ds-mob-1', 'ds-mov-1'], /brede stilling/],
  ]) {
    const f = fixture(); f.dispose()
    const week = structuredClone(f.options.currentWeek)
    week.sessions[0].weekday = 2 // Wednesday, while the screen is Tuesday.
    week.sessions[0].exercises[0].name = name
    const options = { ...f.options, allWeeks: [week], currentWeek: week }
    const stop = mountMobility(f.root, options)
    assert.deepEqual(mobilityModel(options).routine.map(ex => ex.id), ids)
    assert.match(f.root.textContent, reason)
    assert.match(f.root.textContent, /Næste pas med/)
    assert.doesNotMatch(f.root.textContent, /Dagens /)
    assert.match(f.root.textContent, /4\. nov\./)
    finish(f.root)
    assert.equal(JSON.parse(f.values.get(MOBILITY_DONE_PREFIX + 'synthetic-a')).entries[0].day, '2026-11-03')
    stop()
  }
  const f = fixture({ storage: undefined })
  assert.match(f.root.textContent, /Ugeoversigten kunne ikke læses/)
  finish(f.root)
  assert.match(f.root.textContent, /kunne ikke gemmes/)
  assert.doesNotMatch(f.root.textContent, /Rutine gennemført i dag/)
  f.dispose()
})
