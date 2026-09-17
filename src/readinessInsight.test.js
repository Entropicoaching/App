import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  compareReadiness, readinessComparisonText, readinessTrainingNote,
  summarizeReadinessForCoach, lastCheckinDrivenChange,
} from './readinessInsight.js'

test('færre end fem logs → insufficient, uanset dagens score', () => {
  const r = compareReadiness(80, [70, 72, 68, 71])
  assert.equal(r.status, 'insufficient')
  assert.equal(r.mean, null)
  assert.equal(r.sd, null)
})

test('ingen logs overhovedet → insufficient', () => {
  assert.equal(compareReadiness(80, []).status, 'insufficient')
})

test('præcis fem logs → nok til en sammenligning (ikke længere insufficient)', () => {
  const history = [70, 72, 68, 71, 69] // snit 70
  const r = compareReadiness(70, history)
  assert.notEqual(r.status, 'insufficient')
  assert.equal(r.status, 'normal')
})

test('meget stabil score (lille spredning) → selv en lille afvigelse slår ud som under/over', () => {
  // sd ≈ 0,7 → tærskel ≈ 0,35. En atlet der plejer at ligge helt fast på ~70
  // skal reagere på en lille dyk, ikke kun store udsving.
  const history = [70, 71, 69, 70, 70, 70, 69]
  const stableMean = history.reduce((a, b) => a + b, 0) / history.length
  const under = compareReadiness(Math.round(stableMean) - 2, history)
  assert.equal(under.status, 'under')
  const normal = compareReadiness(Math.round(stableMean), history)
  assert.equal(normal.status, 'normal')
})

test('stor spredning i historikken → samme absolutte afvigelse forbliver "som du plejer"', () => {
  // sd er stor her (score svinger meget dag til dag) → tærsklen bliver bred,
  // så en atlet der i forvejen svinger meget ikke fejlagtigt får "under" af
  // en dag der blot ligner de andre svingninger.
  const history = [40, 90, 55, 80, 45, 85, 60]
  const mean = history.reduce((a, b) => a + b, 0) / history.length
  const r = compareReadiness(Math.round(mean) - 5, history)
  assert.equal(r.status, 'normal')
})

test('dagens score som tydelig outlier → over eller under, selv med spredning', () => {
  const history = [40, 90, 55, 80, 45, 85, 60]
  const veryLow = compareReadiness(1, history)
  assert.equal(veryLow.status, 'under')
  const veryHigh = compareReadiness(150, history)
  assert.equal(veryHigh.status, 'over')
})

test('ingen spredning i historikken (identiske score) → falder tilbage til fast 3-points tærskel', () => {
  const history = [70, 70, 70, 70, 70]
  assert.equal(compareReadiness(72, history).status, 'normal') // diff 2 < 3
  assert.equal(compareReadiness(73, history).status, 'over')   // diff 3 >= 3
  assert.equal(compareReadiness(67, history).status, 'under')  // diff -3 <= -3
})

test('grænsetilfælde: diff præcis på tærsklen tæller som under/over, ikke normal', () => {
  const history = [60, 60, 60, 60, 60, 80, 80] // sd > 0, tærskel = 0,5*sd
  const mean = history.reduce((a, b) => a + b, 0) / history.length
  const variance = history.reduce((s, v) => s + (v - mean) ** 2, 0) / history.length
  const sd = Math.sqrt(variance)
  const threshold = sd * 0.5
  const r = compareReadiness(mean + threshold, history)
  assert.equal(r.status, 'over')
})

test('teksterne matcher tonen fra ordreteksten', () => {
  assert.equal(readinessComparisonText('under'), 'Lidt under dit normale niveau de sidste to uger.')
  assert.equal(readinessComparisonText('normal'), 'Som du plejer.')
  assert.equal(readinessComparisonText('over'), 'Over dit normale.')
  assert.equal(readinessComparisonText('insufficient'), 'Log nogle flere dage, så begynder appen at kunne sammenligne.')
})

test('træningsnoten er ikke-medicinsk og ændrer aldrig programmet — insufficient har ingen', () => {
  assert.equal(typeof readinessTrainingNote('under'), 'string')
  assert.equal(typeof readinessTrainingNote('normal'), 'string')
  assert.equal(typeof readinessTrainingNote('over'), 'string')
  assert.equal(readinessTrainingNote('insufficient'), null)
  for (const status of ['under', 'normal', 'over']) {
    const note = readinessTrainingNote(status).toLowerCase()
    assert.ok(!note.includes('læge') && !note.includes('medicin'), `note for ${status} skal ikke give medicinsk råd`)
  }
})

