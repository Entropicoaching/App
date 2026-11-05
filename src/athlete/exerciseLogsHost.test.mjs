// Actual AthleteView JSX and lavLaesninger; public synthetic hook/service
// boundaries only. Genuine React rendering remains a separate integration gate.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { supabase } from '../appRev2Fakes.mjs'

const serviceHooks = registerHooks({ resolve(specifier, context, next) {
  if (/(?:^|\/)supabase(?:\.js)?$/.test(specifier))
    return { url: new URL('../appRev2Fakes.mjs', import.meta.url).href, shortCircuit: true }
  if (specifier.startsWith('.') && context.parentURL && !/\.[a-z]+$/i.test(specifier)) {
    const url = new URL(specifier + '.js', context.parentURL)
    if (existsSync(url)) return { url: url.href, shortCircuit: true }
  }
  return next(specifier, context)
} })
const { lavLaesninger } = await import('./laesninger.js')
let source = readFileSync(new URL('./coachOwnTrainingFixture.mjs', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
function replaceOnce(old, next) {
  assert.equal(source.split(old).length, 2, 'Exact public fixture adaptation: ' + old)
  source = source.replace(old, next)
}
replaceOnce("from './prog3Jsx.mjs'", `from ${JSON.stringify(new URL('./prog3Jsx.mjs', import.meta.url).href)}`)
replaceOnce("const root = new URL('../', import.meta.url)", `const root = new URL(${JSON.stringify(new URL('../', import.meta.url).href)})`)
replaceOnce('export function begin() { cursor = 0; effects = [] }',
  'let slot = 0; const slots = []; export function begin() { cursor = 0; slot = 0; effects = [] }')
replaceOnce('export const useRef = initial => real ? real.useRef(initial) : { current: initial }',
  'export const useRef = initial => slots[slot++] ??= { current: initial }')
replaceOnce('export const useMemo = (fn, deps) => real ? real.useMemo(fn, deps) : fn()',
  `export const useMemo = (fn, deps) => {
    const index = slot++, previous = slots[index]
    if (previous && deps.length === previous.deps.length && deps.every((d, i) => Object.is(d, previous.deps[i]))) return previous.value
    const next = { deps, value: fn() }; slots[index] = next; return next.value
  }`)
replaceOnce("export const factory = () => new Proxy({}, { get: (_, name) => name === 'inboxDatabase' ? fixture.database ?? database : spy(name) })",
  `export const factory = options => {
    if (options?.setExerciseLogs) {
      fixture.readerOptions = options
      if (options.exerciseLogsReadRef) return fixture.makeReaders(options)
    }
    return new Proxy({}, { get: (_, name) => name === 'inboxDatabase' ? fixture.database ?? database : spy(name) })
  }`)
const harness = await import('data:text/javascript,' + encodeURIComponent(source))
const { default: AthleteView, dispose } = await harness.loadViews()
test.after(() => { dispose(); serviceHooks.deregister() })

test('actual host sends read error/loading/retry to HomeSession and its current actual reader', async t => {
  const original = supabase.from
  t.after(() => { supabase.from = original })
  const { fixture, ownAthlete, otherAthlete, session, week, seed, render, named } = harness
  const queries = []
  let response = { data: null, error: Error('synthetic failure') }
  supabase.from = table => {
    assert.equal(table, 'exercise_logs')
    const query = new Proxy({}, { get(_, key) {
      if (key === 'then') return (a, b) => Promise.resolve(response).then(a, b)
      assert.ok(['select', 'eq', 'in'].includes(key))
      return (...args) => { queries.push([key, ...args]); return query }
    } })
    return query
  }
  fixture.makeReaders = options => lavLaesninger({ ...options, onReadError: () => () => {} })
  const props = { entropi2: true, session, role: 'athlete', coachAthleteId: ownAthlete.id }
  seed({ athlete: ownAthlete, requestedTab: 'hjem', exerciseLogs: [] })
  const home = () => named(render(AthleteView, props), 'HomeSession').props
  const first = home().onRetryExerciseLogs
  assert.equal(home().exerciseLogsLoading, true)
  assert.equal(await first(), false)
  assert.equal(home().exerciseLogsError, true); assert.equal(home().exerciseLogsLoading, false)
  assert.equal(home().onRetryExerciseLogs, first)
  let resolve
  response = new Promise(done => { resolve = done })
  const pending = first()
  assert.equal(home().exerciseLogsLoading, true); assert.equal(home().exerciseLogsError, false)
  resolve({ data: [], error: null }); assert.equal(await pending, true)
  assert.equal(home().exerciseLogsError, false); assert.equal(home().exerciseLogsLoading, false)
  assert.deepEqual(home().exerciseLogs, [])
  assert.ok(queries.some(([key, col, id]) => key === 'eq' && col === 'athlete_id' && id === ownAthlete.id))
  assert.ok(queries.some(([key, col, ids]) => key === 'in' && col === 'exercise_id' && ids[0] === week.sessions[0].exercises[0].id))
  seed({ athlete: otherAthlete, requestedTab: 'hjem', exerciseLogs: [],
    exerciseLogsStatus: { athleteId: ownAthlete.id, weekId: week.id, error: true, loading: false } })
  props.coachAthleteId = otherAthlete.id
  assert.equal(home().exerciseLogsError, false); assert.equal(home().exerciseLogsLoading, true)
  assert.equal(home().onRetryExerciseLogs, first)
  response = { data: [], error: null }; await first()
  assert.ok(queries.some(([key, col, id]) => key === 'eq' && col === 'athlete_id' && id === otherAthlete.id))
  render(AthleteView, { ...props, entropi2: false })
  assert.equal(fixture.readerOptions.exerciseLogsReadRef, undefined)
  assert.equal(fixture.readerOptions.setExerciseLogsStatus, undefined)
  const count = queries.length; assert.equal(await first(), false); assert.equal(queries.length, count)
})
