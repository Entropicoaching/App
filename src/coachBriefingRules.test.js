// ORDRE 370 · Coach Briefing skarpere. En test pr. syntetisk atlet
// (test/fixtures/briefing/), plus prioritering og synkronisering med n8n.
// Hver atlet-test tjekker baade hvad v1 sagde (FOER) og hvad v2 siger.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fixtures } from '../test/fixtures/briefing/index.mjs'
import { buildAthlete } from '../test/fixtures/briefing/helpers.mjs'
import { DETECTOR_RANK, MESSAGE_VIDEO_RANK, briefingOrder, briefingVisible, detectSignalsV1, detectSignalsV2 } from './coachBriefingRules.js'

const v1 = fixture => briefingVisible(detectSignalsV1(fixture))
const only = fixture => {
  const signals = detectSignalsV2(fixture)
  assert.equal(signals.length, 1, `forventede praecis et signal, fik: ${signals.map(s => s.detector).join(', ')}`)
  return signals[0]
}
const hasAction = signal => {
  assert.ok(signal.detail && signal.detail.length > 10, 'signalet skal sige hvad Marc goer nu')
  assert.equal(signal.metrics.action, signal.detail, 'handlingen skal ogsaa ligge i metrics.action til n8n')
}

test('A: squat staaet stille 3 uger med stigende RPE -> alert med tal, uge og handling (v1 var tavs)', () => {
  assert.deepEqual(v1(fixtures.a), [], 'v1 regner 3-ugers snit og kalder plateauet fremgang')
  const signal = only(fixtures.a)
  assert.equal(signal.detector, 'stagnation')
  assert.equal(signal.severity, 'alert')
  assert.equal(signal.headline, 'Atlet A: Squat stået stille 3 uger (140×5 siden uge 5), RPE 8→9 mod plan 8')
  assert.match(signal.detail, /deload eller en variation/)
  hasAction(signal)
})

test('B: RPE +1,5 over plan -> naevner det tungeste loeft og hvad der skal saenkes', () => {
  const [before] = v1(fixtures.b)
  assert.equal(before.detail, 'snit-afvigelse 1.66 RPE over 3 uger (48 sæt)', 'v1: tal uden loeft og uden handling')
  const signal = only(fixtures.b)
  assert.equal(signal.detector, 'rpe_drift')
  assert.equal(signal.severity, 'alert')
  assert.equal(signal.headline, 'Atlet B: RPE i snit +1,7 over plan de sidste 3 uger (48 sæt); mest på Squat +2,0')
  assert.match(signal.detail, /^Sænk squat ~5 % næste uge/)
  hasAction(signal)
})

test('C: knaesmerte i pas-kommentar -> smerte-alert med kropsdel, uge og loeft; kommentaren citeres aldrig', () => {
  assert.deepEqual(v1(fixtures.c), [], 'v1 har ingen smerte-detektor')
  const signal = only(fixtures.c)
  assert.equal(signal.detector, 'pain')
  assert.equal(signal.severity, 'alert')
  assert.equal(signal.headline, 'Atlet C: melder ondt i knæet (pas-kommentar, uge 7, Pas 3 med squat); ømhed ≥4/5 i Ben 2 af de sidste 7 dage')
  assert.doesNotMatch(JSON.stringify(signal), /bunden af squat/, 'atletens egne ord maa ikke komme med')
  assert.match(signal.detail, /^Kontakt i dag, før næste squat-pas/)
  hasAction(signal)
})

test('D: mistede 2 af 3 pas -> fremmoede-alert med uge, datoer og hvilke pas', () => {
  assert.deepEqual(v1(fixtures.d), [], 'v1 frafald: 14,0 saet/uge mod norm 18 er over 0,65x')
  const signal = only(fixtures.d)
  assert.equal(signal.detector, 'missed_sessions')
  assert.equal(signal.severity, 'alert')
  assert.equal(signal.headline, 'Atlet D: mistede 2 af 3 pas i uge 7 (14.-20. sep.): Pas 2, Pas 3')
  hasAction(signal)
})

test('E: PR paa baenk -> fremgang med tal og forrige bedste, lav prioritet (context)', () => {
  assert.deepEqual(v1(fixtures.e), [], 'v1 sender kun alert/context; fremgang er "ok"')
  const signal = only(fixtures.e)
  assert.equal(signal.detector, 'pr')
  assert.equal(signal.severity, 'context')
  assert.equal(signal.headline, 'Atlet E: PR på Bænk 100×3 (22. sep.; før 97,5×3)')
  assert.match(signal.detail, /Anerkend/)
  hasAction(signal)
})

