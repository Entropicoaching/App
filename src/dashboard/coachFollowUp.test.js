import test from 'node:test'
import assert from 'node:assert/strict'
import { install } from './followUpLoader.mjs'
import { mount, nodes, text } from './followUpDom.mjs'
install()
const { default: ForsideView } = await import('./ForsideView.jsx')
const { default: Baseline } = await import('./followUpBaseline.jsx')
const { coachFollowUpFlag, COACH_FOLLOW_UP_ENABLED, followUpKey, saveFollowUp, loadFollowUps, sortFollowUps } = await import('./coachFollowUp.mjs')
export function storage() {
  const values = new Map(), calls = []
  return { values, calls, getItem(k) { calls.push(['get', k]); return values.get(k) ?? null }, setItem(k, v) { calls.push(['set', k]); values.set(k, v) } }
}
export function props(extra = {}) {
  return {
    athletes: [{ id: 'a', name: 'Anna' }, { id: 'b', name: 'Bo' }, { id: 'c', name: 'Carl' }],
    hiddenAthleteIds: new Set(), athleteSortMode: 'navn', athleteCurrentWeek: {}, calendarWeeks: {},
    athleteWeekCompletion: {}, athleteWeekSummary: {}, athleteLastLogs: {}, coachBriefingSeen: {}, coachPriorityItems: [],
    unreadCounts: {}, videoMeasurementByAthlete: {}, loading: false, loadError: false,
    openProfile() {}, setAthleteSortMode() {}, coachFollowUp: true, coachId: 'coach-a', ...extra,
  }
}
export const find = (tree, label) => {
  const matches = nodes(tree, n => n.props['aria-label'] === label)
  assert.equal(matches.length, 1, label)
  return matches[0].props
}
export function row(tree, id) { return nodes(tree, n => n.props['data-follow-up-controls'] === id)[0] }
export function press(tree, id, label) {
  const match = nodes(row(tree, id), n => n.type === 'button' && text(n) === label)
  assert.equal(match.length, 1, label)
  match[0].props.onClick()
}
export function submit(tree, id) {
  nodes(row(tree, id), n => n.type === 'form')[0].props.onSubmit({ preventDefault() {} })
}
export const order = tree => nodes(tree, n => n.props['data-follow-up-athlete']).map(n => n.props['data-follow-up-athlete'])

test('default OFF requires exact query value and does not read storage or change baseline DOM', () => {
  assert.equal(COACH_FOLLOW_UP_ENABLED, false)
  for (const search of ['', '?coachFollowUp=0', '?coachFollowUp=true', '?coachFollowUp=01']) assert.equal(coachFollowUpFlag(search), false)
  assert.equal(coachFollowUpFlag('?other=1&coachFollowUp=1'), true)
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw Error('Storage forbidden while OFF') } })
  const p = props({ coachFollowUp: false })
  const snapshot = tree => JSON.stringify(tree, (k, v) => typeof v === 'function' ? '[handler]' : v)
  const actual = snapshot(mount(ForsideView, p).render()), expected = snapshot(mount(Baseline, p).render())
  const at = [...actual].findIndex((c, i) => c !== expected[i])
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, writable: true, value: storage() })
  assert.ok(actual === expected, `DOM difference at ${at}: ${actual.slice(at - 80, at + 100)} VS ${expected.slice(at - 80, at + 100)}`)
  const omitted = { ...p }; delete omitted.coachFollowUp
  assert.equal(snapshot(mount(ForsideView, omitted).render()), snapshot(mount(Baseline, omitted).render()))
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, writable: true, value: storage() })
})

test('actual list handlers mark with note, edit, persist across remount, and remove', () => {
  globalThis.localStorage = storage()
  const p = props(), view = mount(ForsideView, p)
  let tree = view.render()
  assert.deepEqual(order(tree), ['a', 'b', 'c'])
  press(tree, 'c', 'Følg op'); tree = view.render()
  find(tree, 'Kort note om Carl').onChange({ target: { value: '  Ring om næste uge  ' } })
  tree = view.render(); submit(tree, 'c'); tree = view.render()
  assert.deepEqual(order(tree), ['c', 'a', 'b'])
  assert.match(text(row(tree, 'c')), /Følg op: Ring om næste uge/)
  press(tree, 'c', 'Ret note'); tree = view.render()
  assert.equal(find(tree, 'Kort note om Carl').value, 'Ring om næste uge')
  find(tree, 'Kort note om Carl').onChange({ target: { value: 'Ny note' } })
  tree = view.render(); submit(tree, 'c')
  const reloaded = mount(ForsideView, p); tree = reloaded.render()
  assert.match(text(row(tree, 'c')), /Ny note/)
  press(tree, 'c', 'Fjern opfølgning'); tree = reloaded.render()
  assert.deepEqual(order(tree), ['a', 'b', 'c'])
  assert.deepEqual(order(mount(ForsideView, p).render()), ['a', 'b', 'c'])
  assert.deepEqual(globalThis.localStorage.calls.filter(c => c[0] === 'set').map(c => c[1]), Array(3).fill(followUpKey('coach-a')))
})

