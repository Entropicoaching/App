import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { install, mount, memory, text, nodes, button, createElement as h } from './mob7Synthetic.mjs'
install()
const { DEFAULT_MOBILITY_ADHERENCE, localDay, readDone, toggleDone, adherenceSummary, watchLocalDay,
  HomeworkExerciseProgress, MobilityAdherenceProfile } = await import('./mobilityAdherence.mjs')
const { readHelped, toggleHelped } = await import('./mobilityHelped.mjs')
const { MobilityHomeworkHome, saveHomework, homeworkLibrary } = await import('./mobilityHomework.mjs')
const ex = homeworkLibrary()[0].exercises[0]
const at = day => () => new Date(day + 'T12:00:00')
const day = '2026-10-29', clock = at(day)
const click = (view, label) => { button(view.render(), label).props.onClick(); return view.render() }

test('strict default OFF: no storage reads, writes, hooks or new controls', () => {
  assert.equal(DEFAULT_MOBILITY_ADHERENCE, false)
  const storage = { getItem() { assert.fail('OFF read') }, setItem() { assert.fail('OFF write') } }
  for (const enabled of [undefined, false, 1, 'true']) for (const Component of [HomeworkExerciseProgress, MobilityAdherenceProfile])
    assert.equal(mount(Component, { enabled, athleteId: 'a', exercise: ex, storage, clock }).render(), null)
  const store = memory(); saveHomework('a', { problemId: 'squat-hip', exerciseIds: [ex.id] }, store)
  const props = { enabled: true, athleteId: 'a', storage: store }
  const structure = value => JSON.parse(JSON.stringify(value, (key, item) => typeof item === 'function' ? '[handler]' : item))
  assert.deepEqual(structure(mount(MobilityHomeworkHome, props).render()), structure(mount(MobilityHomeworkHome, { ...props, adherenceEnabled: false, renderExerciseProgress() { assert.fail('OFF callback') } }).render()))
})

test('calendar window includes today and day minus 13, excludes minus 14 and future, deduplicates days', () => {
  const row = date => ({ ...ex, date })
  const result = adherenceSummary(['2026-10-15', '2026-10-16', day, day, '2026-10-30'].map(row), ['2026-10-15', '2026-10-16', day, '2026-10-30'].map(row), day)
  assert.equal(result.first, '2026-10-16'); assert.equal(result.days, 2)
  assert.deepEqual(result.helped.map(row => row.date), ['2026-10-16', day])
  assert.equal(adherenceSummary([], [], day).days, 0)
  for (const [today, first] of [['2026-03-30','2026-03-17'],['2026-10-26','2026-10-13'],['2028-03-01','2028-02-17'],['2027-01-03','2026-12-21']])
    assert.equal(adherenceSummary([], [], today).first, first)
  assert.throws(() => adherenceSummary([], [], '2026-02-30'))
})

test('actual Home lists assigned exercise and calls actual done/helped handlers', () => {
  const storage = memory(); saveHomework('a', { problemId: 'squat-hip', exerciseIds: [ex.id] }, storage)
  const home = mount(MobilityHomeworkHome, { enabled: true, athleteId: 'a', storage, adherenceEnabled: true,
    renderExerciseProgress: exercise => h(HomeworkExerciseProgress, { enabled: true, athleteId: 'a', exercise, storage, clock }) })
  assert.equal(button(home.render(), `Lavet i dag: ${ex.name}`).props['aria-pressed'], false)
  click(home, `Lavet i dag: ${ex.name}`); click(home, `Hjalp i dag: ${ex.name}`)
  assert.equal(readDone('a', storage).rows[0].date, day); assert.equal(readHelped('a', storage).rows[0].id, ex.id)
  assert.equal(button(home.render(), `Lavet i dag: ${ex.name}`).props['aria-pressed'], true)
  click(home, `Lavet i dag: ${ex.name}`)
  assert.equal(readDone('a', storage).rows.length, 0); assert.equal(readHelped('a', storage).rows.length, 1)
  assert.ok(nodes(home.render(), n => n.type === 'button' && text(n).includes('i dag:')).every(n => n.props.style.minHeight >= 44 && n.props.style.whiteSpace === 'normal'))
  home.unmount()
})

test('no assignment gives no marking buttons, new flag does not enable old homework', () => {
  const props = { athleteId: 'a', storage: memory(), adherenceEnabled: true, renderExerciseProgress() { assert.fail('No exercise') } }
  assert.equal(mount(MobilityHomeworkHome, props).render(), null)
  assert.equal(nodes(mount(MobilityHomeworkHome, { ...props, enabled: true }).render(), n => n.type === 'button').length, 1)
})

test('actual profile renders empty state, reads existing helped rows, refreshes and scopes athlete changes', () => {
  const storage = memory(), props = { enabled: true, athleteId: 'a', storage, clock }
  const profile = mount(MobilityAdherenceProfile, props)
  assert.match(text(profile.render()), /0 af 14 dage/); assert.match(text(profile.render()), /Ingen lokale udførelser/)
  toggleDone('a', ex, day, storage); toggleDone('a', { id: 'other', name: 'Other' }, day, storage)
  toggleHelped('a', ex, day, storage); toggleHelped('a', { id: 'old', name: 'Out of window' }, '2026-10-15', storage)
  const rendered = text(click(profile, 'Genindlæs lokale udførelser'))
  assert.match(rendered, /1 af 14 dage/); assert.ok(rendered.includes(ex.name)); assert.ok(!rendered.includes('Out of window'))
  assert.match(rendered, /Ikke sendt til coachens anden enhed/)
  assert.match(text(profile.render({ ...props, athleteId: 'b' })), /0 af 14 dage/)
  profile.unmount()
})

