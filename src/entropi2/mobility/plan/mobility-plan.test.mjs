import test from 'node:test'
import assert from 'node:assert/strict'
import { mobilityPlan, DEFAULT_MOBILITY_PLAN } from './mobility-plan.mjs'
import { WARMUP_BASE } from '../public-mobilityCatalog.mjs'

const input = (...names) => ({ enabled: true, session: { exercises: names.map(name => ({ name, sets: 3 })) } })

test('strict OFF does not read session or catalog', () => {
  assert.equal(DEFAULT_MOBILITY_PLAN, false)
  for (const enabled of [undefined, false, null, 1, 'true']) {
    assert.equal(mobilityPlan({ enabled, get session() { assert.fail('session read') },
      get catalog() { assert.fail('catalog read') } }), null)
  }
})

test('known lifts and variants use explicit existing catalog doses and descriptions', () => {
  for (const [names, key, ids] of [
    [['Squat', 'Tempo squat', 'Front squat', 'Safety bar squat'], 'Squat', ['sq-mob-2', 'sq-mob-3', 'sq-mov-1']],
    [['BÆNKPRES', 'Close-grip bench press', 'Baenkpres - topsæt', 'Larsen bænkpres'], 'Bænkpres', ['bp-mob-2', 'bp-akt-3', 'bp-akt-1']],
    [['Dødløft', 'Paused deadlift', 'Romanian deadlift', 'RDL'], 'Dødløft — Konventionel', ['dk-mob-3', 'dk-akt-1', 'dk-mov-1']],
    [['Sumo deadlift', 'Dødløft — Sumo', 'Sumodødløft'], 'Dødløft — Sumo', ['ds-mob-2', 'ds-mob-1', 'ds-mov-1']],
  ]) for (const name of names) {
    const plan = mobilityPlan(input(name))
    assert.equal(plan.kind, 'ready', name)
    assert.deepEqual(plan.steps.map(step => step.id), ids, name)
    assert.equal(plan.rounds, 2)
    assert.equal(plan.totalSeconds, 420)
    for (const step of plan.steps) {
      const original = WARMUP_BASE[key].flatMap(slot => slot.options).find(ex => ex.id === step.id)
      for (const field of ['name', 'desc', 'label', 'type']) assert.equal(step[field], original[field])
      if (step.type === 'timer') assert.equal(step.duration, original.duration)
    }
  }
})

test('combined lifts follow program order, deduplicate families and stay within 5–10 minutes', () => {
  const plan = mobilityPlan(input('Sumo deadlift', 'Bench press', 'Front squat', 'Squat', 'Deadlift'))
  assert.deepEqual(plan.lifts, ['Sumodødløft', 'Bænkpres', 'Squat'])
  assert.equal(plan.steps.length, 9)
  assert.equal(plan.rounds, 1)
  assert.equal(plan.totalSeconds, 600)
  assert.equal(new Set(plan.steps.map(ex => ex.id)).size, 9)
  for (const names of [['Squat'], ['Bench press', 'Deadlift'], ['Squat', 'Bench press', 'Deadlift']]) {
    const p = mobilityPlan(input(...names))
    assert.ok(p.totalSeconds >= 300 && p.totalSeconds <= 600)
    assert.equal(p.totalSeconds, p.steps.reduce((sum, step) => sum + step.estimatedSeconds, 0) * p.rounds + p.transitionSeconds)
  }
})

test('missing, empty, unknown and zero-set programs are honestly empty', () => {
  for (const value of [{ enabled: true }, { enabled: true, session: null }, input(),
    input('Row', 'Row on bench', 'Bench-supported row', 'Leg extension', 'Squatty'),
    { enabled: true, session: { exercises: [{ name: 'Squat', sets: 0 }] } }]) {
    const plan = mobilityPlan(value)
    assert.equal(plan.kind, 'empty')
    assert.deepEqual(plan.steps, [])
    assert.equal(plan.totalSeconds, 0)
  }
})

