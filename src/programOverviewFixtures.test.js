import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { buildSeed, ATHLETE_ID, WEEK_ID, SESSION_ID, EXERCISE_ID } from '../e2e/fixtures.mjs'
import { buildPreviewSeed, ATHLETE } from './fridayPreviewSeed.mjs'
import { buildProgramOverblik, DEFAULT_PROGRAM_OVERBLIK, programOverblikEnabled } from './programOverblik.mjs'
import { DEFAULT_REL1030, REL1030_FEATURES } from './rel1030.mjs'

// Only React element creation and unrelated styles are synthetic. Import the
// actual view and calendar calculation; no app, effects, storage or backend.
const viewUrl = new URL('./dashboard/ProgramOverblikView.mjs', import.meta.url).href
const dataModule = source => 'data:text/javascript,' + encodeURIComponent(source)
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL === viewUrl && specifier === 'react') return {
      url: dataModule('export function createElement(type, props, ...children) { return { type, props: props || {}, children: children.flat(Infinity).filter(v => v != null && v !== false) } }'), shortCircuit: true,
    }
    if (context.parentURL === viewUrl && specifier === '../dashboardShared.js') return {
      url: dataModule('export const s = { page: {}, wrap: {}, topbarTitle: {}, card: {} }'), shortCircuit: true,
    }
    return next(specifier, context)
  },
})
let ProgramOverblik
try { ({ default: ProgramOverblik } = await import(viewUrl)) } finally { hooks.deregister() }
const nodes = tree => typeof tree !== 'object' || tree === null ? [] : [tree, ...tree.children.flatMap(nodes)]
const text = tree => typeof tree !== 'object' || tree === null ? String(tree ?? '') : tree.children.map(text).join(' ')

// Same relationship traversal as the calendar read model: count real seeded
// exercises under each week's sessions. Dates are never fabricated by a test.
function calendarInput(tables, today) {
  return { athletes: tables.athletes, today, calendarWeeks: Object.fromEntries(tables.athletes.map(a => [a.id,
    tables.weeks.filter(w => w.athlete_id === a.id).map(w => ({ ...w,
      exercise_count: tables.exercises.filter(e => tables.sessions.some(s => s.week_id === w.id && s.id === e.session_id)).length,
    })),
  ])) }
}
const factories = [
  ['e2e', () => buildSeed({ now: new Date('2026-11-01T12:00:00Z') }).tables, ATHLETE_ID,
    ['2026-11-01', '2026-10-25', '2026-10-11'], '2026-11-01'],
  ['preview', () => buildPreviewSeed(new Date(2026, 9, 30, 12)), ATHLETE,
    ['2026-11-08', '2026-11-01', '2026-10-18'], '2026-11-08'],
]
for (const [name, factory, athleteId, dates, lastDate] of factories) {
  for (const [i, weeks, urgency, color, label] of [
    [0, 0, 'red', '#ffb0a0', '0 uger tilbage'],
    [1, 1, 'yellow', '#f1cf7b', '1 uge tilbage'],
    [2, 3, 'normal', '#edeae2', '3 uger tilbage'],
  ]) test(`${name}: dated, populated program renders ${weeks} weeks and ${urgency}`, () => {
    const tables = factory(), before = structuredClone(tables)
    const input = calendarInput(tables, dates[i])
    const [entry] = buildProgramOverblik(input)
    assert.equal(entry.status, 'planned')
    assert.equal(entry.lastDate, lastDate)
    assert.equal(entry.weeksLeft, weeks)
    assert.equal(entry.daysLeft, weeks * 7)
    assert.equal(entry.urgency, urgency)
    const opened = []
    const tree = ProgramOverblik({ ...input, openProfile: (...args) => opened.push(args) })
    const buttons = nodes(tree).filter(n => n.type === 'button')
    assert.equal(buttons.length, 1)
    assert.ok(text(buttons[0]).includes(label))
    assert.equal(buttons[0].props.style.color, color)
    assert.equal(buttons[0].props.style.border, `1px solid ${color}`)
    buttons[0].props.onClick()
    assert.deepEqual(opened, [[tables.athletes.find(a => a.id === athleteId), 'program']])
    assert.deepEqual(tables, before)
  })

  test(`${name}: removing exercises or dates cannot leave a planned program`, () => {
    const tables = factory()
    tables.exercises = []
    assert.equal(buildProgramOverblik(calendarInput(tables, dates[0]))[0].status, 'empty')
    const undated = factory()
    undated.weeks.forEach(w => { w.start_date = null })
    assert.equal(buildProgramOverblik(calendarInput(undated, dates[0]))[0].status, 'undated')
  })
}

