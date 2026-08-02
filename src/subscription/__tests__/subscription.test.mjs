// Tests for abonnementsprototypens rene logik.
//
// Kører på nodes indbyggede testrunner — ingen ny dependency:
//   node --test src/subscription/__tests__

import test from 'node:test'
import assert from 'node:assert/strict'

import { PROGRAMS, LEVELS, EQUIPMENT, DAY_OPTIONS, getProgram, findExercise } from '../programs.js'
import { selectProgram, candidatePrograms, explainSelection } from '../selectProgram.js'
import { can, isTier, TIERS } from '../entitlements.js'
import {
  bestSet,
  completeSession,
  completedSessions,
  exerciseHistory,
  lastSetFor,
  logSet,
  loggedExerciseIds,
  nextDayId,
  removeLastSet,
  sessionTotals,
  setsFor,
  startSession,
} from '../trainingLog.js'
import { loadProfile, loadSessions, newProfile, saveProfile, SCHEMA_VERSION } from '../storage.js'

// --- programmer -------------------------------------------------------------

test('programmerne har unikke id\'er og velformede pas', () => {
  const ids = PROGRAMS.map(p => p.id)
  assert.equal(new Set(ids).size, ids.length)
  assert.equal(PROGRAMS.length, 3)

  for (const program of PROGRAMS) {
    assert.equal(program.sessions.length, program.days)
    assert.ok(program.progression.length > 20, `${program.id} mangler progressionsregel`)
    for (const session of program.sessions) {
      assert.ok(session.exercises.length >= 3)
      for (const ex of session.exercises) {
        assert.ok(ex.sets >= 1 && ex.rest >= 30)
        assert.match(String(ex.reps), /\d/)
      }
    }
  }
})

// --- programvalg ------------------------------------------------------------

test('programvalget er deterministisk for alle kombinationer', () => {
  for (const level of LEVELS) {
    for (const days of DAY_OPTIONS) {
      for (const eq of EQUIPMENT) {
        const input = { level: level.id, daysPerWeek: days, equipment: eq.id }
        const first = selectProgram(input)
        for (let i = 0; i < 5; i++) {
          assert.deepEqual(selectProgram(input), first)
        }
        assert.ok(getProgram(first.programId), 'valgte et ukendt program')
      }
    }
  }
})

test('valget respekterer dage, udstyr og niveau', () => {
  // Fuldt center, 4 dage, øvet → det største program.
  assert.equal(
    selectProgram({ level: 'oevet', daysPerWeek: 4, equipment: 'gym' }).programId,
    'okuk-4'
  )
  // Samme dage og udstyr, men begynder → 4-dages splittet er ikke tilladt.
  assert.equal(
    selectProgram({ level: 'begynder', daysPerWeek: 4, equipment: 'gym' }).programId,
    'fuldkrop-3'
  )
  // Fuldt center, men kun 2 dage → programmet må ikke kræve flere dage.
  assert.equal(
    selectProgram({ level: 'oevet', daysPerWeek: 2, equipment: 'gym' }).programId,
    'start-2'
  )
  // Ingen udstyr → kun kropsvægtsprogrammet.
  assert.equal(
    selectProgram({ level: 'oevet', daysPerWeek: 4, equipment: 'bodyweight' }).programId,
    'start-2'
  )
  // Håndvægte og 3 dage → mellemprogrammet.
  assert.equal(
    selectProgram({ level: 'begynder', daysPerWeek: 3, equipment: 'dumbbells' }).programId,
    'fuldkrop-3'
  )
})

test('et valgt program overstiger aldrig brugerens dage eller udstyr', () => {
  const tier = { bodyweight: 0, dumbbells: 1, gym: 2 }
  for (const level of LEVELS) {
    for (const days of DAY_OPTIONS) {
      for (const eq of EQUIPMENT) {
        const { programId } = selectProgram({ level: level.id, daysPerWeek: days, equipment: eq.id })
        const program = getProgram(programId)
        assert.ok(program.days <= days, `${program.id} kræver flere dage end valgt`)
        assert.ok(program.minEquipment <= tier[eq.id], `${program.id} kræver mere udstyr end valgt`)
      }
    }
  }
})

test('ugyldigt input falder tilbage på startprogrammet i stedet for at kaste', () => {
  const result = selectProgram({ level: 'ukendt', daysPerWeek: 0, equipment: 'ingenting' })
  assert.equal(result.programId, 'start-2')
  assert.equal(result.fallback, true)
  assert.ok(explainSelection({ level: 'ukendt', daysPerWeek: 0, equipment: 'x' }).length > 10)
})

test('kandidatlisten er tom når intet passer', () => {
  assert.deepEqual(candidatePrograms({ level: 'begynder', daysPerWeek: 1, equipment: 'gym' }), [])
})

// --- entitlements -----------------------------------------------------------

test('de tre niveauer er teknisk adskilt', () => {
  assert.deepEqual(TIERS, ['free', 'member', 'coaching'])

  assert.equal(can('free', 'training.log'), true)
  assert.equal(can('free', 'history.sessions'), true)
  assert.equal(can('free', 'program.starter'), true)

  assert.equal(can('free', 'program.library'), false)
  assert.equal(can('free', 'history.progression'), false)
  assert.equal(can('member', 'program.library'), true)
  assert.equal(can('member', 'history.progression'), true)

  // 1:1-coaching leveres af atletportalen, aldrig af abonnementsappen.
  assert.equal(can('free', 'coaching.personal'), false)
  assert.equal(can('member', 'coaching.personal'), false)
  assert.equal(can('coaching', 'coaching.personal'), true)

  // Ukendt tier eller feature giver aldrig adgang.
  assert.equal(can('admin', 'program.library'), false)
  assert.equal(can('member', 'noget.andet'), false)
  assert.equal(isTier('member'), true)
  assert.equal(isTier('vip'), false)
})

