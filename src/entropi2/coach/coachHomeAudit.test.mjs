import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import CoachScreen, { CoachView } from './CoachScreen.mjs'
import WeeklyReport from './WeeklyReport.mjs'
import ProgramEndingView from './ProgramEndingView.mjs'
import CoachProgramsView from './CoachProgramsView.mjs'
import { SessionNotesView, notesModel } from './SessionNotesView.mjs'
import { coachHomeModel } from './coachModel.mjs'
import { productionFixture, day, athleteId } from './coachProductionFixture.mjs'

const nodes = n => Array.isArray(n) ? n.flatMap(nodes) : !n || typeof n !== 'object' ? [] :
  [n, ...nodes(n.props?.children ?? n.children)]
const text = n => Array.isArray(n) ? n.map(text).join(' ') : n == null || typeof n === 'boolean' ? '' :
  typeof n !== 'object' ? String(n) : text(n.props?.children ?? n.children)
const fold = (tree, name) => nodes(tree).find(n => n.props?.['data-coach-fold'] === name)
const attention = p => nodes(CoachView(p)).find(n => n.props?.['aria-label'] === 'Atleter der kræver handling')
const report = p => WeeklyReport(p)
const model = p => coachHomeModel(p, day)

test('home audit: Dashboard refresh callback reuses actual readers and retries a failed roster first', async () => {
  const source = readFileSync(new URL('../../Dashboard.jsx', import.meta.url), 'utf8')
  const seam = source.match(/reloadOverview=\{(async \(\) => \{[^\n]+\})\}/)?.[1]
  assert.ok(seam)
  assert.ok(source.indexOf('reloadOverview=') > source.indexOf('{e2 && (view ==='))
  for (const loadError of [true, false]) {
    const calls = []
    const callback = Function('loadError', 'fetchAthletes', 'refreshCoachInbox', `return (${seam})`)(
      loadError, async () => { calls.push('roster') }, async () => { calls.push('overview') })
    assert.deepEqual(calls, [])
    await callback()
    assert.deepEqual(calls, loadError ? ['roster', 'overview'] : ['overview'])
  }
})

test('home audit: loading has one status inside attention and no premature empty conclusion', () => {
  const p = productionFixture(); p.loading = true; delete p.readContext
  const tree = CoachView(p), section = attention(p)
  assert.equal(nodes(tree).filter(n => n.props?.role === 'status').length, 1)
  assert.match(text(section), /Opdaterer overblikket…/)
  assert.doesNotMatch(text(tree), /Ingen synlige|Ingen atleter kræver|Ukendt antal|Programgrundlaget/)
  for (const name of ['ugerapport', 'programslut', 'programmer', 'noter']) assert.equal(fold(tree, name), undefined)
})

test('home audit: missing receipt offers the existing overview refresh, without an action count', () => {
  const p = productionFixture(); let calls = 0; delete p.readContext
  p.reloadOverview = () => { calls++ }
  const section = attention(p), retry = nodes(section).find(n => n.type === 'button')
  assert.match(text(section), /Overblikket skal opdateres/)
  assert.match(text(retry), /Opdater overblikket/)
  retry.props.onClick(); assert.equal(calls, 1)
  assert.doesNotMatch(text(section), /Ingen atleter|Ukendt antal/)
})

for (const [label, change] of Object.entries({
  roster: p => { p.loadError = true; delete p.readContext },
  calendar: p => { p.coachActionsStatus.calendar = 'error'; delete p.readContext },
  activity: p => { p.coachActionsStatus.activity.state = 'error' },
  logs: p => { p.coachMorningData.logs = { state: 'error' } },
  messages: p => { p.coachMorningData.messages.state = 'error' },
  videos: p => { p.coachMorningData.videos.state = 'error' },
})) test(`home audit: ${label} failure stays an error with retry, never a new/empty athlete claim`, () => {
  const p = productionFixture(); let retried = 0; p.reloadOverview = () => { retried++ }; change(p)
  const section = attention(p)
  assert.equal(model(p).hasError, true)
  assert.equal(nodes(section).filter(n => n.props?.role === 'alert').length, 1)
  assert.match(text(section), /kunne ikke hentes/)
  assert.doesNotMatch(text(section), /Ingen synlige|Ingen atleter kræver|Intet venter/)
  nodes(section).find(n => n.type === 'button').props.onClick(); assert.equal(retried, 1)
})

