import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { createHost, descendants, textContent } from '../onboarding/firstVisitTestHost.mjs'
import { homeStyles } from './homeStyles.mjs'
import { s as hostStyles } from '../../athleteShared.js'

// Actual copied Home, children and styles; synthetic hooks, no browser/layout claim.
const host = new URL('../onboarding/firstVisitTestHost.mjs', import.meta.url).href
const hooks = 'data:text/javascript,' + encodeURIComponent(`
  export * from ${JSON.stringify(host)};
  import { useRef, useState } from ${JSON.stringify(host)};
  export function useMemo(fn, deps) {
    const ref = useRef();
    if (!ref.current || deps.some((value, i) => !Object.is(value, ref.current.deps[i])))
      ref.current = { deps, value: fn() };
    return ref.current.value;
  }
  let id = 0;
  export const useId = () => useState(() => 'home-details-' + id++)[0];`)
const loader = registerHooks({ resolve(specifier, context, next) {
  if (specifier.endsWith('/supabase.js')) throw Error('Real service forbidden in synthetic details fixture')
  return specifier === 'react'
    ? { shortCircuit: true, url: hooks }
    : next(specifier, context)
} })
test.after(() => loader.deregister())
const { default: Home } = await import('./AthleteHome.mjs')
const athlete = { id: 'synthetic-details', name: 'Testfornavn Testefternavn' }
const now = new Date('2026-11-04T12:00:00Z')
const text = textContent
const props = exercises => {
  const week = { id: 'synthetic-week', athlete_id: athlete.id, start_date: '2026-11-02', week_number: 1,
    sessions: [{ id: 'synthetic-session', title: 'Lang syntetisk pastitel '.repeat(10), weekday: 2, exercises }] }
  return { enabled: true, athlete, now, allWeeks: [week], currentWeek: week, exerciseLogs: [], storage: null,
    logWeight() { assert.fail('details must not log weight') }, setWeightInput() {} }
}
const show = (t, input) => {
  const view = createHost(Home, input)
  view.nodes = predicate => descendants(view.tree).filter(predicate)
  view.text = () => text(view.tree)
  t.after(() => view.unmount())
  return view
}
const order = view => {
  const nodes = view.nodes(() => true)
  const marked = attribute => nodes.find(n => n.props[attribute] === '')
  const sections = [marked('data-home-session-details'), marked('data-week-sessions'),
    marked('data-home-record'), marked('data-home-quick-logs'), marked('data-home-checkin')].filter(Boolean)
  assert.ok(marked('data-home-session-details'))
  assert.ok(marked('data-home-quick-logs')); assert.ok(marked('data-home-checkin'))
  for (let i = 1; i < sections.length; i++) assert.ok(nodes.indexOf(sections[i - 1]) < nodes.indexOf(sections[i]))
  assert.equal(marked('data-home-checkin').props.open, undefined)
}
const exercises = count => Array.from({ length: count }, (_, i) => ({ id: `synthetic-exercise-${i}`,
  name: `Syntetisk løft ${i}`, sets: 2, note: `Note ${i}: ` + 'Lang instruktion med linjeskift\n'.repeat(40) }))

test('home details: today/next, one/ten exercises fold once after Start and visible progress', t => {
  for (const count of [1, 10]) for (const day of ['2026-11-03', '2026-11-04']) {
    const input = props(exercises(count)), calls = []
    const view = show(t, { ...input, now: new Date(day + 'T12:00:00Z'), onStartSession: (...args) => calls.push(args) })
    const nodes = view.nodes(() => true)
    const fold = view.nodes(n => n.props['data-home-session-details'] === '')
    assert.equal(fold.length, 1)
    assert.equal(fold[0].type, 'details'); assert.equal(fold[0].props.open, undefined)
    assert.equal(fold[0].props.onToggle, undefined, 'native disclosure has no write handler')
    const summary = fold[0].children[0]
    assert.equal(summary.type, 'summary'); assert.equal(text(summary), 'Se øvelser og coachnoter')
    assert.ok(summary.props.style.minHeight >= 44)
    const start = nodes.find(n => n.type === 'button' && /^Start (dagens|næste) pas$/.test(text(n)))
    const progress = nodes.find(n => text(n) === `0 af ${2 * count} sæt klaret`)
    assert.ok(nodes.indexOf(start) < nodes.indexOf(progress) && nodes.indexOf(progress) < nodes.indexOf(fold[0]))
    assert.equal(start.props.disabled, false)
    assert.equal(fold[0].children.filter(n => n.type === 'ul')[0].children.length, count)
    for (const exercise of input.currentWeek.sessions[0].exercises) {
      const note = nodes.filter(n => n.type === 'p' && text(n) === `Coach · ${exercise.name}: ${exercise.note}`)
      assert.equal(note.length, 1); assert.ok(fold[0].children.includes(note[0]))
    }
    assert.deepEqual(calls, [], 'rendering details must not start or log a session')
    start.props.onClick(); assert.deepEqual(calls, [['synthetic-session', 'synthetic-week']])
    assert.match(view.text(), /Testfornavn/); assert.doesNotMatch(view.text(), /Testefternavn/)
    order(view)
    assert.equal(nodes.filter(n => n.props['data-home-record'] === '').length, 0)
    assert.equal(nodes.find(n => n.props['data-week-sessions'] === '').children[0], 'Ugen: 0 af 1 pas')
    assert.ok(nodes.some(n => n.props['data-home-checkin'] === ''))
  }
})

