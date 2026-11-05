// Actual AthleteView import with the existing closed host adapter. Persist only
// ref/memo hook slots between synthetic renders to exercise callback lifetime.
// Genuine React SSR is covered separately; this is not a React implementation.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const fixtureURL = new URL('./coachOwnTrainingFixture.mjs', import.meta.url)
let source = readFileSync(fixtureURL, 'utf8')
function replaceOnce(old, next) {
  assert.equal(source.split(old).length, 2, `Exact fixture adaptation: ${old}`)
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
const fixture = await import('data:text/javascript,' + encodeURIComponent(source))
const { default: AthleteView, dispose } = await fixture.loadViews()
test.after(dispose)

test('nutrition retry identity survives unrelated renders and calls the current reader with the current athlete', async () => {
  const { ownAthlete, otherAthlete, session, seed, render, named } = fixture
  const props = { entropi2: true, session, role: 'coach', coachAthleteId: ownAthlete.id, onExitPreview() {} }
  seed({ athlete: ownAthlete, requestedTab: 'kost' })
  const first = named(render(AthleteView, props), 'Entropi2Kost').props.retryWeight
  const second = named(render(AthleteView, props), 'Entropi2Kost').props.retryWeight
  assert.equal(first, second)
  fixture.fixture.calls = []
  await first()
  assert.deepEqual(fixture.fixture.calls, [{ name: 'fetchWeightLogs', args: [ownAthlete.id] }])
  // Retain hook slots but replace loaded athlete and factory closures.
  seed({ athlete: otherAthlete, requestedTab: 'kost' })
  const preview = named(render(AthleteView, { ...props, coachAthleteId: otherAthlete.id }), 'PreviewKost')
  assert.equal(preview.props.retryWeight, first)
  fixture.fixture.calls = []
  await first()
  assert.deepEqual(fixture.fixture.calls, [{ name: 'fetchWeightLogs', args: [otherAthlete.id] }])
})
