import test from 'node:test'
import assert from 'node:assert/strict'

import { candidateTemplates, explainTemplateSelection, selectTemplate, TEMPLATE_MATCHER_VERSION, validateTemplateInput } from '../templateMatcher.js'

const base = { goal: 'general-strength', level: 'oevet', equipment: 'gym' }

test('matcheren vælger entydigt den template der passer til antal dage', () => {
  for (const daysPerWeek of [2, 3, 4]) {
    const result = selectTemplate({ ...base, daysPerWeek })
    assert.equal(result.outcome, 'matched')
    assert.equal(result.templateId, `general-strength-${daysPerWeek}`)
    assert.equal(result.matcherVersion, TEMPLATE_MATCHER_VERSION)
  }
})

test('samme input giver samme valg og et sporbar inputspor', () => {
  const input = { ...base, goal: 'powerlifting-foundation', daysPerWeek: 3, squatStyle: 'high-bar', deadliftStyle: 'conventional' }
  assert.deepEqual(selectTemplate(input), selectTemplate(input))
  assert.deepEqual(selectTemplate(input).matchInput, input)
  assert.ok(explainTemplateSelection(input).includes('3 træningsdage'))
})

test('de to mål får forskellige rammer, selv med samme træningsdage', () => {
  const general = selectTemplate({ ...base, daysPerWeek: 2 })
  const powerlifting = selectTemplate({ ...base, goal: 'powerlifting-foundation', daysPerWeek: 2, squatStyle: 'high-bar', deadliftStyle: 'conventional' })
  assert.notEqual(general.templateId, powerlifting.templateId)
})

test('home matcher sin egen template, mens ukendt miljø eller frekvens fejler lukket', () => {
  const home = { ...base, daysPerWeek: 3, equipment: 'home' }
  assert.equal(candidateTemplates(home).length, 1)
  assert.equal(selectTemplate(home).templateId, 'general-strength-3-home')
  assert.equal(selectTemplate({ ...base, daysPerWeek: 3, equipment: 'basic-gym' }).outcome, 'manual-review')
  assert.equal(selectTemplate({ ...base, daysPerWeek: 5 }).outcome, 'manual-review')
})

test('begge niveauer kan matches sikkert til 2, 3 og 4 dage i begge miljøer', () => {
  for (const level of ['begynder', 'oevet']) {
    for (const daysPerWeek of [2, 3, 4]) {
      for (const equipment of ['gym', 'home']) {
        const result = selectTemplate({ ...base, level, daysPerWeek, equipment })
        assert.equal(result.outcome, 'matched', `${level}/${daysPerWeek}/${equipment}`)
      }
    }
  }
})

test('ukendt variant afvises eksplicit i stedet for at falde tilbage til standardløft', () => {
  const input = { ...base, daysPerWeek: 2, squatStyle: 'high-bar', deadliftStyle: 'legacy-sumo' }
  assert.equal(validateTemplateInput(input).valid, false)
  assert.equal(selectTemplate(input).reason, 'ugyldig-variant')
})

test('manglende setup-input fejler lukket uden at crashe member-onboarding', () => {
  const validation = validateTemplateInput(null)
  assert.equal(validation.valid, false)
  assert.equal(validation.input.goal, '')
  assert.equal(validation.reason, 'ugyldigt-grundinput')
  assert.equal(selectTemplate(null).outcome, 'manual-review')
})