test('F: intet at bemaerke -> ingen linjer, hverken foer eller efter', () => {
  assert.deepEqual(v1(fixtures.f), [])
  assert.deepEqual(detectSignalsV2(fixtures.f), [])
})

test('G: RPE under plan men traette check-ins -> datatjek i stedet for "plads til mere"', () => {
  const [before] = v1(fixtures.g)
  assert.equal(before.headline, 'Atlet G: træner lettere end planlagt', 'v1 inviterer til at oege')
  const signal = only(fixtures.g)
  assert.equal(signal.detector, 'data_conflict')
  assert.equal(signal.severity, 'context')
  assert.match(signal.headline, /RPE i snit -1,0 under plan \(3 uger, 48 sæt\), men ømhed ≥4\/5 eller energi ≤2\/5 i 3 af 4 check-ins/)
  assert.match(signal.detail, /^Øg ikke belastningen endnu/)
  hasAction(signal)
})

test('prioritering: smerte, fravaer, afvigelse fra plan (alert foer context), fremgang til sidst', () => {
  const all = Object.values(fixtures).flatMap(detectSignalsV2)
  assert.deepEqual(briefingOrder(all).map(s => `${s.athlete_name}:${s.detector}`), [
    'Atlet C:pain', 'Atlet D:missed_sessions', 'Atlet A:stagnation', 'Atlet B:rpe_drift', 'Atlet G:data_conflict', 'Atlet E:pr',
  ])
})

test('n8n Build briefing bruger samme rangtabel og samme raekkefoelge som den rene funktion', () => {
  const code = readFileSync(new URL('../n8n/build-coach-briefing.code', import.meta.url), 'utf8')
  const rank = code.match(/const DETECTOR_RANK = (\{[^}]+\});/)
  assert.ok(rank, 'DETECTOR_RANK mangler i build-coach-briefing.code')
  assert.deepEqual(Function(`return ${rank[1]}`)(), DETECTOR_RANK)
  assert.match(code, new RegExp(`const MESSAGE_VIDEO_RANK = ${MESSAGE_VIDEO_RANK};`))
  const workflow = JSON.parse(readFileSync(new URL('../n8n/coach-briefing-v1.json', import.meta.url), 'utf8'))
  const build = workflow.nodes.find(node => node.name === 'Build briefing').parameters.jsCode
  const all = Object.values(fixtures).flatMap(detectSignalsV2)
  const run = new Function('$input', '$execution', '$', '$getWorkflowStaticData', build)
  const [{ json }] = run(
    { first: () => ({ json: { unread_messages: [], video_drafts: [], training_signals: all } }) },
    { mode: 'test' },
    () => ({ first: () => ({ json: { appUrl: 'https://example.invalid', coachEmail: 'coach@example.invalid' } }) }),
    () => ({}),
  )
  const queue = json.html.slice(json.html.indexOf('Din rækkefølge'))
  const positions = briefingOrder(all).slice(0, 5).map(s => queue.indexOf(`>${s.athlete_name}<`))
  assert.ok(positions.every(p => p >= 0))
  assert.deepEqual([...positions].sort((a, b) => a - b), positions, 'mailen skal have samme raekkefoelge')
  assert.match(json.subject, /først: Atlet C \(Smerte\)$/)
  assert.match(queue, />Kontakt i dag, før næste squat-pas/, 'handlingslinjen skal staa i mailen')
})

test('ferie: mistede pas giver intet signal', () => {
  const onHoliday = buildAthlete({
    id: 'syn-h', name: 'Atlet H', status: 'ferie',
    session: (w, p) => ({ sets: [{ name: 'Squat', weight: 100, reps: 5, rpe_planned: 8, rpe_actual: 8 }], missed: w === 6 && p > 0 }),
  })
  assert.equal(detectSignalsV2(onHoliday).filter(s => s.detector === 'missed_sessions').length, 0)
})

test('stagnation: et signal pr. atlet, selv naar flere loeft staar stille', () => {
  const flat = buildAthlete({
    id: 'syn-i', name: 'Atlet I',
    session: (w, p) => {
      const top = w < 3 ? 100 + 5 * w : 110
      return p === 2 ? [] : [
        { name: 'Squat', weight: top, reps: 5, rpe_planned: 8, rpe_actual: 8 },
        { name: 'Bænk', weight: top - 30, reps: 5, rpe_planned: 8, rpe_actual: 8 },
      ]
    },
  })
  const stagnation = detectSignalsV2(flat).filter(s => s.detector === 'stagnation')
  assert.equal(stagnation.length, 1)
  assert.equal(stagnation[0].severity, 'context', 'fladt uden stigende RPE er ikke akut')
  assert.match(stagnation[0].headline, /\(\+1 løft mere fladt\)$/)
})