test('home audit: refresh in progress disables the error retry and never reports all clear', () => {
  const p = productionFixture(); p.coachActionsStatus.activity.state = 'error'; p.inboxRefreshing = true
  p.reloadOverview = () => {}
  assert.equal(nodes(attention(p)).find(n => n.type === 'button').props.disabled, true)
  assert.doesNotMatch(text(attention(p)), /Ingen atleter kræver/)
})

test('home audit: only confirmed empty reads permit an all-clear conclusion', () => {
  const p = productionFixture(); p.coachActionsStatus.activity.rows = []; p.calendarWeeks[athleteId] = []
  assert.match(text(attention(p)), /Ingen atleter kræver dit blik lige nu/)
  p.coachActionsStatus.activity.state = 'partial'
  assert.doesNotMatch(text(attention(p)), /Ingen atleter kræver/)
  assert.match(text(attention(p)), /skal opdateres/)
})

test('home audit: unknown report values are silent; known zero and known planned count remain', () => {
  const p = productionFixture(); delete p.coachNutrition; p.coachActionsStatus.activity.state = 'error'
  assert.match(text(report(p)), /Pas planlagt: 3/)
  assert.doesNotMatch(text(report(p)), /Pas logget|RPE-snit|Kostdage|Proteinmål|ukendt/i)
  p.coachActionsStatus.activity.state = 'ready'; p.coachActionsStatus.activity.rows = []
  assert.match(text(report(p)), /Pas logget: 0 af 3 planlagte/)
  p.calendarWeeks[athleteId][0].start_date = null
  assert.equal(report(p), null)
  assert.equal(fold(CoachView(p), 'ugerapport'), undefined)
})

test('home audit: documented logged sessions without a denominator do not imply completion', () => {
  const p = productionFixture(); p.calendarWeeks[athleteId][0].session_count = null
  p.coachActionsStatus.activity.rows[0].rpe_actual = null
  const value = text(report(p))
  assert.match(value, /Pas logget: 1/)
  assert.doesNotMatch(value, /af ukendt|planlagte|RPE-snit|ukendt/i)
})

test('home audit: missing protein goal hides just goal rows; confirmed empty meals still show zero', () => {
  const p = productionFixture(); p.coachNutrition.targets = []
  assert.match(text(report(p)), /Kostdage logget: 7\/7/)
  assert.doesNotMatch(text(report(p)), /Proteinmål/)
  p.coachNutrition.rows = []
  assert.match(text(report(p)), /Kostdage logget: 0\/7/)
  p.coachNutrition.targets = [{ athlete_id: athleteId, protein_target: 100 }]
  assert.match(text(report(p)), /Proteinmål nået: 0 af 0 loggede dage/)
})

test('home audit: nutrition failure retains its one open error fold and retry', () => {
  const p = productionFixture(); let calls = 0
  p.coachNutrition.state = 'error'; p.coachNutrition.reload = () => { calls++ }
  const tree = CoachView(p), cost = fold(tree, 'kost')
  assert.equal(cost.props.open, true); assert.match(text(cost), /Kostdata kunne ikke hentes/)
  nodes(cost).find(n => n.type === 'button').props.onClick(); assert.equal(calls, 1)
  assert.doesNotMatch(text(report(p)), /Kostdage|Proteinmål/)
})

test('home audit: program folds require usable calendar and a nonempty roster', () => {
  for (const change of [p => { p.coachActionsStatus.calendar = 'loading' },
    p => { p.coachActionsStatus.calendar = 'error' }, p => { delete p.calendarWeeks[athleteId] },
    p => { p.calendarWeeks[athleteId][0].readEvidence = { complete: false } },
    p => { p.readContext.day = '2026-11-02' }, p => { p.readContext.coachId = 'foreign' },
    p => { p.hiddenAthleteIds = new Set([athleteId]) }]) {
    const p = productionFixture(); change(p); const tree = CoachView(p)
    assert.equal(fold(tree, 'programmer'), undefined)
    assert.equal(fold(tree, 'programslut'), undefined)
  }
})

