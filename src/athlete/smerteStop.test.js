import test from 'node:test'
import assert from 'node:assert/strict'
import { ramtAfSmerte, smerteStopAktiv, udenForslagVedSmerte, smerteBeskedFor, SMERTE_BESKED } from './smerteStop.js'

const NU = new Date('2026-10-07T10:00:00Z').getTime()
const uge = (start, kommentar, ovelser = ['Squat']) => ({
  start_date: start, sessions: [{ athlete_comment: kommentar, exercises: ovelser.map(name => ({ name })) }],
})
const hist = (navn, dato) => ({ [navn.toLowerCase()]: [{ date: dato, sets: [] }] })
const forslag = () => ({ weight: 100, fromRpe: 8, baseWeight: 97.5 })

test('region: knae rammer squat og ben, ikke baenk', () => {
  assert.equal(ramtAfSmerte(['knæet'], 'Squat'), true)
  assert.equal(ramtAfSmerte(['knæet'], 'Benpres'), true)
  assert.equal(ramtAfSmerte(['knæet'], 'Bænkpres'), false)
  assert.equal(ramtAfSmerte(['knæet'], 'Konventionel dødløft'), false)
})
test('region: skulder rammer baenk og overkrop, ikke squat', () => {
  assert.equal(ramtAfSmerte(['skulderen'], 'Bænkpres'), true)
  assert.equal(ramtAfSmerte(['skulderen'], 'Pull-up'), true)
  assert.equal(ramtAfSmerte(['skulderen'], 'Squat'), false)
})
test('region: ryg og hofte rammer squat og doedloeft', () => {
  assert.equal(ramtAfSmerte(['ryggen'], 'Sumo dødløft'), true)
  assert.equal(ramtAfSmerte(['hoften'], 'Squat'), true)
  assert.equal(ramtAfSmerte(['ryggen'], 'Bænkpres'), false)
})
test('uklar region (ingen kropsdel) og uklassificeret loeft: sikker side', () => {
  assert.equal(ramtAfSmerte([], 'Bænkpres'), true)
  assert.equal(ramtAfSmerte(['knæet'], 'Planke'), true)
  assert.equal(ramtAfSmerte(['nakken'], 'Bænkpres'), true)
})

test('knae-note standser squat-forslag, men ikke baenk-forslag', () => {
  const w = [uge('2026-10-05', 'Det gjorde ondt i knaeet', ['Squat', 'Bænkpres'])]
  assert.equal(smerteStopAktiv(w, 'Squat', NU), true)
  assert.equal(smerteStopAktiv(w, 'Bænkpres', NU), false)
  const pakket = udenForslagVedSmerte(forslag, w, {}, NU)
  assert.equal(pakket('Squat', '@8'), null)
  assert.equal(pakket('Bænkpres', '@8').weight, 100)
})
test('uklar region standser alle loeft', () => {
  const w = [uge('2026-10-05', 'smerter efter passet', ['Squat', 'Bænkpres'])]
  assert.equal(smerteStopAktiv(w, 'Bænkpres', NU), true)
  assert.equal(smerteStopAktiv(w, 'Squat', NU), true)
})
test('"ingen smerter" og uge uden smerte giver forslag', () => {
  assert.equal(smerteStopAktiv([uge('2026-10-05', 'ingen smerter i knaeet')], 'Squat', NU), false)
  assert.equal(smerteStopAktiv([uge('2026-10-05', 'God uge')], 'Squat', NU), false)
})
test('dato: regnes fra seneste loggede saet, ikke ugens start (14 dage)', () => {
  // Uge startet 21 dage foer, men passet med noten blev logget for 10 dage siden: stop.
  const w = [uge('2026-09-14', 'ondt i knaeet')]
  assert.equal(smerteStopAktiv(w, 'Squat', NU, hist('Squat', '2026-09-27')), true)
  // Samme uge, passet logget for 20 dage siden: ikke laengere.
  assert.equal(smerteStopAktiv(w, 'Squat', NU, hist('Squat', '2026-09-17')), false)
  // Uden logs: ugens sidste dag (start+6 = 20. sep) er over 14 dage siden.
  assert.equal(smerteStopAktiv(w, 'Squat', NU), false)
  // Uden logs, men ugen startede for 10 dage siden (note ~ 3 dage siden): stop.
  assert.equal(smerteStopAktiv([uge('2026-09-27', 'ondt i knaeet')], 'Squat', NU), true)
})
test('grænse: 14 dage fra notens dato er inkl., 15 er ude', () => {
  const w = [uge('2026-09-14', 'ondt i knaeet')]
  assert.equal(smerteStopAktiv(w, 'Squat', NU, hist('Squat', '2026-09-23')), true) // 14 dage
  assert.equal(smerteStopAktiv(w, 'Squat', NU, hist('Squat', '2026-09-22')), false) // 15 dage
})
test('fremtidig uge, uge uden dato og tomme data ignoreres', () => {
  assert.equal(smerteStopAktiv([uge('2026-10-19', 'smerte')], 'Squat', NU), false)
  assert.equal(smerteStopAktiv([{ sessions: [{ athlete_comment: 'smerte' }] }], 'Squat', NU), false)
  assert.equal(smerteStopAktiv(undefined, 'Squat', NU), false)
})

test('V-SMERTE=B: den rolige linje vises kun for loeft, stoppet rammer', () => {
  const f = udenForslagVedSmerte(forslag, [uge('2026-10-05', 'ondt i knaeet', ['Squat', 'Bænkpres'])], {}, NU)
  assert.equal(smerteBeskedFor(f, 'Squat'), SMERTE_BESKED)
  assert.equal(smerteBeskedFor(f, 'Bænkpres'), null)
  assert.equal(smerteBeskedFor(forslag, 'Squat'), null)
})

test('coach-tekst: omfang i klartekst, uklar kropsdel = alle loeft', async () => {
  const { omfangTekst } = await import('./smerteRegion.js')
  assert.equal(omfangTekst(['knæet']), 'squat og benøvelser')
  assert.equal(omfangTekst(['skulderen']), 'bænk og overkrop')
  assert.equal(omfangTekst(['ryggen']), 'squat og benøvelser, dødløft og rygøvelser')
  assert.equal(omfangTekst([]), 'alle løft')
  assert.equal(omfangTekst(['nakken']), 'alle løft')
})
