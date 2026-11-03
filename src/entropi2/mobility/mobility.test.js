import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { install } from './mobility-loader.mjs'
import { dom, nodes, button, fakeClock } from './synthetic-dom.mjs'
import { bindHooks } from './synthetic-react.mjs'
const hooks = install()
const { mobilityModel, nextMobilitySession } = await import('./mobility-model.mjs')
const { mountMobility } = await import('./mobility-screen.mjs')
const { default: Mobility } = await import('./Mobility.mjs')
const { saveHomework } = await import('./public-mobilityHomework.mjs')
const { coachNotes } = await import('./public-coachMobility.mjs')
const { WARMUP_BASE } = await import('./public-mobilityCatalog.mjs')
const { nextTrainingHome } = await import('./public-nextTrainingHome.mjs')
const lift = (id = 'squat', name = 'Squat', sets = 3) => ({ id, name, sets })
const session = (id, weekday, exercises = [lift(id)]) => ({ id, weekday, session_order: 0, exercises })
const week = (id, start_date, sessions, week_number = 1) => ({ id, start_date, sessions, week_number })
const a = week('w1', '2026-10-19', [session('old', 0)])
const b = week('w2', '2026-10-26', [session('next', 0)], 2)
const input = (changes = {}) => ({ enabled: true, athlete: { id: 'a', coach_id: 'coach-a' },
  allWeeks: [a, b], currentWeek: a, exerciseLogs: [], storage: memory(), now: new Date('2026-10-25T12:00Z'), ...changes })
const memory = () => {
  const values = new Map(); let writes = 0
  return { values, get writes() { return writes }, getItem: key => values.get(key) ?? null,
    setItem(key, value) { writes++; values.set(key, value) } }
}

