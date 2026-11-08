import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h, act } from 'react'
import { createRoot } from 'react-dom/client'
import { groupSessionExercises, sessionGroupsForDisplay } from './supersetModel.mjs'
import { mountSupersetView } from './supersetView.mjs'
import { mountSession } from '../sessionView.mjs'
import SessionScreen from '../SessionScreen.mjs'
import { sessionReactDocument } from '../sessionQuickSetReactDom.mjs'
import { parsePlannedRest } from '../tempo/tempoParser.mjs'

const warning = 'Øvelsesgruppen er ufuldstændig. Følg planen for hver øvelse, og bed din coach rette gruppen.'
const prose = 'Pause 120 sek mellem sæt.'
const row = (id, note = '', sets = 2) => ({ id, name: `Syntetisk ${id}`, sets, reps: '5', recommended_weight: 80, note })
const pair = (note = 'Supersæt: A; Pause 90 sek') => [row('a', note), row('b', 'Supersæt: A', 1)]
const freeze = value => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }
  return value
}
function propsFor(exercises) {
  const week = freeze({ id: 'synthetic-week', athlete_id: 'synthetic-owner', sessions: [{ id: 'synthetic-session', exercises }] })
  return { enabled: true, athleteId: week.athlete_id, allWeeks: [week], currentWeek: week,
    exerciseLogs: [], logInputs: {}, parsePlannedRpe: () => null,
    setLogInputs() { assert.fail('read-only inspection edited inputs') },
    onLogSet() { assert.fail('read-only inspection saved a set') } }
}
function mounted(t, exercises, logs = []) {
  const doc = sessionReactDocument(), host = doc.createElement('div'), timers = new Set()
  doc.body.append(host)
  const p = propsFor(exercises)
  p.exerciseLogs = logs
  const view = mountSession(host, () => p, { clock: {
    Date: { now: () => Date.parse('2026-11-03T12:00:00Z') },
    setInterval(fn) { timers.add(fn); return fn }, clearInterval(fn) { timers.delete(fn) }
  } })
  t.after(() => { view.dispose(); assert.equal(timers.size, 0); assert.equal(host.children.length, 0) })
  view.controller.start()
  return { host, p, view }
}

test('pinned single-rest lead keeps the raw parser warning without a group warning', () => {
  const exercises = freeze([{ id: 'synthetic-single-only', name: 'Syntetisk enkeltøvelse', sets: 3, exercise_order: 1, note: prose }])
  const raw = groupSessionExercises(exercises), display = sessionGroupsForDisplay(exercises)
  assert.equal(raw.groups[0].kind, 'single')
  assert.deepEqual(raw.warnings, ['Øvelse 1: pause kan ikke læses.'])
  assert.equal(raw.groups[0].restSeconds, null)
  assert.ok(raw.groups[0].steps.every(step => step.restAfterSeconds === null))
  assert.equal(parsePlannedRest('120 sek mellem sæt.').status, 'invalid')
  assert.deepEqual(display.groups, raw.groups)
  assert.equal(display.message, null)
})

test('actual mountSession/controller preserves plan, rest, tempo, current set, logging controls and overview', t => {
  const exercises = freeze([{ ...row('single', prose, 3), tempo: '3-0-X-0', exercise_order: 1 }])
  const { host, view } = mounted(t, exercises)
  const s = view.controller.state()
  assert.equal(s.key, 'single_1'); assert.equal(s.total, 3); assert.equal(s.done, 0)
  assert.equal(host.querySelector('[data-heading]').textContent, 'Syntetisk single')
  assert.equal(Boolean(host.querySelector('[data-e2-supersaet]')), false)
  assert.ok(host.querySelectorAll('p').some(node => node.textContent === 'Sæt 1 af 3'))
  assert.equal(host.querySelector('.plan').textContent, '5 gentagelser · 80 kg')
  assert.match(host.querySelector('[data-e2-tempo]').textContent, /Tempo: 3-0-X-0/)
  assert.match(host.querySelector('[data-e2-tempo]').textContent, /Planlagt pause mellem sæt: 2 min\./)
  assert.match(host.querySelector('[data-session-overview]').textContent, /Pause: 2 min\./)
  assert.equal(host.querySelector('[data-overview-counts]').textContent, '0 registreret · 0 sprunget over · 3 tilbage')
  assert.equal(host.querySelector('[data-field="weight"]').value, '80')
  assert.equal(host.querySelector('[data-field="reps"]').value, '5')
  assert.equal(host.querySelector('.approve').textContent, 'Som planlagt')
  assert.equal(host.querySelector('.approve').disabled, false)
  assert.ok(host.querySelector('[data-step="weight-up"]'))
  assert.ok(host.querySelector('[data-step="reps-up"]'))
  assert.ok(host.querySelector('[data-step="rpe-8"]'))
  assert.doesNotMatch(host.textContent, /Øvelsesgruppen er ufuldstændig/)
  view.update()
  assert.equal(Boolean(host.querySelector('[data-e2-supersaet]')), false)
  assert.equal(view.controller.state().key, 'single_1')
})

