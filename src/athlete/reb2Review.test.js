import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { Program, Baseline, helpers, model } from './prog2Loader.mjs'
import { mount, nodes, text, button, io } from './prog2Dom.mjs'

const source = name => readFileSync(new URL(name, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const hash = value => createHash('sha256').update(value).digest('hex')
const shape = value => JSON.parse(JSON.stringify(value, (_, v) => typeof v === 'function' ? '[handler]' : v))
const previews = tree => nodes(tree, n => n.props['data-program-day-preview'])
function fixture(index = 1, count = 7) {
  const allWeeks = ['2026-10-19', '2026-10-26', '2026-11-02'].map((start_date, i) => ({
    id: `w${i}`, week_number: i + 1, start_date, block_name: 'Styrke',
    sessions: [{ id: `s${i}`, title: `Pas ${i}`, weekday: 0, exercises: Array.from({ length: count }, (_, j) => ({
      id: `e${j}`, name: `Squat ${j}`, sets: j === 0 ? 1 : 3, reps: j === 0 ? '3' : '5-8', intensity: 'RPE 8',
    })) }, { id: `rest${i}`, title: 'Pause', weekday: 2, exercises: [] }],
  }))
  const p = { ...helpers, allWeeks, currentWeek: allWeeks[0], viewingWeekIdx: index, athlete: { id: 'synthetic' },
    exerciseLogs: [], pastLogs: [], progOpenSession: null, sessionRefs: { current: {} }, dismissedFeedback: new Set(),
    feedbackInputs: {}, logInputs: {}, exWarmupExpanded: {}, warmupChecked: {}, programNaesteUge: true,
  }
  p.openSession = id => { p.progOpenSession = id }
  p.setViewingWeekIdx = index => { p.viewingWeekIdx = index }
  p.setProgOpenSession = id => { p.progOpenSession = id }
  p.setPastLogs = logs => { p.pastLogs = logs }
  p.askConfirm = (_, action) => action()
  p.skipRemainingSets = session => { p.skipped = session.id }
  p.autoCompleteSession = session => { p.filled = session.id }
  return p
}
const render = p => mount(Program, p).render()
const freeze = t => t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-10-25T12:00:00Z') })

test('REB2: baseline pin and complete App/AthleteView union survive LF normalization', () => {
  assert.equal(hash(source('prog2Baseline.txt')), 'ac4cfa59645e9391236b64a7a76eb39bdcdd451ed2c45a0d7b25699087a57f81')
  const app = source('../App.jsx').replace('programNaesteUge = false, ', '')
    .replaceAll(' programNaesteUge: programNaesteUge === true,', '')
    .replace('blokStyrke = false, ', '').replaceAll(' blokStyrke: blokStyrke === true,', '')
  assert.equal(hash(app), '0d9f04358e92c94cee1b0eed5a897be72f51619c21e0eb9983ae6a1680c9da19')
  const athlete = source('../AthleteView.jsx').replace('programNaesteUge = false, ', '')
    .replace('programUgeFoerst, programNaesteUge,', 'programUgeFoerst,')
    .replace('videoSetRef, videoOptag2: arguments[0]?.videoOptag2 === true,', 'videoSetRef,')
    .replace('blokStyrke = false, ', '').replaceAll(' blokStyrke: blokStyrke === true,', '')
  assert.equal(hash(athlete), 'e29e4e22bd5d6a4e997d6b94eaa61c5d9a889dd3ada5df32746d6b32bd8624b3')
})
test('REB2: strict OFF matches current pinned Program DOM across counts and weeks', t => {
  freeze(t)
  for (const flag of [undefined, false, null, 'true', 1, {}]) for (const count of [0, 2, 7]) for (const index of [0, 1, 2]) {
    const p = { ...fixture(index, count), programNaesteUge: flag }
    assert.deepEqual(shape(render(p)), shape(mount(Baseline, p).render()))
  }
})
test('REB2: block overview and intensity flags coexist with upcoming cards and navigation', t => {
  freeze(t)
  const p = fixture()
  p.programBlokOversigt = true
  p.programIntensityHelp = true
  const tree = render(p)
  assert.equal(previews(tree).length, 1)
  assert.equal(nodes(tree, n => n.props['data-hviledag'] !== undefined).length, 6)
  assert.match(text(tree), /Squat 0: 1 x 3/)
  assert.match(text(tree), /Squat 1: 3 x 5-8/)
  const baseline = mount(Baseline, p).render()
  const weekButtons = nodes(baseline, n => n.type === 'button' && /^Uge /.test(text(n).trim()))
  assert.equal(weekButtons.length, 3)
  for (const node of weekButtons) {
    assert.ok(nodes(tree, n => n.type === 'button' && text(n) === text(node)).length)
  }
  const header = nodes(tree, n => n.type === 'div' && n.props.onClick && text(n).includes('Pas 1'))[0]
  header.props.onClick()
  assert.equal(p.progOpenSession, 's1')
  nodes(tree, n => n.type === 'button' && /^Uge 3/.test(text(n).trim()))[0].props.onClick()
  assert.equal(p.viewingWeekIdx, 2)
  assert.equal(p.progOpenSession, null)
  assert.equal(io.rpc, 0)
})
test('REB2: begun calendar week preserves bulk handlers despite future index', t => {
  freeze(t)
  const p = fixture(); p.allWeeks[1].start_date = '2026-10-20'
  const tree = render(p)
  assert.equal(previews(tree).length, 0)
  assert.deepEqual(shape(tree), shape(mount(Baseline, p).render()))
  button(tree, 'Spring resten over').props.onClick({ stopPropagation() {} })
  button(tree, 'Auto-udfyld').props.onClick({ stopPropagation() {} })
  assert.equal(p.skipped, 's1'); assert.equal(p.filled, 's1')
})
test('REB2: missing date uses real weekStartDate; absent anchors use existing order', t => {
  freeze(t)
  const p = fixture(2); delete p.allWeeks[2].start_date
  assert.ok(helpers.weekStartDate(p.allWeeks, 3))
  assert.equal(previews(render(p)).length, 1)
  p.allWeeks.forEach(w => { delete w.start_date })
  assert.equal(previews(render(p)).length, 1)
  p.viewingWeekIdx = 0
  assert.equal(previews(render(p)).length, 0)
})
test('REB2: both Copenhagen DST boundaries use exact calendar midnight', () => {
  for (const [start, before, after] of [
    ['2026-03-30', '2026-03-29T21:59:59.999Z', '2026-03-29T22:00:00Z'],
    ['2026-10-26', '2026-10-25T22:59:59.999Z', '2026-10-25T23:00:00Z'],
  ]) {
    assert.equal(model.upcomingProgramWeek(start, false, new Date(before)), true)
    assert.equal(model.upcomingProgramWeek(start, true, new Date(after)), false)
  }
})
test('REB2: sparse prescriptions are bounded plain text without mutation', () => {
  const rows = [null, { name: '<img onerror=bad>', sets: 0, reps: 'AMRAP' }, {},
    { name: 'Top', sets: 1, reps: 3 }, { name: 'Backoff', sets: 4, reps: '5-8' }, { name: 'More' }]
  const before = JSON.stringify(rows)
  assert.deepEqual(model.programDayPreview(rows), {
    lines: ['<img onerror=bad>: 0 x AMRAP', 'Øvelse: ? x ?', 'Top: 1 x 3', 'Backoff: 4 x 5-8'], more: 1,
  })
  assert.equal(JSON.stringify(rows), before)
  assert.deepEqual(model.programDayPreview(null), { lines: [], more: 0 })
})
