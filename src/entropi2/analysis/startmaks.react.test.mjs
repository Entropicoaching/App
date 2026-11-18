// Ordre 1713: en ny atlet ser sine startmaks fra coachen i Udvikling i Entropi 2.
// Ægte React og ægte Analysis; atleterne er syntetiske.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import Analysis from './Analysis.mjs'
import { addCalendarDays } from '../../calendarDate.js'

const now = '2026-11-18T12:00:00Z'
const atletS = { id: 'synthetic-s', competition_date: null, squat: 140, bench: 92.5, deadlift: 170 }
const atletT = { id: 'synthetic-t', competition_date: null, squat: null, bench: 0, deadlift: null }
const squatLogs = Array.from({ length: 8 }, (_, i) => ({ exercise_id: `synthetic-${i}`,
  logged_at: addCalendarDays('2026-09-23', i * 7), weight: 120 + i, reps_completed: 3,
  exercises: { name: 'Squat', sessions: { weeks: { block_name: 'Styrke' } } } }))
const html = extra => renderToStaticMarkup(h(Analysis, { entropi2: true, now, fremgangLogs: [], exerciseLogs: [], ...extra }))
const count = (text, pattern) => (text.match(new RegExp(pattern, 'g')) ?? []).length

test('Atlet S uden logs ser startmaks fra coachen én gang, med tre løft og total', () => {
  const rendered = html({ athlete: atletS })
  assert.equal(count(rendered, 'data-analysis-startmaks'), 1)
  assert.equal(count(rendered, 'Dine startmaks fra din coach'), 1)
  assert.match(rendered, /Squat<\/span><strong>140 kg/)
  assert.match(rendered, /Bænkpres<\/span><strong>92,5 kg/)
  assert.match(rendered, /Dødløft<\/span><strong>170 kg/)
  assert.match(rendered, /Total<\/span><strong>402,5 kg/)
  assert.doesNotMatch(rendered, /<details[^>]*data-analysis-startmaks/)
  assert.ok(rendered.indexOf('Din udvikling') < rendered.indexOf('Dine startmaks fra din coach'))
})

test('Atlet T uden startmaks ser intet: ingen tal, ingen fold, intet ord', () => {
  for (const athlete of [atletT, { id: 'synthetic-t' }, { id: 'synthetic-t', squat: '', bench: -5, deadlift: 'x' }]) {
    const rendered = html({ athlete })
    assert.doesNotMatch(rendered, /data-analysis-startmaks|startmaks/i)
  }
})

test('kun løft over 0 vises, og total kræver alle tre', () => {
  const rendered = html({ athlete: { id: 'synthetic-s', squat: 140, bench: 0, deadlift: null } })
  assert.match(rendered, /Squat<\/span><strong>140 kg/)
  assert.doesNotMatch(rendered, /Bænkpres<\/span>|Dødløft<\/span>|Total<\/span>/)
})

test('med egne e1RM-tal står startmaks foldet som udgangspunkt, ikke som rekord', () => {
  const rendered = html({ athlete: atletS, fremgangLogs: squatLogs })
  assert.match(rendered, /Seneste e1RM/)
  assert.equal(count(rendered, 'Dine startmaks fra din coach'), 1)
  assert.match(rendered, /<details[^>]*data-analysis-startmaks/)
  assert.doesNotMatch(rendered, /<details[^>]*data-analysis-startmaks[^>]*open/)
  const startmaks = rendered.slice(rendered.indexOf('data-analysis-startmaks'))
  assert.match(startmaks, /udgangspunkt/)
  assert.doesNotMatch(startmaks.slice(0, startmaks.indexOf('</details>')), /rekord/i)
})

test('en anden atlets tal ses aldrig', () => {
  const other = { id: 'synthetic-other', squat: 300, bench: 200, deadlift: 333 }
  const rendered = html({ athlete: atletT, otherAthlete: other, athletes: [other] })
  assert.doesNotMatch(rendered, /300|333|startmaks/i)
  const own = html({ athlete: atletS, athletes: [other] })
  assert.doesNotMatch(own, /300 kg|333 kg|200 kg/)
})
