import test from 'node:test'
import assert from 'node:assert/strict'

import { resolveProgramDraft } from '../programResolver.js'

test('resolveren skaber et deterministisk reviewudkast med reviewbare recepter', () => {
  const input = { goal: 'general-strength', level: 'oevet', daysPerWeek: 2, equipment: 'gym', squatStyle: 'high-bar', deadliftStyle: 'conventional' }
  const first = resolveProgramDraft(input)
  const second = resolveProgramDraft(input)
  assert.deepEqual(first, second)
  assert.equal(first.outcome, 'review-ready')
  assert.equal(first.program.days, 2)
  assert.equal(first.program.sessions.length, 2)
  assert.equal(first.program.sessions.flatMap(session => session.movements).length, 8)
  assert.ok(first.program.missingBeforeAssignment.includes('marc-program-version-approval'))
  assert.equal(first.program.sessions[0].movements[0].prescription.status, 'review')
  assert.equal(JSON.stringify(first.program).toLowerCase().includes('weight'), false)
})

test('resolveren afviser uklart input i stedet for at opfinde et program', () => {
  const result = resolveProgramDraft({ goal: 'general-strength', level: 'oevet', daysPerWeek: 2, equipment: 'basic-gym', squatStyle: 'high-bar', deadliftStyle: 'conventional' })
  assert.equal(result.outcome, 'manual-review')
  assert.equal(result.reason, 'ugyldigt-grundinput')
})

test('atletens eksplicitte squat- og dødløftvalg bestemmer hovedløftene', () => {
  const result = resolveProgramDraft({ goal: 'powerlifting-foundation', level: 'oevet', daysPerWeek: 2, equipment: 'gym', squatStyle: 'low-bar', deadliftStyle: 'sumo' })
  const movements = result.program.sessions.flatMap(session => session.movements)
  assert.equal(movements.find(item => item.role === 'squat-pattern').exerciseId, 'low-bar-squat')
  assert.equal(movements.find(item => item.role === 'hinge-pattern').exerciseId, 'sumo-deadlift')
  assert.equal(movements.find(item => item.role === 'squat-pattern').selection, 'athlete-style-preference')
  assert.equal(result.policyLane.id, 'powerlifting-foundation-v1')
})

test('generel styrke kan bruge canonical ramme uden konkurrencestil', () => {
  const result = resolveProgramDraft({ goal: 'general-strength', level: 'oevet', daysPerWeek: 2, equipment: 'gym' })
  assert.equal(result.outcome, 'review-ready')
  assert.equal(result.policyLane.id, 'general-strength-v1')
  assert.equal(result.program.sessions[0].movements.find(item => item.role === 'squat-pattern').exerciseId, 'high-bar-squat')
})

test('generel styrke respekterer et eksplicit variantvalg, men behøver det ikke', () => {
  const result = resolveProgramDraft({ goal: 'general-strength', level: 'oevet', daysPerWeek: 2, equipment: 'gym', squatStyle: 'low-bar', deadliftStyle: 'sumo' })
  const movements = result.program.sessions.flatMap(session => session.movements)
  assert.equal(movements.find(item => item.role === 'squat-pattern').exerciseId, 'low-bar-squat')
  assert.equal(movements.find(item => item.role === 'hinge-pattern').exerciseId, 'sumo-deadlift')
})

test('generel styrke anvender squat- og dødløftvalg uafhængigt', () => {
  const onlyDeadlift = resolveProgramDraft({ goal: 'general-strength', level: 'oevet', daysPerWeek: 2, equipment: 'gym', squatStyle: '', deadliftStyle: 'sumo' })
  const deadliftMovements = onlyDeadlift.program.sessions.flatMap(session => session.movements)
  assert.equal(deadliftMovements.find(item => item.role === 'squat-pattern').exerciseId, 'high-bar-squat')
  assert.equal(deadliftMovements.find(item => item.role === 'hinge-pattern').exerciseId, 'sumo-deadlift')
  assert.equal(deadliftMovements.find(item => item.role === 'hinge-pattern').stylePreference, 'sumo')

  const onlySquat = resolveProgramDraft({ goal: 'general-strength', level: 'oevet', daysPerWeek: 2, equipment: 'home', squatStyle: 'low-bar', deadliftStyle: '' })
  const squatMovements = onlySquat.program.sessions.flatMap(session => session.movements)
  assert.equal(squatMovements.find(item => item.role === 'squat-pattern').exerciseId, 'home-box-squat')
  assert.equal(squatMovements.find(item => item.role === 'hinge-pattern').exerciseId, 'home-dumbbell-deadlift')
  assert.equal(squatMovements.find(item => item.role === 'squat-pattern').stylePreference, 'low-bar')
})

