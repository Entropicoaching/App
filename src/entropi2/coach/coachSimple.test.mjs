import test from 'node:test'
import assert from 'node:assert/strict'
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

test('coach home: "Kræver dit blik" comes first; kost and programmes are folded, nothing removed', () => {
  const all = nodes(CoachView(props('home')))
  const order = all.map(label).filter(Boolean)
  assert.ok(order.indexOf('Atleter der kræver handling') < order.indexOf('Kostoverblik'))
  const folds = all.filter(n => n.type === 'details').map(n => n.props['data-coach-fold'])
  // Runde 3: passenes noter (E2-COACH-PASNOTER1) er også foldet ind under det vigtigste.
  // E2-COACH-PROGRAMSLUT1: programmer der slutter er sin egen fold (bevidst tilføjelse).
  assert.deepEqual(folds, ['kost', 'noter', 'programslut', 'programmer'])
  for (const d of all.filter(n => n.type === 'details')) assert.notEqual(d.props.open, true)
  assert.ok(all.some(n => n.props?.['data-coach-nutrition'] === 'athlete-1'), 'kost line still rendered inside the fold')
})

test('coach inbox: "Venter på dig" open, "Alle samtaler" folded', () => {
  const all = nodes(CoachView(props('inbox')))
  assert.ok(all.some(n => label(n) === 'Ulæste beskeder og indsendelser' && n.type === 'section'))
  const folds = all.filter(n => n.type === 'details').map(n => n.props['data-coach-fold'])
  assert.deepEqual(folds, ['samtaler'])
})
