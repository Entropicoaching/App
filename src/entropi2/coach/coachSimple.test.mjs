import test from 'node:test'
import assert from 'node:assert/strict'
import CoachAthleteWorkspace from './CoachAthleteWorkspace.mjs'
import WeeklyReport from './WeeklyReport.mjs'
import { CoachView } from './CoachScreen.mjs'

// Marc 3. nov.: "lidt mere keep it simple paa front skaermen". Kun det vigtigste staar aabent.
const today = '2026-11-03'
const days = ['2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01']
const props = tab => ({ enabled: true, tab, today: new Date(`${today}T10:00:00Z`),
  session: { user: { id: 'owner-1' } }, readContext: { coachId: 'owner-1', day: today, athleteIds: ['athlete-1'] },
  athletes: [{ id: 'athlete-1', name: 'Syntetisk atlet' }], loading: false, loadError: false,
  coachNutrition: { coachId: 'owner-1', day: today, athleteIds: ['athlete-1'], from: '2026-10-28', through: today,
    state: 'ready', complete: true, rows: days.map((date, i) => ({ id: `m-${i}`, athlete_id: 'athlete-1', date,
      meal: 'Syntetisk måltid', kcal: 2000, protein: 100 })), targets: [] } })
const nodes = n => Array.isArray(n) ? n.flatMap(nodes) :
  !n || typeof n !== 'object' ? [] : [n, ...nodes(n.props?.children ?? n.children)]
const label = n => n.props?.['aria-label']

test('coach home: attention comes first; only useful confirmed folds are mounted', () => {
  const all = nodes(CoachView(props('home')))
  const order = all.map(label).filter(Boolean)
  assert.ok(order.indexOf('Atleter der kræver handling') < order.indexOf('Kostoverblik'))
  const folds = all.filter(n => n.type === 'details').map(n => n.props['data-coach-fold'])
  // E2-KOBL-COACH1: atletliste og ugerapport er nye lukkede folde.
  // Runde 3: passenes noter (E2-COACH-PASNOTER1) er også foldet ind under det vigtigste.
  // Audit 1: no calendar receipt means no empty program folds.
  // Existing validated nutrition days make the team fold useful here.
  // U11 (Marc 11. nov.: "stadig lidt rodet"): foldene ligger nu i to lukkede grupper, Holdet og
  // Programmer og noter. Atletkortene flytter ned, fordi den åbne atletliste står over grupperne.
  assert.deepEqual(folds, [undefined, 'hold', 'ugerapport', 'kost', undefined, 'noter', 'atleter'])
  assert.deepEqual(all.filter(n => n.type === 'details').map(n => n.props['data-u11-gruppe']).filter(Boolean), ['hold', 'programmer'])
  for (const d of all.filter(n => n.type === 'details')) assert.notEqual(d.props.open, true)
  assert.ok(all.some(n => n.props?.['data-coach-nutrition'] === 'athlete-1'), 'kost line still rendered inside the fold')
})

test('coach inbox: "Venter på dig" open, "Alle samtaler" folded', () => {
  const all = nodes(CoachView(props('inbox')))
  assert.ok(all.some(n => label(n) === 'Ulæste beskeder og indsendelser' && n.type === 'section'))
  const folds = all.filter(n => n.type === 'details').map(n => n.props['data-coach-fold'])
  assert.deepEqual(folds, ['samtaler'])
})


test('new content stays inside native closed folds after the open attention section', () => {
  const view = CoachView(props('home')), all = nodes(view)
  const attention = all.find(n => label(n) === 'Atleter der kræver handling')
  const athletes = all.find(n => n.props?.['data-coach-fold'] === 'atleter')
  const weekly = all.find(n => n.props?.['data-coach-fold'] === 'ugerapport')
  assert.equal(attention.type, 'section')
  for (const fold of [athletes, weekly]) {
    assert.equal(fold.type, 'details'); assert.notEqual(fold.props.open, true)
    const summary = nodes(fold).find(n => n.type === 'summary')
    assert.ok(summary.props.style.minHeight >= 44)
    assert.ok(all.indexOf(attention) < all.indexOf(fold))
  }
  assert.equal(nodes(athletes).filter(n => n.type === CoachAthleteWorkspace).length, 1)
  const report = nodes(weekly).find(n => n.type === WeeklyReport)
  assert.ok(report)
  assert.equal(nodes(report.type(report.props)).filter(n => n.props?.['data-coach-weekly-report']).length, 1)
})