test('unrelated single rest warnings do not poison a complete group in either mounted consumer', t => {
  for (const note of [prose, 'Pause nonsense', 'Rest -1 s', 'Hvile 1:99']) {
    const exercises = freeze([row('single', note, 3), ...pair()])
    const raw = groupSessionExercises(exercises), display = sessionGroupsForDisplay(exercises)
    assert.equal(raw.warnings.length, 1)
    assert.deepEqual(display.groups, raw.groups)
    assert.equal(display.message, null)
    const first = mounted(t, exercises)
    assert.equal(Boolean(first.host.querySelector('[data-e2-supersaet]')), false)
    const logs = [1, 2, 3].map(set_number => ({ athlete_id: 'synthetic-owner', exercise_id: 'single', set_number,
      weight: 80, reps_completed: 5, logged_at: new Date().toISOString() }))
    const active = mounted(t, exercises, logs)
    assert.equal(active.view.controller.state().key, 'a_1')
    assert.equal(active.host.querySelector('[data-e2-supersaet]').textContent, 'Supersæt A: Syntetisk a + Syntetisk b')
    assert.doesNotMatch(active.host.textContent, /Øvelsesgruppen er ufuldstændig/)
    assert.match(active.host.querySelector('[data-detail="overview-1"]').textContent, /Supersæt A/)
    const doc = sessionReactDocument(), host = doc.createElement('div')
    const standalone = mountSupersetView(host, { enabled: true, exercises })
    try {
      assert.deepEqual(host.querySelectorAll('h4').map(node => node.textContent), ['Enkeltøvelse', 'Supersæt A'])
      assert.doesNotMatch(host.textContent, /Øvelsesgruppen er ufuldstændig/)
      assert.equal(host.querySelectorAll('li').length, 6)
    } finally { standalone.dispose() }
  }
})

test('declared group rest errors remain visible in the actual normal session', t => {
  for (const kind of ['Supersæt', 'Cirkel']) {
    const exercises = freeze([row('a', `${kind}: A; ${prose}`), row('b', `${kind}: A`, 1)])
    assert.equal(sessionGroupsForDisplay(exercises).message, warning)
    const { host } = mounted(t, exercises)
    const region = host.querySelector('[data-e2-supersaet]')
    assert.match(region.textContent, new RegExp(`${kind} A: Syntetisk a \\+ Syntetisk b`))
    assert.ok(region.textContent.includes(warning))
  }
})

test('actual normal session keeps malformed and duplicate group declarations visible as warnings', t => {
  for (const note of ['Supersæt:', 'Cirkel: A!', 'Supersæt: A; Supersæt: A', 'Supersæt: A; Cirkel: A']) {
    const exercises = freeze([row('a', `${note}; ${prose}`), row('b', note)])
    const { host } = mounted(t, exercises)
    assert.equal(sessionGroupsForDisplay(exercises).message, warning)
    assert.equal(host.querySelector('[data-e2-supersaet]').textContent, warning)
    assert.ok(groupSessionExercises(exercises).groups.every(group => group.kind === 'single'))
  }
})

