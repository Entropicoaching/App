import test from 'node:test'
import assert from 'node:assert/strict'
import CoachScreen, { CoachView } from './CoachScreen.mjs'
import Workspace, { CoachMessageDraft, CoachMessageDraftView } from './CoachAthleteWorkspace.mjs'
import AthleteCard from './atletkort/AthleteCard.mjs'
import WeekEvaluation from './evaluering/WeekEvaluationView.mjs'
import PlanGrundlagView from './planlaegning/PlanGrundlagView.mjs'
import BelastningOgTrend from '../tracking/visning/BelastningOgTrend.mjs'
import { coachHomeModel } from './coachModel.mjs'
import { coachAthleteWorkspace } from './coachWorkspaceModel.mjs'
import { syntheticWeek } from './evaluering/syntheticFixture.mjs'
import { fixture as blockFixture } from './planlaegning/syntheticFixture.mjs'

const today = '2026-11-03', id = 'synthetic-athlete'
const athlete = { id, name: 'Syntetisk atlet' }
function fixture() {
  const plan = blockFixture(); plan.blocks.through = today
  return { enabled: true, today, session: { user: { id: 'synthetic-coach' } },
    readContext: { coachId: 'synthetic-coach', day: today, athleteIds: [id] }, athletes: [athlete],
    coachNutrition: { coachId: 'synthetic-coach', day: today, athleteIds: [id], state: 'ready', complete: true,
      from: '2026-10-28', through: today, rows: [], targets: [] },
    coachActionsStatus: { activity: { day: today, state: 'ready', ids: [id], rows: [] } },
    coachMorningData: { messages: { day: today, state: 'ready', ids: [id], rows: [] } },
    coachAnalysis: { coachId: 'synthetic-coach', day: today, athleteIds: [id], state: 'ready',
      byAthlete: { [id]: { athleteId: id, day: today, state: 'ready', complete: true,
        evaluation: syntheticWeek(), plan, tracking: { version: 1, asOf: today,
          load: { state: 'ready', unit: 'kg × reps', days: [{ day: today, acute: 1000, chronic: 800 }] } },
        signalOutputs: [{ athleteId: id, source: 'belastning', signals: [{ key: 'load', subject: 'weekly',
          strength: 'obs', reason: 'Belastningen har ændret sig', dataBasis: { sufficient: true,
            sampleCount: 7, minimumSampleCount: 4, from: '2026-10-28', to: today, summary: '7 egne registreringer' } }] }] } } } }
}
const nodes = n => Array.isArray(n) ? n.flatMap(nodes) : !n || typeof n !== 'object' ? [] : [n, ...nodes(n.props?.children ?? n.children)]
const text = n => typeof n === 'string' ? n : Array.isArray(n) ? n.map(text).join(' ') : n && typeof n === 'object' ? text(n.props?.children ?? n.children) : ''
const data = p => coachAthleteWorkspace(p, coachHomeModel(p, today), athlete)
const entry = p => nodes(CoachView(p)).find(n => n.type === Workspace)
const workspace = p => { const n = entry(p); return n && n.type(n.props) }
const rendered = tree => nodes(tree).filter(n => [AthleteCard, WeekEvaluation, PlanGrundlagView, BelastningOgTrend].includes(n.type)).map(n => n.type(n.props))

test('screen connects one authorized card and all three closed athlete folds after attention', () => {
  const p = fixture(), tree = CoachView(p), all = nodes(tree), n = all.find(node => node.type === Workspace)
  assert.equal(all.filter(n => n.type === Workspace).length, 1)
  assert.ok(all.indexOf(all.find(n => n.props['aria-label'] === 'Atleter der kræver handling')) < all.indexOf(n))
  const parent = all.find(n => n.props['data-coach-fold'] === 'atleter')
  assert.notEqual(parent.props.open, true)
  const view = workspace(p), folds = nodes(view).filter(n => n.props['data-coach-athlete-fold'])
  assert.deepEqual(folds.map(n => n.props['data-coach-athlete-fold']), ['Ugeevaluering', 'Belastning og trend', 'Planlægningsgrundlag', 'Beskedudkast fra ugerapport'])
  folds.forEach(f => { assert.equal(f.type, 'details'); assert.notEqual(f.props.open, true); assert.ok(nodes(f).find(n => n.type === 'summary').props.style.minHeight >= 44) })
  assert.equal(rendered(view).length, 4)
  assert.match(text(view), /Belastningen har ændret sig/)
  assert.equal(nodes(view).some(n => n.props['data-coach-tracking-signal']), false)
  assert.ok(nodes(folds[3]).some(n => n.type === CoachMessageDraft))
  assert.equal(nodes(folds[0]).some(n => n.type === CoachMessageDraft), false)
})

