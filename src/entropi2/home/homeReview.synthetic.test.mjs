import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { createHost, descendants, textContent } from '../onboarding/firstVisitTestHost.mjs'
import { memoryStorage } from '../checkin/syntheticReact.mjs'
import { draftKey, loadDraft } from '../checkin/weeklyDraft.mjs'
import { firstVisitKey } from '../onboarding/firstVisitState.mjs'

// Supplementary recursive hook fixture; this is not React or a browser renderer.
// Every presentation component below is imported from the actual copied module.
const host = new URL('../onboarding/firstVisitTestHost.mjs', import.meta.url).href
const hooks = 'data:text/javascript,' + encodeURIComponent(`
  export * from ${JSON.stringify(host)}; export const useMemo = fn => fn();
  import { useState } from ${JSON.stringify(host)};
  let nextId = 0;
  export const useId = () => useState(() => 'home-review-' + nextId++)[0];`)
const parents = new Set(['./AthleteHome.mjs', './HomeCheckIn.mjs', './QuickLogs.mjs',
  './ugeplan/WeekPlan.mjs', '../tracking/ugeatlet/AthleteWeek.mjs', '../onboarding/AthleteIntroduction.mjs', '../checkin/WeeklyCheckIn.mjs']
  .map(path => new URL(path, import.meta.url).href))
const loader = registerHooks({ resolve(specifier, context, next) {
  return specifier === 'react' && parents.has(context.parentURL)
    ? { shortCircuit: true, url: hooks } : next(specifier, context)
} })
test.after(() => loader.deregister())
const { default: Home } = await import('./AthleteHome.mjs')
const athlete = { id: 'synthetic-home-review', name: 'Testfornavn Testefternavn' }
const now = new Date('2026-11-04T12:00:00Z')
const week = { id: 'synthetic-week', athlete_id: athlete.id, start_date: '2026-11-02', week_number: 1,
  sessions: [{ id: 'synthetic-session', weekday: 2, title: 'Syntetisk pas',
    exercises: [{ id: 'synthetic-exercise', name: 'Syntetisk løft', sets: 1 }] }] }
const props = extra => ({ enabled: true, athlete, now, currentWeek: week, allWeeks: [week],
  exerciseLogs: [], storage: memoryStorage(), onStartSession() {}, ...extra })
const nodes = view => descendants(view.tree)
const find = (view, predicate) => nodes(view).find(predicate)
const show = (t, extra) => {
  const view = createHost(Home, props(extra))
  t.after(() => view.unmount())
  return view
}

test('R2: real Home children keep one reminder, editable draft and namespace-only writes', t => {
  const view = show(t), storage = view.props.storage
  const checkin = () => find(view, node => Object.hasOwn(node.props, 'data-home-checkin'))
  const reminders = () => nodes(view).filter(node => Object.hasOwn(node.props, 'data-home-reminder') &&
    node.props['data-home-reminder'] !== undefined)
  assert.equal(reminders().length, 1)
  assert.equal(nodes(view).filter(node => Object.hasOwn(node.props, 'data-home-checkin')).length, 1)
  assert.ok(nodes(view).indexOf(find(view, n => Object.hasOwn(n.props, 'data-film-set'))) < nodes(view).indexOf(checkin()))
  assert.equal(checkin().props.open, undefined)
  checkin().props.onToggle({ currentTarget: { open: true } }); view.render()
  assert.equal(reminders().length, 0)
  assert.equal(textContent(checkin().children[0]), 'Ugentligt check-in')
  find(view, node => node.props.name === 'comment').props.onChange({ target: { value: 'Syntetisk ugekommentar' } })
  view.render()
  checkin().props.onToggle({ currentTarget: { open: false } }); view.render()
  assert.equal(reminders().length, 0)
  assert.equal(loadDraft(draftKey(athlete.id, '2026-11-02'), storage).draft.comment, 'Syntetisk ugekommentar')
  assert.match(textContent(view.tree), /Intet er sendt til din coach/)
  find(view, n => n.type === 'button' && textContent(n) === 'Spring over').props.onClick(); view.render()
  assert.deepEqual(storage.calls.filter(([op]) => op !== 'get').map(([, key]) => key).sort(),
    [draftKey(athlete.id, '2026-11-02'), firstVisitKey(athlete.id)].sort())
  assert.equal(storage.data.get('unrelated-key'), 'preserved')
})

test('R2: full Home keeps first name in empty, failed, holiday and completed states', t => {
  for (const [extra, greeting] of [
    [{ allWeeks: [], currentWeek: undefined }, 'Dit overblik, Testfornavn'],
    [{ programError: true }, 'Dit overblik, Testfornavn'],
    [{ onHoliday: true }, 'Dit overblik, Testfornavn'],
    [{ exerciseLogs: [{ exercise_id: 'synthetic-exercise', set_number: 1,
      logged_at: '2026-11-04T10:00:00Z', weight: 50, reps_completed: 3 }] }, 'Godt arbejde i dag, Testfornavn'],
  ]) {
    const view = show(t, extra), title = find(view, n => n.type === 'h1')
    assert.equal(textContent(title), greeting)
    assert.doesNotMatch(textContent(view.tree), /Testefternavn/)
  }
})

test('R3: unknown storage keeps check-in without inventing a reminder', t => {
  const view = show(t, { storage: null })
  assert.equal(nodes(view).filter(n => Object.hasOwn(n.props, 'data-home-checkin')).length, 1)
  assert.equal(nodes(view).filter(n => Object.hasOwn(n.props, 'data-home-reminder') &&
    n.props['data-home-reminder'] !== undefined).length, 0)
})

test('R2: absent coach text is quiet; real coach text and contact route remain', t => {
  const routes = [], empty = show(t, { messages: [{ sender_role: 'coach', content: '  ' }], setTab: tab => routes.push(tab) })
  assert.equal(find(empty, n => n.props['aria-label'] === 'Fra din coach'), undefined)
  find(empty, n => n.type === 'button' && textContent(n) === 'Din coach').props.onClick()
  assert.deepEqual(routes, ['beskeder'])
  const withCoach = show(t, { messages: [{ sender_role: 'coach', content: 'Syntetisk coachbesked' }] })
  assert.match(textContent(find(withCoach, n => n.props['aria-label'] === 'Fra din coach')), /Syntetisk coachbesked/)
})

test('R2: explicit OFF keeps full Home inert, including athlete and storage getters', () => {
  const denied = () => assert.fail('OFF accessed external props')
  const view = createHost(Home, { enabled: false, get athlete() { return denied() },
    get storage() { return denied() }, get getNow() { return denied() } })
  assert.equal(view.tree, null)
  view.unmount()
})
