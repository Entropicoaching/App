import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { rpeSignalDescription } from './dataEvidence.mjs'
import { videoCoachMeasurementText } from './dashboard/coachVideoHjaelp.js'

// u8c (ordre 87): synlige decimaltal står med dansk komma. Kun syntetiske data.
test('u8c: RPE-afvigelsen står med dansk komma', () => {
  const rows = [{ rpe_actual: 9, rpe_planned: 8, reps_completed: 5, logged_at: '2026-11-10', session_id: 's1', name: 'Squat', rpe_source: 'athlete' },
    { rpe_actual: 8.5, rpe_planned: 8, reps_completed: 5, logged_at: '2026-11-09', session_id: 's2', name: 'Squat', rpe_source: 'athlete' }]
  const text = rpeSignalDescription({ rows, today: '2026-11-11' })
  assert.match(text, /afvigelse 0,75 fra planen/)
})

test('u8c: videohjælpens målinger står med dansk komma', () => {
  assert.equal(videoCoachMeasurementText({ repsCount: 3, driftCm: 2.4, avgTimeS: 1.25, pathPreview: null }), '3 reps · Ø 2,4 cm sidelæns · Ø 1,3s/rep')
})

test('u8c: vægtgrafens akser på hjemmesiden står med dansk komma', () => {
  for (const file of ['athlete/HjemTab.jsx', 'athlete/EnkelHjemTab.jsx']) {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8')
    assert.ok(!/\.\.\.ws\)\.toFixed\(1\)\}<\/text>/.test(source), file)
  }
})

test('u8c: coachens planvægt vises med dansk komma overalt i passet', async () => {
  const { planKg } = await import('./planKg.mjs')
  assert.equal(planKg(87.5), '87,5')
  assert.equal(planKg('142.5'), '142,5')
  assert.equal(planKg(80), '80')
  assert.equal(planKg('~85'), '~85')
  for (const file of ['entropi2/session/sessionView.mjs', 'entropi2/session/sessionOverview.mjs', 'athlete/DagensPasCard.jsx', 'athlete/blokRoedTraad.mjs']) {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8')
    assert.ok(!/\{ex\.recommended_weight\} kg/.test(source), file)
  }
})
