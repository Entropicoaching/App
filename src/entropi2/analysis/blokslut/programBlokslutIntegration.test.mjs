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
let instant = '2026-11-04T12:00:00Z'
class FixtureDate extends NativeDate { constructor(...args) { super(...(args.length ? args : [instant])) } }
globalThis.Date = FixtureDate
enableEffects()
const store = new Map()
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: key => store.get(key), setItem: (key, value) => store.set(key, value),
} })
test.after(() => { globalThis.Date = NativeDate; delete globalThis.localStorage })
function props(extra = {}) {
  const allWeeks = snapshot().block.weeks.map((w, i) => ({ ...w, id: `w-${i}`, week_number: i + 1 }))
  return { allWeeks, currentWeek: allWeeks[2], viewingWeekIdx: 2, athlete: { id: 'synthetic-a' },
    computeActiveWeekIdx: () => 0, exerciseLogs: [], pastLogs: [],
    fmtWeekRange: () => '', weekStartDate: (_, n) => allWeeks[n - 1].start_date,
    fetchProgramBlockLogs: async () => [], readinessLog: { readiness_score: 100 },
    progOpenSession: null, sessionRefs: { current: {} }, ...extra }
}
fixture.weeks = props().allWeeks
const logCalls = () => fixture.calls.filter(c => c.table === 'exercise_logs')
const card = tree => nodes(tree, n => n.props['data-program-blokslut'])[0]
async function settled(screen, predicate = tree => card(tree) && !text(card(tree)).includes('Henter')) {
  let tree
  for (let i = 0; i < 100; i++) {
    await flushEffects(); await new Promise(resolve => setTimeout(resolve, 1)); tree = screen.render()
    if (predicate(tree)) { await flushEffects(); return tree }
  }
  assert.fail('Synthetic report did not settle')
}
test('actual copied Program: full block read, first open, subsequent folded; scoped backend query', async () => {
  store.clear(); fixture.rows = snapshot().exerciseLogs; fixture.calls.length = 0
  const p = props(), screen = mount(Program, p)
  screen.render(); const tree = await settled(screen)
  assert.equal(card(tree).props.open, true)
  assert.match(text(card(tree)), /Gennemførte pas: 3 af 3.*Squat: \+11 kg/)
  assert.equal(logCalls().length, 1)
  assert.deepEqual(logCalls()[0].eq, ['athlete_id', 'synthetic-a'])
  assert.match(logCalls()[0].select, /weight,reps_completed,skipped,logged_at/)
  assert.equal(logCalls()[0].in[1].length, 12)
  assert.equal(store.size, 1)
  card(tree).props.onToggle({ currentTarget: { open: false } })
  assert.equal(card(screen.render()).props.open, false)
  const again = mount(Program, p); again.render()
  assert.equal(card(await settled(again)).props.open, false)
  const other = mount(Program, { ...p, athlete: { id: 'synthetic-b' } }); other.render()
  assert.equal(card(await settled(other)).props.open, true)
})
test('actual copied Program: empty, failed read and retry show honest output', async () => {
  fixture.rows = []; const screen = mount(Program, props()); screen.render()
  assert.match(text(card(await settled(screen))), /Ingen bekræftede/)
  fixture.failure = true
  const failed = mount(Program, props()); failed.render()
  const tree = await settled(failed)
  assert.match(text(card(tree)), /kunne ikke hentes/); assert.doesNotMatch(text(card(tree)), /raw synthetic|Gennemførte/)
  fixture.failure = false; fixture.rows = snapshot().exerciseLogs
  nodes(card(tree), n => n.type === 'button')[0].props.onClick()
  failed.render(); assert.match(text(card(await settled(failed))), /Gennemførte pas: 3 af 3/)
})
test('actual copied Program: OFF and middle of block read no report data; following week uses completed block', async () => {
  for (const gate of [false, null, 0, 1, 'true']) {
    const before = logCalls().length, screen = mount(Program, props({ entropi2: gate, programBlokOversigt: false }))
    assert.equal(card(screen.render()), undefined); await flushEffects()
    assert.equal(logCalls().length, before)
  }
  instant = '2026-10-28T12:00:00Z'
  let screen = mount(Program, props()); screen.render()
  await flushEffects(); await new Promise(resolve => setTimeout(resolve, 20)); assert.equal(card(screen.render()), undefined)
  const before = logCalls().length
  instant = '2026-11-10T12:00:00Z'
  const p = props(); p.allWeeks.push({ id: 'next', start_date: '2026-11-09', block_name: 'Basis', week_number: 4, sessions: [] })
  p.currentWeek = p.allWeeks[3]; p.viewingWeekIdx = 0
  screen = mount(Program, p); screen.render()
  assert.match(text(card(await settled(screen))), /19.10.2026.*08.11.2026.*Gennemførte pas: 3 af 3/)
  assert.equal(logCalls().length, before + 1)
  instant = '2026-11-16T12:00:00Z'
  // Long new block: the old report expires even when browsing old weeks.
  p.allWeeks.push({ ...p.allWeeks[3], id: 'next2', start_date: '2026-11-16', week_number: 5 },
    { ...p.allWeeks[3], id: 'next3', start_date: '2026-11-23', week_number: 6 })
  screen = mount(Program, p); assert.equal(card(screen.render()), undefined)
  await flushEffects(); await new Promise(resolve => setTimeout(resolve, 20)); assert.equal(card(screen.render()), undefined)
  assert.equal(logCalls().length, before + 1)
  instant = '2026-11-04T12:00:00Z'
})

test('actual copied Program: a late previous athlete cannot render or mark the report as seen', async () => {
  store.clear(); fixture.rows = snapshot().exerciseLogs
  let release
  fixture.wait = new Promise(resolve => { release = resolve })
  const p = props(), screen = mount(Program, p)
  screen.render(); await settled(screen, tree => card(tree)?.props.open === true)
  const next = { ...p, athlete: { id: 'synthetic-new' } }
  assert.equal(card(screen.render(next)), undefined)
  await flushEffects(); fixture.wait = null; release()
  const tree = await settled(screen)
  assert.match(text(card(tree)), /Gennemførte pas: 3 af 3/)
  assert.ok([...store.keys()].every(key => key.includes('synthetic-new')))
  assert.equal([...store.keys()].some(key => key.includes('synthetic-a')), false)
})

test('actual copied Program: incomplete offline week is never shown as a block; boundary errors stay honest', async () => {
  const all = props(), p = { ...all, allWeeks: [all.allWeeks[1]], currentWeek: all.allWeeks[1], viewingWeekIdx: 0 }
  instant = '2026-10-28T12:00:00Z'
  const before = logCalls().length, screen = mount(Program, p)
  screen.render(); await flushEffects(); await new Promise(resolve => setTimeout(resolve, 20))
  assert.equal(card(screen.render()), undefined); assert.equal(logCalls().length, before)
  const planQuery = fixture.calls.filter(c => c.table === 'weeks').at(-1)
  assert.deepEqual(planQuery.eq, ['athlete_id', 'synthetic-a'])
  instant = '2026-11-04T12:00:00Z'; fixture.planFailure = true
  const failed = mount(Program, props()); failed.render()
  const tree = await settled(failed, tree => nodes(tree, n => n.props.role === 'alert').length > 0)
  assert.equal(card(tree), undefined); assert.match(text(tree), /Blokrapporten kunne ikke hentes/)
  fixture.planFailure = false
})
