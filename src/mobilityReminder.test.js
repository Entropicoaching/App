import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { install, mount, memory, text, nodes, button, createElement as h } from './mob7Synthetic.mjs'
install()
const { MobilityHomeworkProgress, homeworkWaiting, toggleDone, readDone } = await import('./mobilityAdherence.mjs')
const { MobilityHomeworkHome, saveHomework, homeworkLibrary } = await import('./mobilityHomework.mjs')
const label = 'Dine hjemmeøvelser fra i går venter'
const exercises = homeworkLibrary()[0].exercises
const choice = { problemId: 'squat-hip', exerciseIds: exercises.slice(0, 2).map(ex => ex.id) }
const clock = () => new Date(2026, 9, 29, 12)
function fixture({ storage = memory(), athleteId = 'a', enabled = true, homework = true, at = clock } = {}) {
  const children = h(MobilityHomeworkHome, { enabled: homework, athleteId, storage })
  return { storage, children, view: mount(MobilityHomeworkProgress, { enabled, athleteId, children, clock: at }) }
}
const waiting = tree => nodes(tree, n => n.type === 'button' && text(n) === label)

test('unmarked assignment renders exact calm line and actual click focuses the exercise list', () => {
  const f = fixture(); saveHomework('a', choice, f.storage)
  const before = [...f.storage.data]
  const tree = f.view.render(), reminder = button(tree, label)
  assert.equal(waiting(tree).length, 1)
  assert.equal(reminder.props.type, 'button')
  assert.ok(reminder.props.style.minHeight >= 44)
  assert.equal(reminder.props.style.whiteSpace, 'normal')
  assert.equal(nodes(tree, n => n.type === 'ol')[0].props.tabIndex, -1)
  const calls = [], target = { focus: opts => calls.push(['focus', opts]), scrollIntoView: opts => calls.push(['scroll', opts]) }
  reminder.props.onClick({ currentTarget: { closest: selector => { assert.equal(selector, 'section'); return { querySelector: selector => { assert.equal(selector, 'ol'); return target } } } } })
  assert.deepEqual(calls, [['focus', { preventScroll: true }], ['scroll', { block: 'nearest' }]])
  assert.deepEqual([...f.storage.data], before)
  f.view.unmount()
})

test('all assigned exercises marked yesterday hides reminder; partial completion keeps it', () => {
  const f = fixture(); saveHomework('a', choice, f.storage)
  toggleDone('a', exercises[0], '2026-10-28', f.storage)
  assert.equal(waiting(f.view.render()).length, 1)
  toggleDone('a', exercises[1], '2026-10-28', f.storage)
  assert.equal(waiting(f.view.render()).length, 0)
  assert.equal(nodes(f.view.render(), n => n.type === 'li').length, 2)
  f.view.unmount()
})

test('today, older, foreign exercise and foreign athlete marks cannot satisfy yesterday', () => {
  const f = fixture(); saveHomework('a', choice, f.storage)
  for (const ex of exercises.slice(0, 2)) {
    toggleDone('a', ex, '2026-10-29', f.storage)
    toggleDone('a', ex, '2026-10-27', f.storage)
    toggleDone('b', ex, '2026-10-28', f.storage)
  }
  toggleDone('a', exercises[2], '2026-10-28', f.storage)
  assert.equal(waiting(f.view.render()).length, 1)
  f.view.unmount()
})

test('no assignment and removed assignment suppress reminder after actual reload', () => {
  const f = fixture()
  assert.equal(waiting(f.view.render()).length, 0)
  saveHomework('a', choice, f.storage)
  button(f.view.render(), 'Genindlæs hjemmeøvelser').props.onClick()
  assert.equal(waiting(f.view.render()).length, 1)
  saveHomework('a', null, f.storage)
  button(f.view.render(), 'Genindlæs hjemmeøvelser').props.onClick()
  assert.equal(waiting(f.view.render()).length, 0)
  f.view.unmount()
})