test('home details: confirmed record stays between weekly progress and quick logs before the closed check-in', async t => {
  const input = props(exercises(1)), reads = [], writes = []
  input.currentWeek.block_name = 'Styrke'
  input.currentWeek.sessions.push({ id: 'synthetic-completed', weekday: 1,
    exercises: [{ id: 'synthetic-record-squat', name: 'Squat', sets: 1 }] })
  const storage = { getItem() { return null }, setItem(...args) { writes.push(args) }, removeItem(...args) { writes.push(args) } }
  const view = show(t, { ...input, storage, onLogSet() { assert.fail('render must not log') }, setLogInputs() {},
    exerciseLogs: [{ athlete_id: athlete.id, exercise_id: 'synthetic-record-squat', set_number: 1,
      weight: 140, reps_completed: 3, skipped: false, logged_at: '2026-11-03T10:00:00Z' }],
    readHomeRecordHistory: async scope => {
      reads.push(scope)
      return { status: 'ready', complete: true, athleteId: athlete.id, rows: [{ athlete_id: athlete.id,
        exercise_id: 'synthetic-prior', set_number: 1, weight: 130, reps_completed: 3, skipped: false,
        logged_at: '2026-10-01T10:00:00Z', exercises: { name: 'Squat', sessions: { weeks: { block_name: 'Styrke' } } } }] }
    } })
  assert.equal(view.nodes(n => n.props['data-home-record'] === '').length, 0)
  for (let i = 0; i < 15; i++) await Promise.resolve()
  view.render()
  assert.deepEqual(reads, [{ athleteId: athlete.id }])
  assert.equal(view.nodes(n => n.props['data-home-record'] === '').length, 1)
  assert.match(view.text(), /Ny rekord: Squat 140 kg × 3/)
  assert.match(view.text(), /0 af 2 sæt klaret/)
  order(view)
  assert.deepEqual(writes, [], 'rendering closed details and check-in must not write storage')
})

test('home details: notes without names survive; empty lists, missing data and OFF add no empty disclosure', t => {
  const unnamed = { id: 'synthetic-unnamed', name: '', sets: 1, note: 'Hele den syntetiske instruktion' }
  const view = show(t, props([unnamed]))
  assert.match(view.text(), /Coach · Øvelse: Hele den syntetiske instruktion/)
  const fold = view.nodes(n => n.props['data-home-session-details'] === '')[0]
  assert.equal(descendants(fold).filter(n => n.type === 'ul').length, 0)
  for (const input of [props([{ ...unnamed, note: '' }]), { ...props(exercises(1)), programError: true },
    { ...props(exercises(1)), allWeeks: [], currentWeek: undefined }])
    assert.equal(show(t, input).nodes(n => n.props['data-home-session-details'] === '').length, 0)
  const forbidden = () => assert.fail('OFF inspected data')
  const off = show(t, { enabled: false, get athlete() { return forbidden() }, get allWeeks() { return forbidden() } })
  assert.equal(off.tree, null)
  const preview = show(t, { ...props(exercises(1)), sessionReadOnly: true })
  assert.ok(preview.nodes(n => n.props['data-home-session-details'] === '').length)
  assert.equal(preview.nodes(n => n.type === 'button' && /^Start /.test(text(n))).length, 0)
  assert.equal(preview.nodes(n => n.props['data-home-quick-logs'] === '').length, 0)
  const disconnected = show(t, { ...props(exercises(1)), logWeight: undefined, setWeightInput: undefined })
  assert.equal(disconnected.nodes(n => n.props['data-home-quick-logs'] === '').length, 0)
  assert.equal(disconnected.nodes(n => n.props['data-home-session-details'] === '').length, 1)
  assert.equal(disconnected.nodes(n => n.props['data-home-checkin'] === '').length, 1)
})

test('home width: host owns horizontal gutter; home retains vertical spacing, card air, max width and wrapping', () => {
  assert.equal(hostStyles.page.padding, '1.5rem 1rem 6rem')
  assert.equal(homeStyles.page.padding, '20px 0')
  assert.equal(homeStyles.page.maxWidth, 480)
  assert.equal(homeStyles.page.boxSizing, 'border-box')
  assert.equal(homeStyles.page.overflowWrap, 'anywhere')
  assert.equal(homeStyles.card.padding, 20)
  // Declaration arithmetic only: 40 px more text width at 320/390 px and 200% root text.
  for (const viewport of [320, 390]) for (const rootFont of [16, 32]) {
    const hostWidth = viewport - 2 * rootFont
    const contentWidth = Math.min(hostWidth, homeStyles.page.maxWidth) - 2 * 20 - 2
    assert.ok(contentWidth > 0)
    assert.equal(contentWidth - (hostWidth - 2 * 20 - 2 * 20 - 2), 40)
  }
})
