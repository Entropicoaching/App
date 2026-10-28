import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { install } from './mob6Loader.mjs'
import { mount, text, nodes, button } from './mob6Dom.mjs'
install({ lineEnding: process.argv.includes('--crlf') ? '\r\n' : '\n' })
const { DEFAULT_MOBILITY_HOMEWORK, homeworkLibrary, readHomework, saveHomework, MobilityHomeworkCoach, MobilityHomeworkHome } = await import('./mobilityHomework.mjs')
const Profile = (await import('./ProfilHoved.jsx')).default
const memory = () => { const data = new Map(); return { data, getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) } }
const choice = { problemId: 'squat-hip', exerciseIds: ['sq-mob-3'] }
const click = (view, label) => { button(view.render(), label).props.onClick(); return view.render() }
function check(view, index) { nodes(view.render(), n => n.type === 'input')[index].props.onChange(); return view.render() }

test('OFF is strict and never touches storage', () => {
  assert.equal(DEFAULT_MOBILITY_HOMEWORK, false)
  const storage = { getItem() { assert.fail('OFF read') }, setItem() { assert.fail('OFF write') } }
  for (const enabled of [undefined, false, 'true', 1]) for (const Component of [MobilityHomeworkCoach, MobilityHomeworkHome])
    assert.equal(mount(Component, { enabled, athleteId: 'a', storage }).render(), null)
})
test('library groups pinned exercises under all three lifts and marks placeholder text', () => {
  const problems = homeworkLibrary()
  assert.deepEqual([...new Set(problems.map(p => p.lift))], ['Squat', 'Bænkpres', 'Dødløft'])
  assert.ok(problems.every(p => p.explanation === 'Øvelserne er valgt efter, hvad hovedløftet kræver af dig.' && p.exercises.length > 0 && p.exercises.length <= 4))
  problems[0].exercises[0].name = 'mutation'
  assert.notEqual(homeworkLibrary()[0].exercises[0].name, 'mutation')
})
test('actual coach handlers assign four, reload and render actual Home, then remove', () => {
  const storage = memory()
  const coach = mount(MobilityHomeworkCoach, { enabled: true, athleteId: 'a', storage })
  assert.match(text(coach.render()), /Ingen lokal tildeling/)
  assert.equal(button(coach.render(), 'Gem hjemmeøvelser lokalt').props.disabled, true)
  for (let i = 0; i < 4; i++) check(coach, i)
  click(coach, 'Gem hjemmeøvelser lokalt')
  assert.equal(readHomework('a', storage).value.exerciseIds.length, 4)
  const home = mount(MobilityHomeworkHome, { enabled: true, athleteId: 'a', storage })
  assert.match(text(home.render()), /Hjemmeøvelser fra din coach/)
  assert.match(text(home.render()), /90\/90 hofterotation/)
  assert.equal(nodes(home.render(), n => n.type === 'li').length, 4)
  click(coach, 'Fjern lokal tildeling')
  assert.match(text(click(home, 'Genindlæs hjemmeøvelser')), /Ingen hjemmeøvelser/)
})
test('changing problem discards draft choices and saves only its own exercises', () => {
  const storage = memory(), coach = mount(MobilityHomeworkCoach, { enabled: true, athleteId: 'a', storage })
  check(coach, 0)
  nodes(coach.render(), n => n.type === 'select')[0].props.onChange({ target: { value: 'bench-shoulder' } })
  assert.ok(nodes(coach.render(), n => n.type === 'input').every(n => !n.props.checked))
  check(coach, 1); click(coach, 'Gem hjemmeøvelser lokalt')
  assert.deepEqual(readHomework('a', storage).value, { problemId: 'bench-shoulder', exerciseIds: ['bp-mob-2'] })
})
test('no assignment and athlete switches cannot leak previous state', () => {
  const storage = memory(); saveHomework('a', choice, storage)
  const coach = mount(MobilityHomeworkCoach, { enabled: true, athleteId: 'a', storage })
  coach.render()
  assert.match(text(coach.render({ enabled: true, athleteId: 'b', storage })), /Ingen lokal tildeling/)
  const home = mount(MobilityHomeworkHome, { enabled: true, athleteId: 'a', storage }); home.render()
  assert.match(text(home.render({ enabled: true, athleteId: 'b', storage })), /Ingen hjemmeøvelser/)
  assert.equal(readHomework('b', storage).value, null)
})
test('reject malformed, duplicate, foreign and more than four selections without writing', () => {
  const storage = memory(); saveHomework('a', choice, storage); const before = [...storage.data]
  for (const value of [{}, { ...choice, exerciseIds: [] }, { ...choice, exerciseIds: ['sq-mob-3', 'sq-mob-3'] },
    { ...choice, exerciseIds: ['bp-mob-2'] }, { ...choice, problemId: '__proto__' },
    { ...choice, exerciseIds: ['sq-mob-1', 'sq-mob-3', 'sq-mob-4', 'sq-mov-1', 'sq-mob-2'] }]) assert.ok(saveHomework('a', value, storage).error)
  assert.ok(saveHomework('', choice, storage).error)
  assert.deepEqual([...storage.data], before)
})
test('corruption and wrong athlete envelope fail closed and are never overwritten', () => {
  for (const raw of ['{', JSON.stringify({ version: 1, athleteId: 'b', value: choice }), 'x'.repeat(10001)]) {
    const storage = memory(); saveHomework('a', choice, storage); const key = [...storage.data.keys()][0]; storage.data.set(key, raw)
    assert.ok(readHomework('a', storage).error); assert.ok(saveHomework('a', choice, storage).error)
    assert.equal(storage.data.get(key), raw)
    assert.doesNotMatch(text(mount(MobilityHomeworkHome, { enabled: true, athleteId: 'a', storage }).render()), /90\/90/)
  }
})
test('write failure is visible and retains previous assignment', () => {
  const storage = memory(); saveHomework('a', choice, storage)
  const broken = { getItem: storage.getItem, setItem() { throw Error('quota') } }
  const coach = mount(MobilityHomeworkCoach, { enabled: true, athleteId: 'a', storage: broken })
  assert.match(text(click(coach, 'Fjern lokal tildeling')), /kunne ikke gemmes/)
  assert.deepEqual(readHomework('a', storage).value, choice)
  const blocked = { getItem() { throw Error('blocked') } }
  assert.match(text(mount(MobilityHomeworkHome, { enabled: true, athleteId: 'a', storage: blocked }).render()), /kunne ikke læses/)
})
test('actual profile renders assignment editor only behind flag', () => {
  globalThis.localStorage = memory()
  const props = { a: { id: 'a', name: 'Synthetic', status: 'active' }, profilesLastSeen: {}, unreadCounts: {} }
  const profile = mount(Profile, props)
  assert.doesNotMatch(text(profile.render()), /Hjemmeøvelser til atleten/)
  assert.match(text(profile.render({ ...props, mobilitetHjemme: true })), /Hjemmeøvelser til atleten/)
})
test('App forwards explicit OFF flag and Home wiring preserves home route and athlete scope', () => {
  const app = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8')
  assert.match(app, /mobilitetHjemme = false/)
  assert.equal((app.match(/mobilitetHjemme: mobilitetHjemme === true/g) || []).length, 3)
  const athlete = readFileSync(new URL('./AthleteView.jsx', import.meta.url), 'utf8')
  assert.match(athlete, /tab === 'hjem' && \(!enkelOn \|\| \['traening', 'alle'\].includes\(route\)\) && <MobilityHomeworkHome key=\{athlete\?\.id\} enabled=\{mobilitetHjemme\} athleteId=\{athlete\?\.id\}/)
  const dashboard = readFileSync(new URL('./Dashboard.jsx', import.meta.url), 'utf8')
  assert.match(dashboard, /<ProfilHoved \{\.\.\.\{ (?:mobilitetCoach: mobilitetCoach === true, )?mobilitetHjemme: mobilitetHjemme === true/)
})
