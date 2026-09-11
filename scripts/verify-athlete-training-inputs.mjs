import assert from 'node:assert/strict'
import { mergeAthleteSetInputs, nextAthleteSetInput } from '../src/athleteTrainingInputs.js'

assert.deepEqual(
  mergeAthleteSetInputs({}, []),
  {},
  'et nyt træningspas må ikke forudfylde anbefalet vægt',
)

assert.deepEqual(
  mergeAthleteSetInputs({ 'exercise-a_1': { weight: '122.5', note: '', rpe: '' } }, []),
  { 'exercise-a_1': { weight: '122.5', note: '', rpe: '' } },
  'en vægt, som atleten selv har tastet, skal overleve en dataopdatering',
)

assert.deepEqual(
  mergeAthleteSetInputs(
    { 'exercise-a_1': { weight: '122.5', note: '', rpe: '' } },
    [{ exercise_id: 'exercise-a', set_number: 1, weight: 125, note: 'Godt sæt', rpe_actual: 8, reps_completed: 5 }],
  ),
  { 'exercise-a_1': { weight: '125', note: 'Godt sæt', rpe: '8', reps: '5' } },
  'en bekræftet log (inkl. faktiske reps, ordre 106) skal vinde over lokal input-state',
)

assert.deepEqual(
  nextAthleteSetInput({ weight: '125', note: 'første', rpe: '8', reps: '6' }, {}),
  { weight: '125', note: '', rpe: '', reps: '' },
  'første indtastede vægt skal videreføres til næste sæt efter logning, reps skal IKKE (ordre 106 — næste sæt starter ved ordinationens nederste tal)',
)

assert.deepEqual(
  nextAthleteSetInput(
    { weight: '125', note: '', rpe: '' },
    { weight: '127.5', note: 'planlagt stigning', rpe: '8.5' },
  ),
  { weight: '127.5', note: 'planlagt stigning', rpe: '8.5', reps: '' },
  'et næste sæt, som atleten allerede har redigeret, må ikke overskrives',
)

assert.deepEqual(
  nextAthleteSetInput({ weight: '', note: '', rpe: '' }, {}),
  { weight: '', note: '', rpe: '', reps: '' },
  'en tom første vægt må ikke skabe en kunstig værdi i næste sæt',
)

console.log('Atletens første vægt starter tomt, og den indtastede vægt videreføres først efter logning. Reps (ordre 106) gemmes pr. sæt og carries aldrig over til næste.')