test('actual evaluation, block and tracking imports render supplied synthetic facts', () => {
  const all = rendered(workspace(fixture())), joined = all.map(text).join(' ')
  assert.match(joined, /Pas gennemført/); assert.match(joined, /Smerte nævnt/)
  assert.match(joined, /Grundlag for næste blok/); assert.match(joined, /8 gennemført/)
  assert.match(joined, /Akut: 1\.000 kg × reps/)
  assert.ok(all.flatMap(nodes).some(n => n.type === 'svg'))
})

test('current list props alone give honest missing analysis, never fabricated trends or blocks', () => {
  const p = fixture(); delete p.coachAnalysis
  const view = workspace(p)
  assert.equal(rendered(view).length, 1, 'only the athlete card is mounted')
  assert.deepEqual(nodes(view).filter(n => n.props['data-coach-athlete-fold']).map(n => n.props['data-coach-athlete-fold']), ['Beskedudkast fra ugerapport'])
  assert.doesNotMatch(text(view), /Intet dokumenteret trackingsignal/)
  assert.equal(data(p).signals.length, 0); assert.equal(data(p).tracking, undefined)
})

test('error receipt suppresses snapshots and shows an explicit alert', () => {
  const p = fixture(); p.coachAnalysis.state = 'error'
  const view = workspace(p)
  assert.match(text(view), /kunne ikke hentes/)
  assert.equal(nodes(view).filter(n => n.props.role === 'alert').length, 1)
  assert.equal(data(p).tracking, undefined); assert.equal(data(p).signals.length, 0)
  assert.equal(nodes(view).filter(n => n.props['data-coach-athlete-fold'] && n.props['data-coach-athlete-fold'] !== 'Beskedudkast fra ugerapport').length, 0)
})

test('foreign owner/day/athlete, incomplete and stale snapshots do not reach analysis components', () => {
  for (const mutate of [p => { p.coachAnalysis.coachId = 'foreign' }, p => { p.coachAnalysis.day = '2026-11-02' },
    p => { p.coachAnalysis.athleteIds = ['foreign'] }, p => { p.coachAnalysis.byAthlete[id].athleteId = 'foreign' },
    p => { p.coachAnalysis.byAthlete[id].complete = false }, p => { p.coachAnalysis.byAthlete[id].day = '2026-11-02' }]) {
    const p = fixture(); mutate(p); const d = data(p)
    assert.equal(d.tracking, undefined); assert.equal(d.signals.length, 0); assert.equal(d.plan, undefined)
    assert.equal(d.evaluation, undefined)
  }
})

test('hidden, failed roster, foreign session, empty roster and inbox do not mount athlete workspaces', () => {
  for (const mutate of [p => { p.athletes[0] = { ...athlete, hidden: true } }, p => { p.loadError = true },
    p => { p.session.user.id = 'foreign' }, p => { p.athletes = [] }, p => { p.tab = 'inbox' }]) {
    const p = fixture(); mutate(p); assert.equal(entry(p), undefined)
  }
})

test('signals reject future/foreign candidates individually and retain supported evidence', () => {
  const p = fixture(), output = p.coachAnalysis.byAthlete[id].signalOutputs[0]
  output.signals.push({ ...output.signals[0], key: 'future', dataBasis: { ...output.signals[0].dataBasis, to: '2026-11-04' } })
  p.coachAnalysis.byAthlete[id].signalOutputs.push({ ...output, athleteId: 'foreign' })
  assert.equal(data(p).signals.length, 1)
  assert.match(text(workspace(p)), /7 egne registreringer/)
  p.coachAnalysis.byAthlete[id].signalOutputs = {}; assert.equal(data(p).signals.length, 0)
})