test('malformed, orphan, duplicate, conflicting and incomplete rows retain honest warnings without invented groups', () => {
  const cases = [
    [null, []], [[null], []], [[row('a'), null, row('b')], []],
    [[row('a', 'Supersæt:')], ['Enkeltøvelse']],
    [[row('a', 'Cirkel: A!')], ['Enkeltøvelse']],
    [[row('a', 'Supersæt: A; Supersæt: A')], ['Enkeltøvelse']],
    [[row('a', 'Supersæt: A; Cirkel: A')], ['Enkeltøvelse']],
    [[row('a', 'Supersæt: A')], ['Enkeltøvelse']],
    [[row('a', 'Cirkel: A'), row('b'), row('c', 'Cirkel: A')], ['Enkeltøvelse', 'Enkeltøvelse', 'Enkeltøvelse']],
    [[row('a', prose, 'bad')], []], [[{ ...row('a', prose), sets: undefined }], []],
    [[{ ...row('a', prose), sets: null }], []], [[row('a', prose, 0)], []],
    [[row('a', prose, -1)], []], [[row('a', prose, true)], []],
    [[{ ...row('a', prose), name: '' }], []], [[{ ...row('a', prose), name: undefined }], []],
    [[{ ...row('a', prose), name: '   ' }], []],
    [[row('a', 'Supersæt: A', 'bad'), row('b', 'Supersæt: A')], []],
    [[{ ...row('a', 'Supersæt: A'), name: '' }, row('b', 'Supersæt: A')], []],
  ]
  for (const [input, labels] of cases) {
    freeze(input)
    assert.equal(sessionGroupsForDisplay(input).message, warning, JSON.stringify(input))
    const doc = sessionReactDocument(), host = doc.createElement('div')
    const view = mountSupersetView(host, { enabled: true, exercises: input })
    try {
      assert.ok(host.textContent.includes(warning))
      assert.deepEqual(host.querySelectorAll('h4').map(node => node.textContent), labels)
      assert.doesNotMatch(host.textContent, /Skift øvelse uden planlagt pause/)
    } finally { view.dispose() }
  }
})

test('compact view clears stale warnings, preserves circuit membership and remains inert OFF', () => {
  const doc = sessionReactDocument(), host = doc.createElement('div')
  const view = mountSupersetView(host, { enabled: true, compact: true, exercises: pair('Supersæt: A; Pause bad'), currentExerciseId: 'a' })
  try {
    assert.ok(host.textContent.includes(warning))
    view.update({ enabled: true, compact: true, exercises: freeze([row('single', prose)]), currentExerciseId: 'single' })
    assert.equal(Boolean(host.querySelector('[data-e2-supersaet]')), false)
    const circuit = freeze([row('a', 'Cirkel: B; Pause 0 sek'), row('b', 'Cirkel: B')])
    assert.equal(sessionGroupsForDisplay(circuit).message, null)
    view.update({ enabled: true, compact: true, exercises: circuit, currentExerciseId: 'b' })
    assert.equal(host.textContent, 'Cirkel B: Syntetisk a + Syntetisk b')
    view.update({ enabled: false, exercises: circuit })
    assert.equal(host.children.length, 0)
  } finally { view.dispose() }
  const off = mountSupersetView(null, { enabled: false }); off.dispose()
})

test('real React SessionScreen mounts the ordinary plan without a spurious group region and cleans up', async () => {
  const doc = sessionReactDocument(), host = doc.createElement('div'), timers = new Set()
  doc.body.append(host)
  const replacements = { window: doc.defaultView, IS_REACT_ACT_ENVIRONMENT: true,
    setInterval(fn) { timers.add(fn); return fn }, clearInterval(fn) { timers.delete(fn) } }
  const original = Object.fromEntries(Object.keys(replacements).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  for (const [key, value] of Object.entries(replacements)) Object.defineProperty(globalThis, key, { configurable: true, value })
  const root = createRoot(host), props = propsFor(freeze([row('single', prose, 3)]))
  try {
    await act(async () => root.render(h(SessionScreen, props)))
    await act(async () => host.querySelector('button').click())
    assert.equal(Boolean(host.querySelector('[data-e2-supersaet]')), false)
    assert.doesNotMatch(host.textContent, /Øvelsesgruppen er ufuldstændig/)
    assert.equal(host.querySelector('.plan').textContent, '5 gentagelser · 80 kg')
    assert.equal(host.querySelector('[data-overview-counts]').textContent, '0 registreret · 0 sprunget over · 3 tilbage')
    assert.equal(host.querySelector('.approve').disabled, false)
    await act(async () => root.render(h(SessionScreen, { ...props })))
    assert.equal(Boolean(host.querySelector('[data-e2-supersaet]')), false)
    await act(async () => root.render(h(SessionScreen, { ...props, enabled: false })))
    assert.equal(host.querySelector('dialog'), null)
  } finally {
    await act(async () => root.unmount())
    for (const [key, value] of Object.entries(original)) {
      if (value) Object.defineProperty(globalThis, key, value); else delete globalThis[key]
    }
    assert.equal(timers.size, 0); assert.equal(host.children.length, 0)
  }
})