test('strict OFF preserves original element, DOM and storage access; homework OFF remains empty', () => {
  const storage = memory(); saveHomework('a', choice, storage)
  const children = h(MobilityHomeworkHome, { enabled: true, athleteId: 'a', storage })
  const serial = tree => JSON.stringify(tree, (_, v) => typeof v === 'function' ? '[handler]' : v)
  const baseline = serial(mount(MobilityHomeworkHome, children.props).render())
  for (const enabled of [undefined, false, 0, 1, 'true']) {
    assert.equal(MobilityHomeworkProgress({ enabled, athleteId: 'a', children, clock() { assert.fail('OFF clock') } }), children)
    const f = { view: mount(MobilityHomeworkProgress, { storage, enabled, athleteId: 'a', children }) }
    assert.equal(serial(f.view.render()), baseline); f.view.unmount()
  }
  const denied = { getItem() { assert.fail('disabled storage read') }, setItem() { assert.fail('disabled storage write') } }
  const f = fixture({ storage: denied, homework: false })
  assert.equal(f.view.render(), null); f.view.unmount()
  for (const children of [null, false, undefined]) assert.equal(MobilityHomeworkProgress({ enabled: true, children }), children)
})

test('corrupt done or homework storage fails closed without writes', () => {
  for (const kind of ['done', 'homework']) {
    const f = fixture(); saveHomework('a', choice, f.storage)
    toggleDone('a', exercises[0], '2026-10-28', f.storage)
    const key = [...f.storage.data.keys()].find(k => k.includes(kind === 'done' ? 'mobility-done' : 'mobility-homework'))
    f.storage.data.set(key, '{')
    const before = [...f.storage.data]
    assert.equal(waiting(f.view.render()).length, 0)
    assert.deepEqual([...f.storage.data], before); f.view.unmount()
  }
})

test('actual midnight hook changes yesterday and removes timer/listeners on unmount', () => {
  const previous = globalThis.window, timers = new Set(), listeners = new Set()
  globalThis.window = { setInterval(fn) { timers.add(fn); return fn }, clearInterval: fn => timers.delete(fn), addEventListener: (_, fn) => listeners.add(fn), removeEventListener: (_, fn) => listeners.delete(fn) }
  let now = new Date(2026, 9, 28, 23, 59)
  const f = fixture({ at: () => now }); saveHomework('a', choice, f.storage)
  for (const ex of exercises.slice(0, 2)) toggleDone('a', ex, '2026-10-27', f.storage)
  try {
    assert.equal(waiting(f.view.render()).length, 0)
    now = new Date(2026, 9, 29, 0, 1)
    for (const refresh of [...timers]) refresh()
    assert.equal(waiting(f.view.render()).length, 1)
    assert.ok(timers.size > 0)
  } finally {
    f.view.unmount(); assert.equal(timers.size + listeners.size, 0)
    if (previous === undefined) delete globalThis.window; else globalThis.window = previous
  }
})

test('calendar boundaries include leap day, year change and both DST transitions', () => {
  for (const [today, yesterday] of [['2028-03-01','2028-02-29'], ['2027-01-01','2026-12-31'], ['2026-03-30','2026-03-29'], ['2026-10-26','2026-10-25']]) {
    assert.equal(homeworkWaiting(choice, [], today), true)
    assert.equal(homeworkWaiting(choice, choice.exerciseIds.map(id => ({ id, date: yesterday })), today), false)
  }
  assert.equal(homeworkWaiting(choice, [], '2026-02-30'), false)
})

test('MOB7 actual done handler still marks today and profile source/wiring stays pinned', () => {
  const f = fixture(); saveHomework('a', choice, f.storage)
  const previous = globalThis.localStorage; globalThis.localStorage = f.storage
  try {
    button(f.view.render(), 'Lavet i dag: ' + exercises[0].name).props.onClick()
    assert.equal(readDone('a', f.storage).rows[0].id, exercises[0].id)
    assert.equal(button(f.view.render(), 'Lavet i dag: ' + exercises[0].name).props['aria-pressed'], true)
    assert.equal(waiting(f.view.render()).length, 1)
  } finally {
    f.view.unmount()
    if (previous === undefined) delete globalThis.localStorage; else globalThis.localStorage = previous
  }
  const athlete = readFileSync(new URL('./AthleteView.jsx', import.meta.url), 'utf8')
  assert.match(athlete, /<MobilityHomeworkProgress enabled=\{mobilitetOpfoelgning === true && !coachAthleteId\}/)
})
