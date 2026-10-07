// Ordre 1547: Marcs valg bygget ind (V-SMERTE=B, V-RPE=B), og QA 1519 fund 3 paa 1515
// (regionregler mod rigtige oevelsesnavne).
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { SMERTE_BESKED, smerteBeskedFor, udenForslagVedSmerte } from './smerteStop.js'
import { ramtAfSmerte } from './smerteRegion.js'

// V-SMERTE=B: rolig linje paa de loeft stoppet rammer. Stoppet selv er uaendret.
const NU = new Date('2026-10-07T10:00:00Z').getTime()
const uger = [{ start_date: '2026-10-01', sessions: [{ athlete_comment: 'Det gjorde ondt i knæet', exercises: [{ name: 'Squat' }] }] }]
const forslag = udenForslagVedSmerte(() => ({ weight: 100 }), uger, {}, NU)

test('V-SMERTE=B: rolig linje paa det ramte loeft, ikke paa andre; forslaget standset kun paa det ramte', () => {
  assert.equal(smerteBeskedFor(forslag, 'Squat'), SMERTE_BESKED)
  assert.equal(smerteBeskedFor(forslag, 'Bænkpres'), null)
  assert.equal(forslag('Squat', 'RPE 8'), null)
  assert.equal(forslag('Bænkpres', 'RPE 8')?.weight, 100)
})

// V-RPE=B: som i ordre 1492 gemmes den planlagte RPE uden valg. Ingen flag, ingen anden sti;
// begge logflader (Dagens pas og Program-fanen) viser det, der gemmes.
test('V-RPE=B: ingen flag-fil, og ingen logflade forvaelger et tal der ikke gemmes', () => {
  assert.throws(() => readFileSync(new URL('./rpeValg.js', import.meta.url)), /ENOENT/)
  for (const f of ['DagensPasCard.jsx', 'ProgramTab.jsx']) {
    const kode = readFileSync(new URL(`./${f}`, import.meta.url), 'utf8')
    assert.ok(!/plannedRpe\s*:\s*8\)|plannedRpe\s*\|\|\s*8\}/.test(kode), `${f}: intet opfundet standard-8`)
  }
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

// Ordre 1533 (QA 1529 fund 3+4): null rpe_actual maa ikke give falske coach-signaler eller kast.
import { detectSignalsV2 } from '../coachBriefingRules.js'
import { fixtures } from '../../test/fixtures/briefing/index.mjs'

const udenRpe = v => Array.isArray(v) ? v.map(udenRpe)
  : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, k === 'rpe_actual' ? null : udenRpe(x)]))
  : v

for (const [navn, fixture] of Object.entries(fixtures)) {
  test(`coach-detektorer med null-RPE overalt (${navn}): ingen kast, intet rpe_drift-signal`, () => {
    const signaler = detectSignalsV2(udenRpe(fixture))
    assert.ok(Array.isArray(signaler))
    assert.equal(signaler.filter(s => s.detector === 'rpe_drift').length, 0, 'uden RPE-tal ingen RPE-drift')
    for (const s of signaler) assert.ok(!/NaN|undefined|null/.test(`${s.headline} ${s.detail}`), `ren tekst: ${s.headline}`)
  })
}