test('ukendt variant resulterer i manuel vurdering og aldrig et standardløft', () => {
  const result = resolveProgramDraft({ goal: 'powerlifting-foundation', level: 'oevet', daysPerWeek: 2, equipment: 'gym', squatStyle: 'high-bar', deadliftStyle: 'legacy-sumo' })
  assert.equal(result.outcome, 'manual-review')
  assert.equal(result.reason, 'ugyldig-variant')
})

test('alle gyldige mål- og variantkombinationer viser de valgte hovedløft', () => {
  const squatStyles = { 'high-bar': 'high-bar-squat', 'low-bar': 'low-bar-squat' }
  const deadliftStyles = { conventional: 'conventional-deadlift', sumo: 'sumo-deadlift' }
  for (const goal of ['general-strength', 'powerlifting-foundation']) {
    for (const [squatStyle, squatId] of Object.entries(squatStyles)) {
      for (const [deadliftStyle, deadliftId] of Object.entries(deadliftStyles)) {
        const result = resolveProgramDraft({ goal, level: 'oevet', daysPerWeek: 2, equipment: 'gym', squatStyle, deadliftStyle })
        const movements = result.program.sessions.flatMap(session => session.movements)
        assert.equal(result.outcome, 'review-ready')
        assert.equal(movements.find(item => item.role === 'squat-pattern').exerciseId, squatId)
        assert.equal(movements.find(item => item.role === 'hinge-pattern').exerciseId, deadliftId)
      }
    }
  }
})

test('styrkeløftfundament med ukendt variant blokeres synligt før programudkast', () => {
  const result = resolveProgramDraft({ goal: 'powerlifting-foundation', level: 'oevet', daysPerWeek: 2, equipment: 'gym', squatStyle: 'not-sure', deadliftStyle: 'sumo' })
  assert.equal(result.outcome, 'manual-review')
  assert.equal(result.reason, 'styrkeløftvariant-mangler')
  assert.equal('program' in result, false)
})

test('alle reviewede niveau-, miljø- og 2/3/4-dages rammer kan opløses til komplette lokale udkast', () => {
  for (const goal of ['general-strength', 'powerlifting-foundation']) {
    for (const level of ['begynder', 'oevet']) {
      for (const daysPerWeek of [2, 3, 4]) {
        for (const equipment of ['gym', 'home']) {
          const result = resolveProgramDraft({
            goal, level, daysPerWeek, equipment,
            squatStyle: goal === 'powerlifting-foundation' ? 'high-bar' : '',
            deadliftStyle: goal === 'powerlifting-foundation' ? 'conventional' : '',
          })
          assert.equal(result.outcome, 'review-ready', `${goal}/${level}/${daysPerWeek}/${equipment} skal have et lokalt udkast`)
          assert.equal(result.program.sessions.length, daysPerWeek)
          assert.ok(result.program.sessions.every(session => session.movements.every(movement => movement.prescription.status === 'review' && movement.equipment === equipment)))
        }
      }
    }
  }
})

test('begynderbanen gør fire dage til lavere volumen og RPE frem for et øvet-program', () => {
  const shared = { goal: 'general-strength', daysPerWeek: 4, equipment: 'gym', squatStyle: '', deadliftStyle: '' }
  const beginner = resolveProgramDraft({ ...shared, level: 'begynder' })
  const advanced = resolveProgramDraft({ ...shared, level: 'oevet' })
  const beginnerMovements = beginner.program.sessions.flatMap(session => session.movements)
  const advancedMovements = advanced.program.sessions.flatMap(session => session.movements)
  assert.ok(beginnerMovements.every(movement => movement.prescription.sets <= 2 && movement.prescription.targetRpe === '6'))
  assert.ok(beginnerMovements.reduce((sum, movement) => sum + movement.prescription.sets, 0)
    < advancedMovements.reduce((sum, movement) => sum + movement.prescription.sets, 0))
})
