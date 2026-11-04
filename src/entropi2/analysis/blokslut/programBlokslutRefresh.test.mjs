// Lifecycle regression against the actual copied screen. Synthetic hooks/backend;
// real React render coverage remains in programBlokslutReact.test.mjs.
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { install } from '../../../athlete/prog3Loader.mjs'
import { mount, nodes, text, enableEffects, flushEffects } from '../../../athlete/prog3Dom.mjs'
import { snapshot } from './blokslutFixture.mjs'
import { fixture } from './programBlokslutBackendFixture.mjs'
install()
registerHooks({ resolve(specifier, context, next) {
  if (specifier === '../../../supabase.js' && context.parentURL?.endsWith('/programBlokslut.mjs'))
    return { url: new URL('./programBlokslutBackendFixture.mjs', import.meta.url).href, shortCircuit: true }
  return next(specifier, context)
} })
const { default: Program } = await import('../../../athlete/ProgramTab.jsx')
const NativeDate = Date
let instant
globalThis.Date = class extends NativeDate {
  constructor(...args) { super(...(args.length ? args : [instant])) }
}
enableEffects()
const store = new Map()
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: key => store.get(key), setItem: (key, value) => {
    assert.ok(key.startsWith('entropi2:blokslut:v1:')); store.set(key, value)
  },
} })
test.after(() => { globalThis.Date = NativeDate; delete globalThis.localStorage })
function props() {
  const allWeeks = snapshot().block.weeks.map((week, i) => ({ ...week, id: `refresh-w${i}`, week_number: i + 1 }))
  return { allWeeks, currentWeek: allWeeks[2], viewingWeekIdx: 2, athlete: { id: 'synthetic-refresh' },
    computeActiveWeekIdx: () => 0, exerciseLogs: [], pastLogs: [], readinessLog: { readiness_score: 100 },
    fmtWeekRange: () => '', weekStartDate: (_, n) => allWeeks[n - 1].start_date,
    fetchProgramBlockLogs: async () => [], progOpenSession: null, sessionRefs: { current: {} } }
}
const card = tree => nodes(tree, n => n.props['data-program-blokslut'])[0]
const reads = () => fixture.calls.filter(c => ['weeks', 'exercise_logs'].includes(c.table)).map(c => c.table)
async function tick(screen) {
  await flushEffects(); await new Promise(resolve => setTimeout(resolve, 1))
  const tree = screen.render(); await flushEffects(); return tree
}
async function until(screen, predicate) {
  for (let i = 0; i < 100; i++) { const tree = await tick(screen); if (predicate(tree)) return tree }
  assert.fail('Synthetic report did not settle')
}
async function ready() {
  instant = '2026-11-04T12:00:00Z'; store.clear()
  const p = props()
  Object.assign(fixture, { weeks: p.allWeeks, rows: snapshot().exerciseLogs,
    calls: [], failure: false, planFailure: false, wait: null })
  const screen = mount(Program, p); screen.render()
  const tree = await until(screen, tree => /Gennemførte pas: 3 af 3/.test(text(card(tree))))
  card(tree).props.onToggle({ currentTarget: { open: false } })
  return { p, screen, before: text(card(screen.render())), calls: reads() }
}
test('set updates and past-week navigation retain the report and perform no report reads', async () => {
  const { p, screen, before, calls } = await ready()
  for (const next of [
    { ...p, exerciseLogs: [{ exercise_id: 'ex-2-0', set_number: 1, pending: true }] },
    { ...p, exerciseLogs: snapshot().exerciseLogs },
    { ...p, viewingWeekIdx: 0, pastLogs: snapshot().exerciseLogs.slice(0, 4) },
  ]) {
    const tree = screen.render(next)
    assert.equal(text(card(tree)), before, 'no missing card during the synchronous render')
    assert.equal(card(tree).props.open, false)
    for (let i = 0; i < 4; i++) assert.equal(text(card(await tick(screen))), before)
    assert.deepEqual(reads(), calls, 'neither boundary nor log queries may repeat per set/navigation')
  }
})
test('an equivalent plan snapshot does not reload or reset the fold', async () => {
  const { p, screen, before, calls } = await ready()
  const tree = screen.render({ ...p, allWeeks: structuredClone(p.allWeeks) })
  assert.equal(text(card(tree)), before)
  for (let i = 0; i < 4; i++) await tick(screen)
  assert.deepEqual(reads(), calls); assert.equal(card(screen.render()).props.open, false)
})
test('a new Danish day in the same week does not reload the report', async () => {
  const { screen, before, calls } = await ready()
  instant = '2026-11-05T12:00:00Z'
  assert.equal(text(card(screen.render())), before)
  for (let i = 0; i < 4; i++) await tick(screen)
  assert.deepEqual(reads(), calls)
})
test('the Danish week boundary reloads once and keeps the prior report/fold until ready', async () => {
  const { screen, before, calls } = await ready()
  instant = '2026-11-08T22:59:59Z' // Still Sunday in Copenhagen.
  screen.render(); await tick(screen); assert.deepEqual(reads(), calls)
  let release
  fixture.wait = new Promise(resolve => { release = resolve })
  try {
    fixture.rows = []
    instant = '2026-11-08T23:00:00Z' // Monday in Copenhagen.
    assert.equal(text(card(screen.render())), before)
    await until(screen, () => reads().length === calls.length + 2)
    assert.equal(text(card(screen.render())), before)
    assert.equal(card(screen.render()).props.open, false)
    fixture.wait = null; release()
    const tree = await until(screen, tree => /Ingen bekræftede/.test(text(card(tree))))
    assert.equal(card(tree).props.open, false)
    assert.deepEqual(reads(), [...calls, 'weeks', 'exercise_logs'])
  } finally { fixture.wait = null; release() }
})
test('a changed block retains the old report during the read, then shows the new block', async () => {
  const { p, screen, before, calls } = await ready()
  const nextWeeks = p.allWeeks.map(w => ({ ...w, block_name: 'Syntetisk ny blok',
    sessions: w.sessions.map(s => ({ ...s, exercises: s.exercises.map(e => ({ ...e, id: 'new-' + e.id })) })) }))
  fixture.weeks = nextWeeks; fixture.rows = []
  let release
  fixture.wait = new Promise(resolve => { release = resolve })
  try {
    assert.equal(text(card(screen.render({ ...p, allWeeks: nextWeeks }))), before)
    await until(screen, () => reads().length === calls.length + 2)
    assert.equal(text(card(screen.render())), before)
    fixture.wait = null; release()
    assert.match(text(card(await until(screen, tree => /Ingen bekræftede/.test(text(card(tree)))))), /Ingen bekræftede/)
  } finally { fixture.wait = null; release() }
})
test('expired reports disappear after confirmation and a different athlete never sees the old report', async () => {
  const { p, screen } = await ready()
  instant = '2026-11-16T12:00:00Z'
  screen.render(); await tick(screen)
  assert.equal(card(screen.render()), undefined)
  instant = '2026-11-04T12:00:00Z'
  screen.render(); await until(screen, tree => /Gennemførte pas/.test(text(card(tree))))
  assert.equal(card(screen.render({ ...p, athlete: { id: 'synthetic-other' } })), undefined)
  await until(screen, tree => /Gennemførte pas/.test(text(card(tree))))
  assert.ok(fixture.calls.some(c => c.eq?.[1] === 'synthetic-other'))
})
test('a failed refresh is honest and explicit retry retains its fold until replacement data arrive', async () => {
  const { screen, before, calls } = await ready()
  fixture.failure = true; instant = '2026-11-09T12:00:00Z'
  assert.equal(text(card(screen.render())), before)
  const failed = await until(screen, tree => /kunne ikke hentes/.test(text(card(tree))))
  assert.doesNotMatch(text(card(failed)), /Gennemførte pas|\+11/)
  assert.equal(card(failed).props.open, false)
  let release
  fixture.failure = false; fixture.wait = new Promise(resolve => { release = resolve })
  try {
    nodes(card(failed), n => n.type === 'button')[0].props.onClick()
    assert.match(text(card(screen.render())), /kunne ikke hentes/)
    await until(screen, () => reads().length === calls.length + 4)
    assert.match(text(card(screen.render())), /kunne ikke hentes/)
    fixture.wait = null; release()
    const retried = await until(screen, tree => /Gennemførte pas: 3 af 3/.test(text(card(tree))))
    assert.equal(card(retried).props.open, false)
    assert.deepEqual(reads(), [...calls, 'weeks', 'exercise_logs', 'weeks', 'exercise_logs'])
  } finally { fixture.wait = null; release() }
})
test('week refresh follows actual plan dates even when the first training day is Wednesday', async () => {
  const { p, screen } = await ready()
  const shifted = p.allWeeks.map((w, i) => ({ ...w, start_date: ['2026-10-21', '2026-10-28', '2026-11-04'][i] }))
  fixture.weeks = shifted
  const next = { ...p, allWeeks: shifted }
  screen.render(next)
  await until(screen, tree => /21.10.2026/.test(text(card(tree))))
  const calls = reads()
  instant = '2026-11-09T12:00:00Z' // Monday is still the same training week.
  screen.render(); for (let i = 0; i < 4; i++) await tick(screen)
  assert.deepEqual(reads(), calls)
  instant = '2026-11-10T23:00:00Z' // Wednesday, Copenhagen.
  screen.render(); await until(screen, () => reads().length === calls.length + 2)
  assert.deepEqual(reads(), [...calls, 'weeks', 'exercise_logs'])
  await tick(screen)
})
