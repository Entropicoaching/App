import assert from 'node:assert/strict'
import { buildPlanOverview, planOverviewCounts } from '../src/planOverview.js'

const today = new Date('2026-08-24T12:00:00')
const athletes = [
  { id: 'none', name: 'Ingen plan' },
  { id: 'undated', name: 'Uden dato' },
  { id: 'gap', name: 'Stævnegab', competition_date: '2026-10-26' },
  { id: 'covered', name: 'Dækket' },
]
const calendarWeeks = {
  undated: [{ week_number: 1, start_date: null }],
  gap: [{ week_number: 1, start_date: '2026-08-24' }, { week_number: 2, start_date: '2026-08-31' }],
  covered: [{ week_number: 1, start_date: '2026-08-24' }, { week_number: 6, start_date: '2026-09-28' }],
}

const entries = buildPlanOverview({ athletes, calendarWeeks, today })
assert.deepEqual(entries.map(entry => entry.status), ['needs_plan', 'needs_dates', 'competition_gap', 'covered'])
assert.equal(entries.find(entry => entry.athlete.id === 'gap').suggested_focus, 'competition')
assert.equal(entries.find(entry => entry.athlete.id === 'covered').coverage_end, '2026-10-04')
assert.equal(planOverviewCounts(entries).covered, 1)
assert.equal(entries.every(entry => entry.sparring && entry.headline), true)

console.log('OK: planoversigten viser forklarbare beslutningspunkter uden at skrive data.')