// ORDRE 267 · commit 2 — summarizeReadinessForCoach

test('summarizeReadinessForCoach: ingen entries → null', () => {
  assert.equal(summarizeReadinessForCoach([]), null)
  assert.equal(summarizeReadinessForCoach(null), null)
})

test('summarizeReadinessForCoach: tæller logs, gns. søvn og hyppigste ømme zone', () => {
  const entries = [
    { logged_date: '2026-09-10', readiness_score: 80, sleep_hours: 8, sore_zones: ['Ben'] },
    { logged_date: '2026-09-11', readiness_score: 75, sleep_hours: 7, sore_zones: ['Ben', 'Ryg'] },
    { logged_date: '2026-09-12', readiness_score: 70, sleep_hours: null, sore_zones: null },
  ]
  const r = summarizeReadinessForCoach(entries)
  assert.equal(r.logsCount, 3)
  assert.equal(r.avgSleep, 7.5)
  assert.deepEqual(r.topZone, ['Ben', 2])
  assert.equal(r.lowStreak, 0)
})

test('summarizeReadinessForCoach: lowStreak tæller kun fra det nyeste, stopper ved første score >= 50', () => {
  const entries = [
    { logged_date: '2026-09-10', readiness_score: 80 },
    { logged_date: '2026-09-11', readiness_score: 40 },
    { logged_date: '2026-09-12', readiness_score: 35 },
    { logged_date: '2026-09-13', readiness_score: 45 },
  ]
  assert.equal(summarizeReadinessForCoach(entries).lowStreak, 3)
})

test('summarizeReadinessForCoach: ingen søvn-data → avgSleep null, ingen zoner → topZone null', () => {
  const entries = [{ logged_date: '2026-09-10', readiness_score: 80, sleep_hours: null, sore_zones: [] }]
  const r = summarizeReadinessForCoach(entries)
  assert.equal(r.avgSleep, null)
  assert.equal(r.topZone, null)
})

// ORDRE 267 · commit 2 — lastCheckinDrivenChange

test('lastCheckinDrivenChange: lav score efterfulgt af en note-uge inden for vinduet → match', () => {
  const readiness = [{ logged_date: '2026-09-01', readiness_score: 40 }]
  const weeks = [{ start_date: '2026-09-06', coach_note: 'Skruet ned for volumen denne uge.' }]
  const r = lastCheckinDrivenChange(readiness, weeks)
  assert.ok(r)
  assert.equal(r.checkinDate, '2026-09-01')
  assert.equal(r.weekStartDate, '2026-09-06')
  assert.equal(r.note, 'Skruet ned for volumen denne uge.')
})

test('lastCheckinDrivenChange: uge uden for vinduet (> 9 dage senere) → ingen match', () => {
  const readiness = [{ logged_date: '2026-09-01', readiness_score: 40 }]
  const weeks = [{ start_date: '2026-09-15', coach_note: 'En senere note, ikke relateret.' }]
  assert.equal(lastCheckinDrivenChange(readiness, weeks), null)
})

test('lastCheckinDrivenChange: uge uden coach_note tæller ikke som en ændring', () => {
  const readiness = [{ logged_date: '2026-09-01', readiness_score: 40 }]
  const weeks = [{ start_date: '2026-09-04', coach_note: null }]
  assert.equal(lastCheckinDrivenChange(readiness, weeks), null)
})

test('lastCheckinDrivenChange: score over 50 udløser aldrig en match', () => {
  const readiness = [{ logged_date: '2026-09-01', readiness_score: 60 }]
  const weeks = [{ start_date: '2026-09-04', coach_note: 'Note.' }]
  assert.equal(lastCheckinDrivenChange(readiness, weeks), null)
})

test('lastCheckinDrivenChange: vælger den NYESTE lave score der har en match, ikke bare den første i arrayet', () => {
  const readiness = [
    { logged_date: '2026-09-01', readiness_score: 30 }, // ingen matchende uge
    { logged_date: '2026-09-10', readiness_score: 45 }, // matcher
  ]
  const weeks = [{ start_date: '2026-09-14', coach_note: 'Note efter den seneste lave score.' }]
  const r = lastCheckinDrivenChange(readiness, weeks)
  assert.equal(r.checkinDate, '2026-09-10')
})

test('lastCheckinDrivenChange: ingen lave scores overhovedet → null', () => {
  const readiness = [{ logged_date: '2026-09-01', readiness_score: 90 }]
  assert.equal(lastCheckinDrivenChange(readiness, [{ start_date: '2026-09-04', coach_note: 'Note.' }]), null)
})