test('malformed programs and incomplete catalogs give errors, never partial routines', () => {
  for (const session of [false, 'Squat', {}, { exercises: null }, { exercises: [null] },
    { exercises: [{}] }, { exercises: [{ name: ' ' }] },
    ...[null, true, '', 'bad', -1, Infinity, {}, []].map(sets => ({ exercises: [{ name: 'Squat', sets }] }))]) {
    assert.equal(mobilityPlan({ enabled: true, session }).kind, 'error')
  }
  for (const catalog of [null, {}, { Squat: [null] }, { Squat: [{ options: [] }] }]) {
    const plan = mobilityPlan({ ...input('Squat', 'Bench press'), catalog })
    assert.equal(plan.kind, 'error')
    assert.deepEqual(plan.steps, [])
  }
  assert.equal(mobilityPlan({ enabled: true, session: { exercises: [{ name: 'Squat', sets: '2' }] } }).kind, 'ready')
  assert.equal(mobilityPlan({ enabled: true, session: { exercises: [{ name: 'Squat' }] } }).kind, 'ready')
})

test('input and catalog are not mutated and returned steps do not alias the catalog', () => {
  const options = input('Squat', 'Bench press')
  options.session.exercises.forEach(Object.freeze)
  Object.freeze(options.session.exercises)
  Object.freeze(options.session)
  Object.freeze(options)
  const before = JSON.stringify(WARMUP_BASE)
  const first = mobilityPlan(options), expected = structuredClone(first)
  first.steps[0].name = 'Synthetic change'
  first.steps.pop()
  first.lifts.reverse()
  assert.deepEqual(mobilityPlan(options), expected)
  assert.equal(JSON.stringify(WARMUP_BASE), before)
})

// Use real React in the app's own npm test. A hermetic public copy may lack
// installed dependencies; expose that limitation as explicit skips, not a stub.
let React, renderToStaticMarkup, MobilityPlan
let missingReact = false
try {
  React = await import('react')
  ;({ renderToStaticMarkup } = await import('react-dom/server'))
} catch (err) {
  if (err.code !== 'ERR_MODULE_NOT_FOUND' || !/package 'react(?:-dom)?'/.test(err.message)) throw err
  missingReact = true
}
if (!missingReact) ({ default: MobilityPlan } = await import('./MobilityPlan.mjs'))
const render = props => renderToStaticMarkup(React.createElement(MobilityPlan, props))
const reactOptions = { skip: missingReact ? 'Real React packages unavailable in pinned public copy; no installation permitted' : false }

test('React: renders routine, total, per-exercise time and collapsed guidance', reactOptions, () => {
  const html = render(input('Squat', 'Bench press'))
  assert.match(html, /Ca\. 7 min/)
  assert.match(html, /Ankel-vægstræk/)
  assert.match(html, /30 sek pr\. side/)
  assert.equal((html.match(/Ca\. 60 sek pr\. runde/g) || []).length, 6)
  assert.equal((html.match(/<details>/g) || []).length, 6)
  assert.doesNotMatch(html, /<details open/)
  assert.match(html, /Fortsæt derefter med dine sædvanlige opvarmningssæt/)
})

test('React: missing and unsupported sessions render an honest empty status', reactOptions, () => {
  for (const props of [{ enabled: true }, input('Row')]) {
    const html = render(props)
    assert.match(html, /role="status"/)
    assert.match(html, /Ingen rutine klar/)
    assert.doesNotMatch(html, /<ol|Ca\. \d+ min/)
  }
})

test('React: malformed program or missing catalog renders an error alert', reactOptions, () => {
  for (const props of [{ enabled: true, session: {} }, { ...input('Squat'), catalog: {} }]) {
    const html = render(props)
    assert.match(html, /role="alert"/)
    assert.match(html, /Rutinen kunne ikke laves/)
    assert.doesNotMatch(html, /<ol/)
  }
})

test('React: strict OFF renders nothing and reads no session', reactOptions, () => {
  for (const enabled of [undefined, false, null, 1, 'true']) {
    assert.equal(MobilityPlan({ enabled, get session() { assert.fail('OFF read') } }), null)
    assert.equal(render({ enabled }), '')
  }
})
