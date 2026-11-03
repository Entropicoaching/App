import test from 'node:test'
import assert from 'node:assert/strict'
import { recommendMobilityRoutine } from './mobility-recommendation.mjs'
import { WARMUP_BASE } from '../../athlete/mobilityCatalog.mjs'
import { focusPlan } from '../../athlete/mobilityFocus.mjs'

const session = (...names) => ({ exercises: names.map(name => ({ name, sets: 3 })) })

test('known lifts reuse complete existing focus routines with short reasons', () => {
  for (const [name, lift, need] of [
    ['Squat', 'Squat', 'Mere dybde'],
    ['Bænkpres', 'Bænkpres', 'Skulderposition'],
    ['Dødløft', 'Dødløft', 'Hofteposition'],
    ['Sumo deadlift', 'Dødløft', 'Plads i sumostilling'],
  ]) {
    const result = recommendMobilityRoutine(session(name))
    assert.equal(result.isDefault, false)
    assert.equal(result.lift, lift)
    assert.equal(result.need, need)
    assert.deepEqual(result.routine, focusPlan(lift, need, WARMUP_BASE).exercises)
    assert.equal(result.routine.length, 3)
    assert.ok(result.reason.length > 15 && result.reason.length < 160)
  }
})

test('Danish, ASCII, English and competition suffix names are recognized', () => {
  for (const name of [' BÆNKPRES ', 'Baenkpres - topsæt', 'Bench press (comp)']) {
    assert.equal(recommendMobilityRoutine(session(name)).lift, 'Bænkpres')
  }
  for (const name of ['Doedloeft', 'DEADLIFT', 'Dødløft — Konventionel']) {
    assert.equal(recommendMobilityRoutine(session(name)).need, 'Hofteposition')
  }
  assert.equal(recommendMobilityRoutine(session('Dødløft — Sumo')).need, 'Plads i sumostilling')
})

test('first supported main lift wins without mixing routines or sorting', () => {
  const result = recommendMobilityRoutine(session('Romanian deadlift', 'Bench press', 'Squat'))
  assert.deepEqual(result.routine.map(ex => ex.id), ['bp-mob-2', 'bp-akt-3', 'bp-akt-1'])
  assert.equal(recommendMobilityRoutine(session('Squat', 'Bench press')).lift, 'Squat')
  assert.equal(recommendMobilityRoutine(session('Overhead press', 'Deadlift')).lift, 'Dødløft')
})

test('unknown, missing and malformed session data produce the same standard', () => {
  const standard = recommendMobilityRoutine()
  assert.equal(standard.isDefault, true)
  assert.deepEqual(standard.routine.map(ex => ex.id), ['sq-mob-2', 'sq-mob-3', 'sq-mov-1'])
  for (const value of [null, false, 1, '', {}, { exercises: {} },
    { exercises: [null, false, {}, { name: {} }, { name: 23 }] },
    session('Row'), session('Front squat', 'DB bench press', 'RDL')]) {
    assert.deepEqual(recommendMobilityRoutine(value), standard)
  }
})

test('zero or invalid sets are ignored; missing and positive numeric sets work', () => {
  for (const sets of [0, -1, NaN, Infinity, '', '0', 'bad', null, true, {}, []]) {
    const result = recommendMobilityRoutine({ exercises: [{ name: 'Squat', sets }, { name: 'Bench press' }] })
    assert.equal(result.lift, 'Bænkpres')
  }
  for (const sets of [undefined, 1, '3']) {
    assert.equal(recommendMobilityRoutine({ exercises: [{ name: 'Bench press', sets }] }).isDefault, false)
  }
})

test('input and catalog remain unchanged; every output has independent steps', () => {
  const input = Object.freeze({ exercises: Object.freeze([
    Object.freeze({ name: 'Squat', sets: 3 }),
  ]) })
  const before = JSON.stringify(WARMUP_BASE)
  const first = recommendMobilityRoutine(input)
  const expected = structuredClone(first)
  first.routine[0].name = 'changed'
  first.routine.pop()
  assert.deepEqual(recommendMobilityRoutine(input), expected)
  assert.equal(JSON.stringify(WARMUP_BASE), before)
})
