import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ATHLETE_ONBOARDING_GUIDE_STEPS as steps } from './athleteOnboardingGuide.js'

test('første dag fører til sætkortets felter, gem og pasoverblik', () => {
  const find = steps.find(step => step.key === 'find-session').body
  const log = steps.find(step => step.key === 'log-saet').body
  // Syntetiske etiketter og værdier for et eksisterende sætkort.
  const card = { fields: [{ label: 'kg', value: 62.5 }, { label: 'reps', value: 5 }], save: 'Godkendt', overview: 'Hele passet' }
  for (const field of card.fields) assert.ok(log.includes(field.label), field.label)
  assert.ok(log.includes('vægt') && log.includes('gentagelser'))
  assert.ok(log.includes('ret tallene') && log.includes('gemme'))
  assert.ok(log.includes('"' + card.save + '"'))
  assert.ok(find.includes('dagens næste sæt'))
  assert.ok(find.includes('"' + card.overview + '"'))
  assert.ok(find.includes('pasoverblik') && find.includes('øvelser og sæt'))
  assert.doesNotMatch(find, /markeret som "Næste"|folder det sig ud/)
})

test('guiden bevarer fire trin og RPE-hjælp uden ny pligt eller tidsløfte', () => {
  assert.deepEqual(steps.map(step => step.key), ['velkommen', 'parathed', 'find-session', 'log-saet'])
  const text = steps.map(step => [step.heading, step.body].join(' ')).join(' ')
  assert.doesNotMatch(text, /[–—]|minut|sekund|hurtigere|spar.*tid/i)
  const log = steps.find(step => step.key === 'log-saet').body
  assert.ok(log.includes('Du kan også vælge RPE.'))
  assert.ok(log.includes('hvor hårdt sættet føltes') && log.includes('spørg din coach'))
})