test('public copies exactly match pinned contract hashes', () => {
  const manifest = JSON.parse(readFileSync(new URL('./PUBLIC-CONTRACTS.json', import.meta.url)))
  for (const [name, meta] of Object.entries(manifest.files)) {
    const bytes = readFileSync(new URL(name, import.meta.url))
    assert.equal(bytes.length, meta.bytes)
    assert.equal(createHash('sha256').update(bytes).digest('hex'), meta.sha256)
  }
})
test('strict default OFF does not read inputs, storage or DOM', () => {
  const dangerous = new Proxy({}, { get() { assert.fail('OFF access') } })
  for (const enabled of [undefined, false, 'true', 1, null]) {
    const options = { enabled, athlete: dangerous, allWeeks: dangerous, storage: dangerous }
    assert.equal(mobilityModel(options), null)
    const root = dom(); root.textContent = 'existing'
    mountMobility(root, options)(); assert.equal(root.textContent, 'existing')
  }
})
test('week change, rest day, both DST changes and future actual sessions reuse calendar selector', () => {
  const cases = [input(), input({ now: new Date('2026-10-25T00:30Z') }),
    input({ now: new Date('2026-10-25T01:30Z') }),
    input({ allWeeks: [week('s1', '2026-03-23', [], 1), week('s2', '2026-03-30', [session('spring', 0)], 2)],
      currentWeek: week('s1', '2026-03-23', [], 1), now: new Date('2026-03-29T01:30Z') })]
  for (const p of cases) {
    const baseline = nextTrainingHome(p)
    const selected = nextMobilitySession(p)
    assert.equal(selected.date, baseline.date)
    assert.equal(selected.week.week_number, baseline.weekNumber)
    assert.equal(mobilityModel(p).routine.length, 3)
  }
  const rest = week('r', '2026-10-19', [session('past', 0), session('future', 4), session('later', 6)])
  assert.equal(mobilityModel(input({ allWeeks: [rest], currentWeek: rest, now: new Date('2026-10-22T12:00Z') })).selected.session.id, 'future')
})
test('today selects only actual today/flexible sessions; no old unfinished lift', () => {
  for (const day of [6, null]) {
    const w = week('w', '2026-10-19', [session('stale', 0), session('today', day, [lift('bench', 'Bench press')])])
    const model = mobilityModel(input({ allWeeks: [w], currentWeek: w }))
    assert.equal(model.selected.session.id, 'today')
    assert.equal(model.lift, 'Bænkpres')
    assert.equal(model.routine[0].id, 'bp-mob-2')
  }
})
test('zero/missing sets, missing week/logs, unknown lifts, invalid dates never offer Start', () => {
  const variants = [{ currentWeek: null }, { exerciseLogs: undefined }, { exerciseLogs: [null] },
    { allWeeks: [] , currentWeek: null }, { now: new Date('invalid') }]
  for (const sets of [0, undefined, -1, '3']) variants.push({ allWeeks: [a, { ...b, sessions: [session('bad', 0, [{ id: 'x', name: 'Squat', sets }])] }] })
  variants.push({ allWeeks: [a, { ...b, start_date: '2026-02-30' }] })
  variants.push({ allWeeks: [a, { ...b, sessions: [session('unknown', 0, [lift('x', 'Mystery')])] }] })
  for (const variant of variants) {
    const root = dom(); const stop = mountMobility(root, input(variant))
    assert.equal(nodes(root, 'button').some(n => n.textContent === 'Start mobilitet'), false)
    stop()
  }
})
test('first supported actual main lift wins; no mixed squat and bench routine', () => {
  const exercises = [lift('rdl', 'Romanian deadlift'), lift('bench', 'Bench press'), lift('sq', 'Squat')]
  const p = input({ allWeeks: [a, { ...b, sessions: [session('two', 0, exercises)] }] })
  const before = JSON.stringify(p)
  assert.deepEqual(mobilityModel(p).routine.map(e => e.id), ['bp-mob-2', 'bp-akt-3', 'bp-akt-1'])
  assert.equal(JSON.stringify(p), before)
  for (const name of ['Deadlift', 'Sumo deadlift']) {
    const m = mobilityModel(input({ allWeeks: [a, { ...b, sessions: [session('d', 0, [lift('d', name)])] }] }))
    assert.equal(m.lift, 'Dødløft'); assert.equal(m.routine.length, 3)
    assert.equal(m.routine[0].id, name.startsWith('Sumo') ? 'ds-mob-2' : 'dk-mob-3')
  }
})
test('any session progress or skipped set suppresses routine; foreign athlete logs do not', () => {
  for (const row of [{ exercise_id: 'next', set_number: 1 }, { exercise_id: 'next', set_number: 2, skipped: true }]) {
    assert.equal(mobilityModel(input({ exerciseLogs: [row] })).routine.length, 0)
    assert.equal(mobilityModel(input({ exerciseLogs: [{ ...row, athlete_id: 'other' }] })).routine.length, 3)
  }
})
test('local homework content/dose first, actual matching coach name, library follows; no writes', () => {
  const storage = memory()
  assert.equal(saveHomework('a', { problemId: 'squat-ankle', exerciseIds: ['sq-mob-2'] }, storage).error, null)
  const notes = coachNotes('a', 'Existing notes', { Bænkpres: { need: 'Skulderposition', ids: ['bp-mob-2'] } }, WARMUP_BASE)
  const options = input({ athlete: { id: 'a', coach_id: 'coach-a', notes }, coach: { id: 'coach-a', name: 'Synthetic coach' },
    homeworkEnabled: true, coachEnabled: true, storage })
  const original = [...storage.values]; const root = dom(); mountMobility(root, options)()
  mountMobility(root, options)
  const text = root.textContent
  assert.match(text, /10 reps pr. side/); assert.match(text, /Stå med tåen/)
  assert.match(text, /Valgt af Synthetic coach/)
  assert.ok(text.indexOf('Hjemmeøvelser fra din coach') < text.indexOf('Find øvelser efter problematik'))
  assert.deepEqual([...storage.values], original); assert.equal(storage.writes, 1)
  assert.equal(mobilityModel({ ...options, athlete: { ...options.athlete, id: 'b' } }).assigned.length, 0)
  assert.equal(mobilityModel({ ...options, athlete: { ...options.athlete, id: 'b' } }).choices.length, 0)
  assert.equal(mobilityModel({ ...options, coach: { id: 'other', name: 'Wrong' } }).coachName, null)
})
test('corrupt/denied storage surfaces read failure and remains unchanged; subflags stay OFF', () => {
  const storage = { getItem() { throw Error('denied') }, setItem() { assert.fail('write') } }
  assert.equal(mobilityModel(input({ storage })).error, '')
  assert.match(mobilityModel(input({ storage, homeworkEnabled: true })).error, /kunne ikke læses/)
  const mem = memory(); mem.values.set('hara:mobility-homework:v1:"a"', '{bad')
  assert.match(mobilityModel(input({ storage: mem, homeworkEnabled: true })).error, /kunne ikke læses/)
  assert.equal(mem.writes, 0)
})
test('actual handlers: reps, next, two side timers, drift, skip, finish, navigation and cleanup', () => {
  const root = dom(), clock = fakeClock(), calls = []
  const stop = mountMobility(root, input({ clock, onProgram: () => calls.push('program') }))
  button(root, 'Start mobilitet').click(); assert.match(root.textContent, /1 af 3/)
  assert.equal(nodes(root, 'button').some(n => n.textContent === 'Start sidetimer'), false)
  button(root, 'Næste øvelse').click(); assert.match(root.textContent, /2 af 3/)
  button(root, 'Start sidetimer').click(); button(root, 'Start sidetimer').click()
  assert.equal(clock.count, 1)
  clock.advance(45000); assert.equal(clock.count, 0); assert.match(root.textContent, /Skift side/)
  button(root, 'Start sidetimer').click(); clock.advance(30000)
  assert.match(root.textContent, /Doseringen er færdig/)
  button(root, 'Næste øvelse').click()
  button(root, 'Afslut mobilitet').click(); assert.equal(clock.count, 0)
  button(root, 'Start mobilitet').click(); button(root, 'Næste øvelse').click()
  button(root, 'Start sidetimer').click(); const stale = clock.history.at(-1)
  button(root, 'Spring over').click(); const home = root.textContent; stale()
  assert.equal(root.textContent, home); assert.equal(clock.count, 0)
  button(root, 'Start mobilitet').click(); button(root, 'Næste øvelse').click()
  button(root, 'Start sidetimer').click(); const oldNav = button(root, 'Til programmet')
  oldNav.click(); oldNav.click(); assert.deepEqual(calls, ['program'])
  assert.equal(root.textContent, ''); assert.equal(clock.count, 0); stop(); stop()
})
test('React wrapper imports actual mount; effect disposal isolates athlete and flag changes', () => {
  const root = dom(), clock = fakeClock(); let effect, cleanup
  bindHooks({ useRef: () => ({ current: root }), useEffect: fn => { effect = fn } })
  const render = props => { cleanup?.(); const element = Mobility(props); cleanup = effect(); return element }
  assert.equal(render(input({ clock })).type, 'div')
  button(root, 'Start mobilitet').click(); button(root, 'Næste øvelse').click(); button(root, 'Start sidetimer').click()
  render(input({ athlete: { id: 'b' }, clock })); assert.equal(clock.count, 0)
  assert.match(root.textContent, /Mobilitet/)
  assert.equal(render(input({ enabled: false, clock })), null)
  assert.equal(root.textContent, ''); assert.equal(clock.count, 0)
  cleanup?.(); bindHooks(null)
})
test.after(() => hooks.deregister())
