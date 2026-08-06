// Tests for abonnementsprototypens rene logik.
//
// Kører på nodes indbyggede testrunner — ingen ny dependency:
//   node --test src/subscription/__tests__

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { PROGRAMS, LEVELS, EQUIPMENT, DAY_OPTIONS, getProgram, findExercise } from '../programs.js'
import { selectProgram, candidatePrograms, explainSelection } from '../selectProgram.js'
import { can, featureSummary, isTier, TIERS } from '../entitlements.js'
import { PILOT_PRICING } from '../featureFlags.js'
import { PRICE } from '../pricing.js'
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

// --- CT-033: forsiden, guiden og prisen bag slukkede flag -------------------
// Flyttet hertil fra entropi-adaptiv sammen med koden. Uden dem er metoden kun
// en hensigt: verify:pilot-flags kraever at flagene er slukkede, men den siger
// intet om hvad der sker hvis prisen eller et skriv sniger sig ind ad en anden
// vej end flaget. Braek-verifikationen fandt praecis det hul.

test('pilotens tier-vaerdier findes i entitlement-modellen', () => {
  // Forsiden kalder featureSummary() med pilotens access.tier. Bruger de to
  // forskellige ord for det samme — fx 'paid' mod 'member' — ville forsiden
  // vise ALT som ikke-inkluderet, og fejlen foerst vise sig den dag flaget
  // taendes. access.js kender netop disse to.
  for (const tier of ['free', 'member']) {
    assert.ok(TIERS.includes(tier), `piloten bruger tier '${tier}' som modellen ikke kender`)
    assert.ok(featureSummary(tier).some(f => f.included))
  }
  assert.notDeepEqual(
    featureSummary('free').map(f => f.included),
    featureSummary('member').map(f => f.included),
  )
})

test('Mitch ser ingen pris i pilot-skallen', () => {
  // Marc, 5. august: skjul prisen for piloten. Mitch er en rigtig person i et
  // GRATIS forloeb, og der findes ingen betaling — et beloeb ville stille noget
  // i udsigt der ikke kan koebes.
  assert.equal(PILOT_PRICING, false)

  const kilde = readFileSync(new URL('../PilotSubscriptionApp.jsx', import.meta.url), 'utf8')
  assert.ok(kilde.includes('visPris={PILOT_PRICING}'), 'pilot-skallen skal binde prisen til flaget')
  assert.ok(!kilde.includes('priceLabel'), 'pilot-skallen maa ikke kalde priceLabel direkte')
  assert.ok(!kilde.includes(String(PRICE.amount)), 'beloebet maa ikke staa haardkodet i pilot-skallen')
})

test('guiden i pilot-skallen skriver ingenting', () => {
  // Brugerens profil ligger i sub_members, og et skriv derfra ville roere den
  // tabel Mitchs koerende pilot laeser af. Det er en produktionsaendring, ikke
  // en UI-aendring — og et slukket flag beskytter mod at VISE noget, ikke mod
  // et forkert skriv. Derfor er forbuddet en test, ikke en hensigt.
  const kilde = readFileSync(new URL('../PilotSubscriptionApp.jsx', import.meta.url), 'utf8')

  assert.ok(kilde.includes('PILOT_GUIDE && visGuide'), 'guiden skal vaere bag flaget')
  assert.ok(
    kilde.includes('onCreate={() => setVisGuide(false)}'),
    'guidens udgang i piloten maa kun lukke visningen',
  )
  for (const forbudt of ['saveProfile', 'newProfile(', 'localStorage.setItem', '.insert(', '.upsert(']) {
    assert.ok(!kilde.includes(forbudt), `pilot-skallen maa ikke kalde ${forbudt}`)
  }
})

// --- profilsiden i pilot-skallen -------------------------------------------

test('profilsiden skriver ingenting', () => {
  // Profilen laeser af sub_members — den tabel Mitchs koerende pilot henter sit
  // program fra. Et skriv herfra ville vaere en produktionsaendring, ikke en
  // UI-aendring, og et slukket flag beskytter mod at VISE noget, ikke mod et
  // forkert skriv. Derfor er forbuddet en test, ikke en hensigt.
  const kilde = readFileSync(new URL('../screens/PilotProfile.jsx', import.meta.url), 'utf8')
  for (const forbudt of ['saveProfile', 'newProfile(', 'localStorage.setItem', '.insert(', '.upsert(', '.update(', 'onChange', '<input']) {
    assert.ok(!kilde.includes(forbudt), `profilsiden maa ikke indeholde ${forbudt}`)
  }
})

test('profilfanen er bundet til flaget begge steder', () => {
  // Baade fanen og selve skaermen skal spoerge PILOT_PROFIL. Kun det foerste, og
  // en gemt 'profile'-tab fra en tidligere session ville kunne aabne skaermen
  // efter at flaget var slukket igen.
  const kilde = readFileSync(new URL('../screens/MemberJourney.jsx', import.meta.url), 'utf8')
  assert.ok(kilde.includes("...(PILOT_PROFIL ? [{ id: 'profile', label: 'Profil' }] : [])"), 'fanen skal vaere bag flaget')
  assert.ok(kilde.includes("if (tab === 'profile' && PILOT_PROFIL)"), 'skaermen skal ogsaa vaere bag flaget')
})

test('setup-valgene har én kilde, ikke to', () => {
  // Profilsiden viser de samme valg som setup-skaermen taeller op. To
  // haandskrevne lister ville drive fra hinanden uden at nogen opdagede det.
  const journey = readFileSync(new URL('../screens/MemberJourney.jsx', import.meta.url), 'utf8')
  const profil = readFileSync(new URL('../screens/PilotProfile.jsx', import.meta.url), 'utf8')
  assert.ok(journey.includes("from '../setupOptions.js'"), 'setup-skaermen skal hente valgene fra den delte fil')
  assert.ok(profil.includes("from '../setupOptions.js'"), 'profilsiden skal hente valgene fra den delte fil')
  assert.ok(!journey.includes('const SQUAT_STYLES = ['), 'listen maa ikke ogsaa staa lokalt i MemberJourney')
})