test('draft view edits, resets and closes locally without a hook dispatcher', () => {
  const suggestion = { text: 'Hej! Syntetisk udkast' }
  let draft = null
  const render = () => CoachMessageDraftView({ suggestion, draft, setDraft: value => { draft = value } })
  let tree = render()
  assert.equal(nodes(tree).filter(n => n.type === 'textarea').length, 0)
  nodes(tree).find(n => n.type === 'button').props.onClick()
  tree = render()
  assert.equal(nodes(tree).find(n => n.type === 'textarea').props.value, suggestion.text)
  nodes(tree).find(n => n.type === 'textarea').props.onChange({ target: { value: 'Egen syntetisk tekst' } })
  assert.equal(nodes(render()).find(n => n.type === 'textarea').props.value, 'Egen syntetisk tekst')
  assert.match(text(tree), /aktuelle programuge/); assert.match(text(tree), /Intet er sendt/)
  nodes(tree).find(n => n.type === 'button').props.onClick()
  assert.equal(draft, suggestion.text)
  nodes(tree).filter(n => n.type === 'button').at(-1).props.onClick()
  assert.equal(draft, null)
  assert.equal(nodes(render()).filter(n => n.type === 'textarea').length, 0)
  assert.equal(nodes(tree).some(n => n.props.onSubmit || n.props.dangerouslySetInnerHTML), false)
})

test('draft view disables unavailable suggestions; missing reports hide the fold; identity changes remount', () => {
  const view = CoachMessageDraftView({ suggestion: null, draft: null, setDraft: () => {} })
  assert.equal(nodes(view).find(n => n.type === 'button').props.disabled, true)
  const p = fixture(), before = entry(p).key ?? entry(p).props.key
  p.session.user.id = p.readContext.coachId = 'other-coach'
  assert.notEqual(entry(p).key ?? entry(p).props.key, before)
  p.today = p.readContext.day = '2026-11-04'
  assert.notEqual(entry(p).key ?? entry(p).props.key, before)
  const d = data(fixture()); d.report = { ready: false }
  assert.equal(nodes(Workspace({ data: d, athlete })).some(n => n.type === CoachMessageDraft), false)
})

test('assembly preserves inputs and OFF avoids rich data, clients and hooks', () => {
  const p = fixture(), before = structuredClone(p)
  CoachView(p); rendered(workspace(p)); assert.deepEqual(p, before)
  const off = { get coachAnalysis() { throw Error('OFF read') }, get notesClient() { throw Error('OFF client') } }
  assert.equal(CoachScreen(off), null); assert.equal(CoachView(off), null)
})

test('partial snapshots mount only their available analysis section; no duplicate signal line', () => {
  for (const [field, label, component] of [['evaluation', 'Ugeevaluering', WeekEvaluation],
    ['tracking', 'Belastning og trend', BelastningOgTrend], ['plan', 'Planlægningsgrundlag', PlanGrundlagView]]) {
    const p = fixture(), snapshot = p.coachAnalysis.byAthlete[id], selected = snapshot[field]
    for (const key of ['evaluation', 'tracking', 'plan', 'signalOutputs']) delete snapshot[key]
    snapshot[field] = selected
    const view = workspace(p), folds = nodes(view).filter(n => n.props['data-coach-athlete-fold'])
    assert.deepEqual(folds.map(n => n.props['data-coach-athlete-fold']), [label, 'Beskedudkast fra ugerapport'])
    assert.equal(nodes(view).filter(n => n.type === component).length, 1)
    assert.doesNotMatch(text(view), /Intet dokumenteret trackingsignal/)
  }
  const p = fixture(); delete p.coachAnalysis.byAthlete[id].tracking
  const view = workspace(p)
  assert.match(text(view), /Belastningen har ændret sig/)
  assert.equal(nodes(view).some(n => n.type === BelastningOgTrend), false)
})
