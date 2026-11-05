import test from 'node:test'
import assert from 'node:assert/strict'
import { install } from './mobility-loader.mjs'
import { dom, nodes, button, fakeClock } from './synthetic-dom.mjs'
const hooks = install()
const { mountMobility } = await import('./mobility-screen.mjs')
const { MOBILITY_DONE_PREFIX } = await import('./mobilityDone.mjs')
test.after(() => hooks.deregister())

const athleteId = 'synthetic-retry'
const doneKey = MOBILITY_DONE_PREFIX + athleteId
const homeworkKey = 'hara:mobility-homework:v1:' + JSON.stringify(athleteId)
const done = JSON.stringify({ version: 1, athleteId, entries: [
  { day: '2026-11-03', routineId: 'recommendation:v1:sq-mob-2:sq-mob-3:sq-mov-1' },
] })
const homework = JSON.stringify({ version: 1, athleteId,
  value: { problemId: 'squat-ankle', exerciseIds: ['sq-mob-2'] } })
function fixture(extra = {}) {
  const values = new Map([[doneKey, done], [homeworkKey, homework]])
  const denied = new Set([doneKey, homeworkKey]), reads = [], writes = []
  const storage = {
    getItem(key) { reads.push(key); if (denied.has(key)) throw Error('synthetic denied'); return values.get(key) ?? null },
    setItem(...args) { writes.push(args); assert.fail('retry must never write') },
    removeItem() { assert.fail('retry must never delete') },
  }
  const week = { id: 'week', week_number: 1, start_date: '2026-11-02', sessions: [
    { id: 'session', weekday: null, exercises: [{ id: 'lift', name: 'Squat', sets: 3 }] },
  ] }
  const root = dom(), clock = fakeClock()
  const options = { enabled: true, athlete: { id: athleteId }, allWeeks: [week], currentWeek: week,
    exerciseLogs: [], now: new Date('2026-11-03T12:00:00Z'), storage, clock, homeworkEnabled: true, ...extra }
  const dispose = mountMobility(root, options)
  return { root, clock, values, denied, reads, writes, dispose, options }
}
const section = (root, heading) => nodes(root, 'section').find(n => nodes(n, 'h2').some(h => h.textContent === heading))

test('local week retry rereads actual storage and also rebuilds captured homework model without writes', () => {
  const f = fixture()
  assert.match(f.root.textContent, /Ugeoversigten kunne ikke læses|Tildelingen kunne ikke læses/)
  assert.doesNotMatch(f.root.textContent, /0 rutiner gennemført|Rutine gennemført i dag/)
  const old = button(section(f.root, 'Denne uge'), 'Hent igen')
  const before = f.reads.length
  f.denied.clear(); old.click()
  assert.ok(f.reads.length > before)
  assert.match(f.root.textContent, /1 rutine gennemført på denne enhed|Rutine gennemført i dag/)
  assert.match(section(f.root, 'Hjemmeøvelser fra din coach').textContent, /Ankel-vægstræk/)
  assert.doesNotMatch(f.root.textContent, /kunne ikke læses|Hent igen/)
  assert.equal(nodes(f.root, 'li').filter(n => n.textContent.includes('✓')).length, 1)
  const after = f.reads.length; old.click(); assert.equal(f.reads.length, after)
  assert.deepEqual(f.values, new Map([[doneKey, done], [homeworkKey, homework]]))
  assert.deepEqual(f.writes, []); assert.equal(f.clock.count, 0); f.dispose()
})

test('homework retry really rereads the assignment; repeated denial and malformed bytes keep error and no false zero', () => {
  const f = fixture()
  button(section(f.root, 'Hjemmeøvelser fra din coach'), 'Hent igen').click()
  assert.match(f.root.textContent, /Tildelingen kunne ikke læses/)
  assert.match(f.root.textContent, /Ugeoversigten kunne ikke læses/)
  f.denied.clear(); f.values.set(doneKey, '{'); f.values.set(homeworkKey, '{')
  button(section(f.root, 'Hjemmeøvelser fra din coach'), 'Hent igen').click()
  assert.match(f.root.textContent, /Tildelingen kunne ikke læses/)
  assert.doesNotMatch(f.root.textContent, /0 rutiner gennemført|Rutine gennemført i dag/)
  assert.equal(f.values.get(doneKey), '{'); assert.equal(f.values.get(homeworkKey), '{')
  f.values.set(homeworkKey, homework)
  button(section(f.root, 'Hjemmeøvelser fra din coach'), 'Hent igen').click()
  assert.doesNotMatch(f.root.textContent, /Tildelingen kunne ikke læses/)
  assert.match(f.root.textContent, /Ugeoversigten kunne ikke læses/)
  assert.deepEqual(f.writes, []); f.dispose()
})

test('successful empty local reads remain honest; program and catalog remain available', () => {
  let navigated = 0
  const f = fixture({ allWeeks: [], currentWeek: null, onProgram() { navigated++ } })
  f.denied.clear(); f.values.clear()
  button(section(f.root, 'Denne uge'), 'Hent igen').click()
  assert.match(f.root.textContent, /0 rutiner gennemført på denne enhed/)
  assert.equal(section(f.root, 'Hjemmeøvelser fra din coach').hidden, true)
  assert.ok(nodes(f.root, 'details').length > 0)
  button(f.root, 'Til programmet').click(); assert.equal(navigated, 1)
  assert.deepEqual(f.writes, []); f.dispose()
})

test('disposed/OFF/old-day retry is inert and never touches another athlete namespace', () => {
  const f = fixture(); const old = button(section(f.root, 'Denne uge'), 'Hent igen')
  f.dispose(); const before = f.reads.length; old.click(); assert.equal(f.reads.length, before)
  assert.ok(f.reads.every(k => k === doneKey || k === homeworkKey))
  const poison = new Proxy({}, { get() { assert.fail('OFF read') } })
  for (const enabled of [false, undefined, 1, 'true']) mountMobility(poison, { enabled, athlete: poison, storage: poison })()
  let current = true, stale = 0
  const g = fixture({ isCurrentDay: () => current, onStaleDay() { stale++ } })
  const retry = button(section(g.root, 'Denne uge'), 'Hent igen'); current = false
  const count = g.reads.length; retry.click()
  assert.equal(stale, 1); assert.equal(g.reads.length, count); assert.deepEqual(g.writes, []); g.dispose()
})


test('a changed or disabled caller cannot use an old retry to read another athlete', () => {
  for (const change of ['athlete', 'off']) {
    const f = fixture(), old = button(section(f.root, 'Denne uge'), 'Hent igen')
    const count = f.reads.length
    if (change === 'athlete') f.options.athlete = { id: 'synthetic-other' }
    else f.options.enabled = false
    old.click(); assert.equal(f.reads.length, count); assert.deepEqual(f.writes, [])
    f.dispose()
  }
})

test('homework recovery without assignment focuses the visible week heading', () => {
  const f = fixture(), focused = []
  const create = f.root.ownerDocument.createElement
  f.root.ownerDocument.createElement = tag => {
    const node = create(tag); node.focus = () => focused.push(node); return node
  }
  f.denied.clear(); f.values.delete(homeworkKey)
  button(section(f.root, 'Hjemmeøvelser fra din coach'), 'Hent igen').click()
  assert.equal(section(f.root, 'Hjemmeøvelser fra din coach').hidden, true)
  assert.equal(focused.at(-1), nodes(section(f.root, 'Denne uge'), 'h2')[0])
  assert.deepEqual(f.writes, []); f.dispose()
})
