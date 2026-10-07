// Ordre 1526 fase B+C: Marcs valg som flag (alle FRA) og tests for begge stillinger,
// samt QA 1519 fund 3 paa 1515 (regionregler mod rigtige oevelsesnavne).
import test from 'node:test'
import assert from 'node:assert/strict'
import { RPE_TOM_UDEN_VALG, rpeActualUdenValg } from './rpeValg.js'
import { SMERTE_BESKED, SMERTE_BESKED_AKTIV, smerteBeskedFor, udenForslagVedSmerte } from './smerteStop.js'
import { ramtAfSmerte } from './smerteRegion.js'

test('begge flag er FRA i dette push', () => {
  assert.equal(RPE_TOM_UDEN_VALG, false)
  assert.equal(SMERTE_BESKED_AKTIV, false)
})

// V-RPE: A = gem ingen RPE naar atleten ikke vaelger; B = planlagt RPE gemmes (som nu).
test('V-RPE flag fra (B): ingen valgt -> planlagt RPE gemmes, som foer', () => {
  assert.equal(rpeActualUdenValg('', 8), 8)
  assert.equal(rpeActualUdenValg(undefined, 7.5), 7.5)
  assert.equal(rpeActualUdenValg('', null), null)
})
test('V-RPE flag til (A): ingen valgt -> null, ogsaa naar der er en planlagt RPE', () => {
  assert.equal(rpeActualUdenValg('', 8, true), null)
  assert.equal(rpeActualUdenValg(undefined, 7.5, true), null)
})
test('V-RPE: atletens egen valgte RPE gemmes altid, uanset flag', () => {
  assert.equal(rpeActualUdenValg('9', 8, false), 9)
  assert.equal(rpeActualUdenValg('9', 8, true), 9)
  assert.equal(rpeActualUdenValg(8.5, null, true), 8.5)
})

// V-SMERTE: A = tavst, B = rolig linje. Stoppet selv aendres ikke af flaget.
const NU = new Date('2026-10-07T10:00:00Z').getTime()
const uger = [{ start_date: '2026-10-01', sessions: [{ athlete_comment: 'Det gjorde ondt i knæet', exercises: [{ name: 'Squat' }] }] }]
const forslag = udenForslagVedSmerte(() => ({ weight: 100 }), uger, {}, NU)

test('V-SMERTE flag fra (A): ingen linje, forslaget er stadig standset', () => {
  assert.equal(smerteBeskedFor(forslag, 'Squat'), null)
  assert.equal(forslag('Squat', 'RPE 8'), null)
})
test('V-SMERTE flag til (B): rolig linje paa det ramte loeft, ikke paa andre', () => {
  assert.equal(smerteBeskedFor(forslag, 'Squat', true), SMERTE_BESKED)
  assert.equal(smerteBeskedFor(forslag, 'Bænkpres', true), null)
  assert.equal(forslag('Bænkpres', 'RPE 8')?.weight, 100)
})

// QA 1519 fund 3 (1515): regionreglerne mod rigtige navne. Ukendt navn = stop (sikker side).
const KNAE_STOPPER = {
  'Squat': true, 'Pause squat': true, 'Front squat': true, 'Goblet squat': true, 'Bulgarian split squat': true,
  'Benpres': true, 'Hip thrust': true, 'Walking lunges': true,
  'Bænkpres': false, 'Pause bænkpres': false, 'Close grip bænkpres': false, 'Militærpres': false,
  'Konventionel dødløft': false, 'Sumo dødløft': false, 'Rumænsk dødløft': false, 'Pull-up': false, 'Face pull': false,
  'Planke': true, 'Farmers walk': true, // uklassificeret -> stop (sikker side)
}
for (const [navn, stopper] of Object.entries(KNAE_STOPPER)) {
  test(`knæ-smerte ${stopper ? 'standser' : 'standser ikke'}: ${navn}`, () => {
    assert.equal(ramtAfSmerte(['knæet'], navn), stopper)
  })
}
test('skulder-smerte rammer bænk/overkrop, ikke squat eller dødløft', () => {
  for (const n of ['Bænkpres', 'Pause bænkpres', 'Militærpres', 'Pull-up', 'Face pull']) assert.equal(ramtAfSmerte(['skulderen'], n), true, n)
  for (const n of ['Squat', 'Front squat', 'Sumo dødløft']) assert.equal(ramtAfSmerte(['skulderen'], n), false, n)
})

// Ordre 1533 (QA 1529 fund 3+4): V-RPE=A (ingen gemt RPE) maa ikke give falske coach-signaler eller kast.
import { detectSignalsV2 } from '../coachBriefingRules.js'
import { fixtures } from '../../test/fixtures/briefing/index.mjs'
import { rpeVist } from './rpeValg.js'

const udenRpe = v => Array.isArray(v) ? v.map(udenRpe)
  : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, k === 'rpe_actual' ? null : udenRpe(x)]))
  : v

test('V-RPE=A: skærmen forvælger ingen RPE; flag fra viser den planlagte som før', () => {
  assert.equal(rpeVist('', 8, true), '')
  assert.equal(rpeVist(undefined, 7.5, true), '')
  assert.equal(rpeVist('', 8, false), 8)
  assert.equal(rpeVist('9', 8, true), '9', 'atletens eget valg vises altid')
})

for (const [navn, fixture] of Object.entries(fixtures)) {
  test(`coach-detektorer med null-RPE overalt (${navn}): ingen kast, intet rpe_drift-signal`, () => {
    const signaler = detectSignalsV2(udenRpe(fixture))
    assert.ok(Array.isArray(signaler))
    assert.equal(signaler.filter(s => s.detector === 'rpe_drift').length, 0, 'uden RPE-tal ingen RPE-drift')
    for (const s of signaler) assert.ok(!/NaN|undefined|null/.test(`${s.headline} ${s.detail}`), `ren tekst: ${s.headline}`)
  })
}
