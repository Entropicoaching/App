import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mergeAthleteSetInputs, nextAthleteSetInput } from './athleteTrainingInputs.js'

// Epley — samme formel som e1RM-grafen og Coach Briefing bruger
// (src/AthleteView.jsx og src/Dashboard.jsx). Duplikeret her bevidst: de er
// begge inline i store komponentfiler og ikke selv eksporteret, men formlen
// er triviel og stabil — testen skal bevise at ACTUAL reps driver e1RM, ikke
// selve formlens korrekthed (den er urørt af denne ordre).
const epley = (weight, reps) => weight * (1 + reps / 30)

test('reps gemmes pr. sæt: to sæt af samme øvelse kan have forskellige reps', () => {
  const rows = [
    { exercise_id: 'ex1', set_number: 1, weight: 100, reps_completed: 4 },
    { exercise_id: 'ex1', set_number: 2, weight: 100, reps_completed: 6 },
  ]
  const merged = mergeAthleteSetInputs({}, rows)
  assert.equal(merged.ex1_1.reps, '4')
  assert.equal(merged.ex1_2.reps, '6')
})

test('reps carries IKKE over til næste sæt — hvert nyt sæt starter uden forrige indtastning', () => {
  const current = { weight: '100', reps: '5' }
  const next = nextAthleteSetInput(current, {})
  // Vægt må gerne foreslås videre (uændret adfærd), reps skal IKKE.
  assert.equal(next.weight, '100')
  assert.equal(next.reps, '')
})

test('en allerede logget række med afvigende reps vinder over det atleten står og skriver', () => {
  const previous = { ex1_1: { weight: '100', reps: '5' } }
  const rows = [{ exercise_id: 'ex1', set_number: 1, weight: 100, reps_completed: 6 }]
  const merged = mergeAthleteSetInputs(previous, rows)
  assert.equal(merged.ex1_1.reps, '6')
})

test('e1RM regnes af de faktiske reps pr. sæt, ikke af ordinationens nederste tal', () => {
  // Ordineret "4-6" — atleten formåede rent faktisk 6 i sæt 2.
  const rows = [
    { exercise_id: 'ex1', set_number: 1, weight: 100, reps_completed: 4 },
    { exercise_id: 'ex1', set_number: 2, weight: 100, reps_completed: 6 },
  ]
  const merged = mergeAthleteSetInputs({}, rows)
  const e1rmSæt1 = epley(100, Number(merged.ex1_1.reps))
  const e1rmSæt2 = epley(100, Number(merged.ex1_2.reps))
  // Samme vægt, flere faktiske reps i sæt 2 → højere e1RM. Havde begge sæt
  // fejlagtigt logget ordinationens nederste tal (4), ville de to være ens.
  assert.ok(e1rmSæt2 > e1rmSæt1)
  assert.equal(e1rmSæt1, epley(100, 4))
  assert.equal(e1rmSæt2, epley(100, 6))
})
