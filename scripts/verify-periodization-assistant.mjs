import assert from 'node:assert/strict'
import { buildPeriodizationSuggestion, fullWeeksUntil } from '../src/periodizationAssistant.js'

assert.equal(fullWeeksUntil({ startDate: '2026-08-24', competitionDate: '2026-11-01' }), 9)
assert.equal(fullWeeksUntil({ startDate: '2026-08-24', competitionDate: '2026-08-24' }), null)

const competition = buildPeriodizationSuggestion({
  focus: 'competition', startDate: '2026-08-24', competitionDate: '2026-11-01',
})
assert.equal(competition.ok, true)
assert.equal(competition.blocks.reduce((sum, current) => sum + current.weeks, 0), 9,
  'stævneforslaget skal passe til de hele uger, der er til rådighed')
assert.equal(competition.blocks.at(-1).name, 'Peak')
assert.equal(competition.blocks.every(item => item.description), true)

const strength = buildPeriodizationSuggestion({ focus: 'strength', startDate: '2026-08-24' })
assert.equal(strength.ok, true)
assert.deepEqual(strength.blocks.map(item => item.name), ['Hypertrofi', 'Styrke', 'Deload'])

assert.equal(buildPeriodizationSuggestion({ focus: 'competition', startDate: '2026-08-24' }).ok, false,
  'stævneplanen må ikke opfinde en deadline uden stævnedato')

console.log('OK: planassistenten laver kun gennemsigtige, redigerbare blokudkast.')