test('a retained handler across midnight writes the new local day for both buttons', () => {
  let now = new Date(2026, 9, 28, 23, 59)
  const storage = memory(), props = { enabled: true, athleteId: 'a', exercise: ex, storage, clock: () => now }
  const view = mount(HomeworkExerciseProgress, props)
  click(view, `Lavet i dag: ${ex.name}`)
  const retainedDone = button(view.render(), `Lavet i dag: ${ex.name}`).props.onClick
  const retainedHelped = button(view.render(), `Hjalp i dag: ${ex.name}`).props.onClick
  now = new Date(2026, 9, 29, 0, 1); retainedDone(); retainedHelped()
  assert.deepEqual(readDone('a', storage).rows.map(row => row.date), ['2026-10-29','2026-10-28'])
  assert.equal(readHelped('a', storage).rows[0].date, '2026-10-29')
  assert.equal(button(view.render(), `Lavet i dag: ${ex.name}`).props['aria-pressed'], true)
  assert.equal(localDay(new Date(2026, 0, 1, 0, 1)), '2026-01-01')
  view.unmount()
})

test('date watcher runs timer/focus/visibility refresh and cleans up all listeners', () => {
  const events = new Map(), docEvents = new Map(); let interval, cleared = false, now = '2026-10-28'
  const host = { setInterval(fn, ms) { assert.equal(ms, 30000); interval = fn; return 7 }, clearInterval(id) { assert.equal(id, 7); cleared = true },
    addEventListener: (name, fn) => events.set(name, fn), removeEventListener: (name, fn) => { assert.equal(events.get(name), fn); events.delete(name) } }
  const doc = { addEventListener: (name, fn) => docEvents.set(name, fn), removeEventListener: (name, fn) => { assert.equal(docEvents.get(name), fn); docEvents.delete(name) } }
  const days = [], cleanup = watchLocalDay(value => days.push(value), () => at(now)(), host, doc)
  now = day; interval(); events.get('focus')(); docEvents.get('visibilitychange')()
  assert.deepEqual(days, [day, day, day]); cleanup(); assert.ok(cleared); assert.equal(events.size + docEvents.size, 0)
})

test('actual hook updates pressed state and profile window on midnight and cleans up on unmount', () => {
  const original = globalThis.window, intervals = new Set(), events = new Set()
  globalThis.window = { setInterval(fn) { intervals.add(fn); return fn }, clearInterval: fn => intervals.delete(fn),
    addEventListener: (name, fn) => events.add(fn), removeEventListener: (name, fn) => events.delete(fn) }
  let now = '2026-10-29'
  const storage = memory(), props = { enabled: true, athleteId: 'a', storage, clock: () => at(now)() }
  const view = mount(HomeworkExerciseProgress, { ...props, exercise: ex }), profile = mount(MobilityAdherenceProfile, props)
  try {
    toggleDone('a', ex, '2026-10-16', storage); toggleDone('a', ex, day, storage)
    assert.equal(button(view.render(), `Lavet i dag: ${ex.name}`).props['aria-pressed'], true)
    assert.match(text(profile.render()), /2 af 14 dage/)
    now = '2026-10-30'; for (const refresh of intervals) refresh()
    assert.equal(button(view.render(), `Lavet i dag: ${ex.name}`).props['aria-pressed'], false)
    assert.match(text(profile.render()), /1 af 14 dage/)
    assert.equal(intervals.size, 2)
  } finally {
    view.unmount(); profile.unmount()
    assert.equal(intervals.size + events.size, 0)
    if (original === undefined) delete globalThis.window
    else globalThis.window = original
  }
})

test('production wiring has strict prop propagation, preview guard and no release default enablement', () => {
  const source = path => readFileSync(new URL(path, import.meta.url), 'utf8')
  const app = source('./App.jsx'), athlete = source('./AthleteView.jsx'), dashboard = source('./Dashboard.jsx'), profile = source('./dashboard/ProfilHoved.jsx')
  for (const s of [app, athlete, dashboard, profile]) assert.match(s, /mobilitetOpfoelgning = false/)
  assert.equal(app.match(/mobilitetOpfoelgning: mobilitetOpfoelgning === true/g).length, 3)
  assert.match(athlete, /<MobilityHomeworkProgress enabled=\{mobilitetOpfoelgning === true && !coachAthleteId\} athleteId=\{athlete\?\.id\}>/)
  assert.match(dashboard, /adherenceContent: mobilitetOpfoelgning === true \? <MobilityAdherenceProfile key=\{a.id\} enabled=\{true\} athleteId=\{a.id\} \/> : null/)
  assert.match(profile, /mobilitetOpfoelgning === true \? adherenceContent : null/)
  assert.ok(!source('./rel1030.mjs').includes('mobilitetOpfoelgning'))
  assert.ok(!source('./fridayPreview.mjs').includes('mobilitetOpfoelgning'))
})