test('stable partition preserves name and actual deviation sorting, without mutating input', () => {
  const athletes = props().athletes, before = [...athletes]
  assert.deepEqual(sortFollowUps(athletes, { b: '', c: 'note' }).map(a => a.id), ['b', 'c', 'a'])
  assert.deepEqual(athletes, before)
  globalThis.localStorage = storage()
  saveFollowUp({ storage: globalThis.localStorage, coachId: 'coach-a', athletes, athleteId: 'b' })
  const p = props({ athleteSortMode: 'afvigelse', calendarWeeks: {
    a: [{ week_number: 1, planned_sets: 10 }], b: [{ week_number: 1, planned_sets: 1 }], c: [{ week_number: 1, planned_sets: 10 }],
  }, athleteWeekCompletion: { a: { 1: { sets: 10 } }, b: { 1: { sets: 1 } }, c: { 1: { sets: 0 } } } })
  assert.deepEqual(order(mount(ForsideView, p).render()), ['b', 'c', 'a'])
})

test('marked athlete below cap moves to top; hidden athletes stay hidden', () => {
  globalThis.localStorage = storage()
  const athletes = Array.from({ length: 30 }, (_, i) => ({ id: String(i), name: `Atlet ${String(i).padStart(2, '0')}` }))
  saveFollowUp({ storage: globalThis.localStorage, coachId: 'coach-a', athletes, athleteId: '29', note: 'Senere' })
  const p = props({ athletes })
  assert.equal(order(mount(ForsideView, p).render())[0], '29')
  assert.equal(order(mount(ForsideView, p).render()).length, 25)
  const hidden = props({ athletes, hiddenAthleteIds: new Set(['29']) })
  assert.ok(!order(mount(ForsideView, hidden).render()).includes('29'))
})

test('coach switch isolates note and draft, while same-coach remount keeps marker', () => {
  globalThis.localStorage = storage()
  const p = props(), view = mount(ForsideView, p)
  let tree = view.render(); press(tree, 'a', 'Følg op'); tree = view.render()
  find(tree, 'Kort note om Anna').onChange({ target: { value: 'Coach A note' } })
  tree = view.render(); submit(tree, 'a')
  tree = view.render(props({ coachId: 'coach-b' }))
  assert.doesNotMatch(text(tree), /Coach A note/)
  assert.equal(nodes(tree, n => n.type === 'form').length, 0)
  assert.match(text(mount(ForsideView, p).render()), /Coach A note/)
  const noScope = mount(ForsideView, props({ coachId: undefined })).render()
  assert.equal(nodes(noScope, n => n.props['data-follow-up-controls']).length, 0)
})

test('storage failure shows error and keeps persisted marker until successful removal', () => {
  const store = storage(); globalThis.localStorage = store
  const p = props()
  saveFollowUp({ storage: store, coachId: p.coachId, athletes: p.athletes, athleteId: 'c', note: 'Behold' })
  const view = mount(ForsideView, p)
  let tree = view.render()
  store.setItem = () => { throw Error('quota') }
  press(tree, 'c', 'Fjern opfølgning'); tree = view.render()
  assert.equal(order(tree)[0], 'c')
  assert.match(text(nodes(tree, n => n.props.role === 'alert')[0]), /Kunne ikke gemme/)
  assert.match(text(row(tree, 'c')), /Behold/)
})

test('malformed storage is visible and not overwritten; scope and note limits enforced', () => {
  const store = storage(), p = props()
  store.values.set(followUpKey(p.coachId), '{broken')
  assert.match(loadFollowUps(store, p.coachId).error, /Kunne ikke læse/)
  assert.ok(saveFollowUp({ storage: store, coachId: p.coachId, athletes: p.athletes, athleteId: 'a' }).error)
  assert.equal(store.values.get(followUpKey(p.coachId)), '{broken')
  assert.ok(saveFollowUp({ storage: store, coachId: '', athletes: p.athletes, athleteId: 'a' }).error)
  assert.ok(saveFollowUp({ storage: store, coachId: 'x', athletes: p.athletes, athleteId: 'outsider' }).error)
  assert.ok(saveFollowUp({ storage: store, coachId: 'x', athletes: p.athletes, athleteId: 'a', note: 'x'.repeat(161) }).error)
  assert.equal(store.calls.filter(c => c[0] === 'set').length, 0)
})