test('home audit: undated planned week has one task via Program, never a program-ending row', () => {
  const p = productionFixture(); p.calendarWeeks[athleteId].push({ exercise_count: 1, start_date: null })
  const calls = [], context = model(p)
  assert.equal(fold(CoachView(p), 'programslut'), undefined)
  assert.equal(ProgramEndingView({ context }), null)
  const tree = CoachProgramsView({ context, openProfile: (...args) => calls.push(args) })
  assert.equal((text(tree).match(/Sæt dato på programugen/g) ?? []).length, 1)
  assert.doesNotMatch(text(tree), /ukendt|Planlagt til|tilbage/i)
  nodes(tree).find(n => n.type === 'button').props.onClick()
  assert.deepEqual(calls, [[p.athletes[0], 'program', 'list']])
})

test('home audit: dated program retains navigation, dates, urgency and competition, hides unknown week number', () => {
  const p = productionFixture(); p.athletes[0].competition_date = '2026-11-20'
  const tree = CoachProgramsView({ context: model(p) })
  assert.match(text(tree), /Planlagt til 08.11.2026/)
  assert.match(text(tree), /Under 1 uge/); assert.match(text(tree), /Næste stævne: 20.11.2026/)
  assert.doesNotMatch(text(tree), /Programuge|ukendt/)
  assert.equal(nodes(tree).find(n => n.type === 'button').props.disabled, true)
  p.calendarWeeks[athleteId] = []
  assert.match(text(CoachProgramsView({ context: model(p) })), /Opret program/)
})

test('home audit: no soon-ending programs leaves no ending fold', () => {
  const p = productionFixture(); p.calendarWeeks[athleteId][0].start_date = '2026-12-01'
  assert.equal(fold(CoachView(p), 'programslut'), undefined)
  assert.equal(ProgramEndingView({ context: model(p) }), null)
})

test('home audit: note selector has no duplicated instruction and retains honest empty/error/unknown states', () => {
  const p = productionFixture(), context = model(p)
  const empty = SessionNotesView({ model: { state: 'select', entries: [] }, athletes: p.athletes, onSelect() {} })
  assert.doesNotMatch(text(empty), /Vælg en atlet for|Ingen pasnoter|ukendt/)
  assert.match(text(fold(CoachView(p), 'noter')), /Vælg atlet/)
  let retries = 0
  const render = state => SessionNotesView({ model: { state, athlete: p.athletes[0], entries: [] },
    athletes: p.athletes, onSelect() {}, onRetry: () => { retries++ } })
  assert.match(text(render('loaded')), /Ingen pasnoter de seneste 7 dage/)
  for (const state of ['unknown', 'error']) {
    const tree = render(state); assert.doesNotMatch(text(tree), /Ingen pasnoter/)
    nodes(tree).find(n => n.type === 'button').props.onClick()
  }
  assert.equal(retries, 2)
  assert.equal(notesModel(p, context, athleteId, { athleteId: 'foreign', state: 'loaded', logs: [] }).state, 'loading')
})

test('home audit: OFF reads nothing, inbox has no new program/report mounts and inputs stay immutable', () => {
  for (const Component of [CoachScreen, CoachView]) assert.equal(Component({ enabled: false,
    get reloadOverview() { throw Error('OFF callback read') }, get athletes() { throw Error('OFF data read') } }), null)
  const p = productionFixture(), before = structuredClone({ ...p,
    openProfile: null, openCoachPriorityItem: null, setView: null, setSelectedAthlete: null })
  const inbox = CoachView({ ...p, tab: 'inbox' })
  assert.equal(nodes(inbox).some(n => [CoachProgramsView, WeeklyReport, ProgramEndingView].includes(n.type)), false)
  CoachView(p); report(p); CoachProgramsView({ context: model(p) })
  assert.deepEqual({ ...p, openProfile: null, openCoachPriorityItem: null, setView: null, setSelectedAthlete: null }, before)
})