test('fixture clock uses Copenhagen civil Monday across midnight and DST', () => {
  for (const [instant, monday, weekday, today] of [
    ['2026-11-01T22:59:59Z', '2026-10-26', 6, '2026-11-01'],
    ['2026-11-01T23:00:00Z', '2026-11-02', 0, '2026-11-02'],
    ['2026-03-29T00:30:00Z', '2026-03-23', 6, '2026-03-29'],
    ['2026-03-29T22:30:00Z', '2026-03-30', 0, '2026-03-30'],
    ['2026-10-25T00:30:00Z', '2026-10-19', 6, '2026-10-25'],
    ['2026-10-25T01:30:00Z', '2026-10-19', 6, '2026-10-25'],
    ['2026-12-31T23:30:00Z', '2026-12-28', 4, '2027-01-01'],
  ]) {
    const { tables } = buildSeed({ now: new Date(instant), withLogs: true })
    assert.equal(tables.weeks[0].start_date, monday, instant)
    assert.equal(tables.sessions[0].weekday, weekday, instant)
    assert.equal(tables.readiness_logs[0].logged_date, today, instant)
    assert.equal(tables.exercise_logs[0].logged_at, instant.replace('Z', '.000Z'), instant)
  }
})

test('default fixture stays populated; optional logs and video fixtures stay linked and isolated', () => {
  const now = new Date('2026-10-30T12:00:00Z')
  const seed = buildSeed({ now })
  assert.deepEqual(seed, buildSeed({ now }))
  assert.equal(seed.tables.weeks.length, 1)
  assert.equal(seed.tables.weeks[0].id, WEEK_ID)
  assert.equal(seed.tables.sessions[0].id, SESSION_ID)
  assert.equal(seed.tables.exercises[0].id, EXERCISE_ID)
  assert.equal(seed.tables.exercises[0].sets, 4)
  assert.equal(seed.tables.exercise_logs.length, 0)
  assert.equal(seed.tables.video_analyses.length, 0)
  const rich = buildSeed({ now, withLogs: true, withAnalyzedVideo: true, withMeasuredVideo: true })
  assert.equal(rich.tables.exercise_logs.length, 3)
  assert.equal(rich.tables.video_analyses.length, 2)
  assert.ok(rich.tables.exercise_logs.every(l => l.exercise_id === EXERCISE_ID && l.athlete_id === ATHLETE_ID))
  assert.ok(rich.tables.video_analyses.every(v => v.athlete_id === ATHLETE_ID))
  rich.tables.weeks[0].start_date = null
  assert.equal(buildSeed({ now }).tables.weeks[0].start_date, '2026-10-26')
  assert.equal(now.toISOString(), '2026-10-30T12:00:00.000Z')
  assert.equal(buildSeed().tables.weeks[0].start_date?.length, 10)
})

test('production flags remain OFF and the closed release list stays exact', () => {
  assert.equal(DEFAULT_PROGRAM_OVERBLIK, false)
  assert.equal(DEFAULT_REL1030, false)
  for (const search of ['', '?programOverblik=0', '?programOverblik=true', '?programOverblik=1&programOverblik=0']) assert.equal(programOverblikEnabled(search), false)
  assert.deepEqual(REL1030_FEATURES, [
    'indbakke2', 'hviledage', 'mobilitetFoerPas', 'mobilitetFokus', 'mobilitetHjalp',
    'analyseSamlet', 'analyseSammenlign', 'coachRyd', 'coachUge',
    'videoFeedbackPlayback', 'analyseConclusion', 'mobilitetCoach', 'mobilitetHjemme', 'programOverblik',
  ])
})