// --- træningslog ------------------------------------------------------------

const program = getProgram('fuldkrop-3')

function seed() {
  let session = startSession(program, 'a', Date.parse('2026-07-01T10:00:00Z'))
  session = logSet(session, 'gobletsquat', { reps: 10, weightKg: 20, rpe: 7, loggedAt: 'x' })
  session = logSet(session, 'gobletsquat', { reps: 10, weightKg: 22.5, rpe: 8, loggedAt: 'x' })
  session = logSet(session, 'hv-baenkpres', { reps: 8, weightKg: 24, rpe: 8, loggedAt: 'x' })
  return session
}

test('sæt logges pr. øvelse og kan fortrydes', () => {
  const session = seed()
  assert.equal(setsFor(session, 'gobletsquat').length, 2)
  assert.equal(setsFor(session, 'hv-baenkpres').length, 1)
  assert.equal(setsFor(session, 'findes-ikke').length, 0)

  const undone = removeLastSet(session, 'gobletsquat')
  assert.equal(setsFor(undone, 'gobletsquat').length, 1)
  // Originalen er urørt — funktionerne er rene.
  assert.equal(setsFor(session, 'gobletsquat').length, 2)

  // Sidste sæt fjernet → hele posten forsvinder.
  const empty = removeLastSet(removeLastSet(undone, 'gobletsquat'), 'hv-baenkpres')
  assert.equal(empty.entries.length, 0)
})

test('totaler summerer sæt og volumen', () => {
  const totals = sessionTotals(seed())
  assert.equal(totals.sets, 3)
  assert.equal(totals.volume, Math.round(10 * 20 + 10 * 22.5 + 8 * 24))
})

test('bedste sæt er den tungeste vægt, ved lige vægt flest reps', () => {
  assert.equal(bestSet([]), null)
  assert.equal(
    bestSet([
      { reps: 10, weightKg: 20, rpe: 7 },
      { reps: 8, weightKg: 25, rpe: 9 },
    ]).weightKg,
    25
  )
  assert.equal(
    bestSet([
      { reps: 8, weightKg: 25, rpe: 8 },
      { reps: 11, weightKg: 25, rpe: 9 },
    ]).reps,
    11
  )
})

test('passene roterer efter antal gennemførte pas i programmet', () => {
  assert.equal(nextDayId(program, []), 'a')

  const done = []
  for (let i = 0; i < 4; i++) {
    const expected = ['a', 'b', 'c', 'a'][i]
    assert.equal(nextDayId(program, done), expected)
    done.push(completeSession(startSession(program, expected, Date.parse('2026-07-01T10:00:00Z') + i * 86400000)))
  }

  // Et ikke-afsluttet pas rykker ikke rotationen.
  const withDraft = [...done, startSession(program, 'b', Date.now())]
  assert.equal(nextDayId(program, withDraft), nextDayId(program, done))

  // Pas fra et andet program tæller ikke med.
  const other = completeSession(startSession(getProgram('start-2'), 'a', Date.now()))
  assert.equal(nextDayId(program, [...done, other]), nextDayId(program, done))
})

test('historik og forudfyldning ser kun brugerens egne, afsluttede pas', () => {
  const first = completeSession(seed(), Date.parse('2026-07-01T11:00:00Z'))
  let second = startSession(program, 'a', Date.parse('2026-07-08T10:00:00Z'))
  second = logSet(second, 'gobletsquat', { reps: 10, weightKg: 25, rpe: 8, loggedAt: 'y' })
  second = completeSession(second, Date.parse('2026-07-08T11:00:00Z'))
  const sessions = [first, second]

  // Nyeste først.
  const history = exerciseHistory(sessions, 'gobletsquat')
  assert.equal(history.length, 2)
  assert.equal(history[0].best.weightKg, 25)
  assert.equal(history[1].best.weightKg, 22.5)

  // Forudfyldning bruger seneste faktiske logning.
  assert.equal(lastSetFor(sessions, 'gobletsquat').weightKg, 25)
  assert.equal(lastSetFor(sessions, 'aldrig-lavet'), null)
  assert.equal(lastSetFor([], 'gobletsquat'), null)

  assert.equal(completedSessions(sessions).length, 2)
  assert.deepEqual(loggedExerciseIds(sessions), ['gobletsquat', 'hv-baenkpres'])

  // Øvelses-id'er i loggen kan slås op i programmet.
  for (const id of loggedExerciseIds(sessions)) {
    assert.ok(findExercise(program.id, id), `ukendt øvelse ${id}`)
  }
})

// --- lokal persistering -----------------------------------------------------

test('demoprofilen har det forventede skema', () => {
  const profile = newProfile({
    name: '  Marc ',
    level: 'oevet',
    daysPerWeek: 3,
    equipment: 'dumbbells',
    programId: 'fuldkrop-3',
  })
  assert.equal(profile.name, 'Marc')
  assert.equal(profile.entitlement, 'member')
  assert.equal(profile.schemaVersion, SCHEMA_VERSION)
  assert.ok(isTier(profile.entitlement))

  // Tomt navn må ikke give en profil uden navn.
  assert.equal(newProfile({ name: '   ' }).name, 'Demo')
})

test('storage fejler blødt uden localStorage (SSR/privat browsing)', () => {
  assert.equal(typeof globalThis.window, 'undefined')
  assert.equal(loadProfile(), null)
  assert.deepEqual(loadSessions(), [])
  assert.equal(saveProfile({ name: 'x' }), false)
})
