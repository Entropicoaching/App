import test from 'node:test'
import assert from 'node:assert/strict'
import { addCalendarDays } from '../../../calendarDate.js'
import { paaSigtModel, planlagtSvaerhed, PAA_SIGT_ROLIG } from './paaSigtModel.mjs'
import PaaSigtView from './PaaSigtView.mjs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// Kun syntetiske data. "now" er en onsdag; seneste sæt er mandag i samme uge.
const now = '2026-11-18T12:00:00Z'
const day = weeksAgo => addCalendarDays('2026-11-16', -7 * weeksAgo)
const set = (weeksAgo, weight, extra = {}) => ({ exercise_id: `syn-${extra.name ?? 'Squat'}-${weeksAgo}-${weight}`,
  logged_at: `${day(weeksAgo)}T10:00:00Z`, weight, reps_completed: extra.reps ?? 3,
  exercises: { name: extra.name ?? 'Squat', sessions: { weeks: { block_name: extra.block ?? 'Styrke' } } } })
// Seks uger med jævn fremgang: 150 -> 156 kg × 3 (e1RM 165 -> 171,6 = 4 %).
const squat = [6, 5, 4, 3, 2, 1, 0].map(w => set(w, 156 - w))
const props = extra => ({ entropi2: true, now, fremgangLogs: squat, ...extra })
const week = (intensity, block = 'Styrke') => ({ id: 'syn-week', start_date: '2026-11-16', block_name: block,
  sessions: [{ id: 'syn-s1', exercises: [{ id: 'syn-e1', name: 'Squat', sets: 3, reps: '3', intensity }] }] })

test('procent over 6 uger i klart sprog, som Marcs eksempel', () => {
  const m = paaSigtModel(props(), now)
  assert.equal(m.state, 'ready')
  assert.equal(m.lifts.length, 1)
  assert.equal(m.lifts[0].weeks, 6)
  assert.equal(m.lifts[0].percent, 4)
  assert.equal(m.lifts[0].text, 'Din squat er gået 4 % frem på 6 uger.')
  assert.equal(m.lifts[0].top, 'Din seneste uge er dit bedste skøn i et halvt år, så du er på toppen nu.')
})

test('tilbagegang og stilstand får rolige ord og ingen top', () => {
  const ned = paaSigtModel(props({ fremgangLogs: [6, 4, 2, 0].map(w => set(w, 150 + w)) }), now)
  assert.equal(ned.lifts[0].text, 'Din squat er gået 4 % tilbage på 6 uger.')
  assert.equal(ned.lifts[0].top, null)
  const stille = paaSigtModel(props({ fremgangLogs: [5, 3, 1, 0].map(w => set(w, 150)) }), now)
  assert.equal(stille.lifts[0].text, 'Din squat har ligget stabilt de seneste 5 uger.')
  assert.equal(stille.lifts[0].top, null)
})

test('næste top regnes af tempoet og kun inden for 8 uger', () => {
  // Gammel top 180 kg × 3 for 20 uger siden; tempo ca. 1 kg × 3 pr. uge.
  const nær = paaSigtModel(props({ fremgangLogs: [set(20, 162), ...squat] }), now)
  assert.equal(nær.lifts[0].percent, 4)
  assert.match(nær.lifts[0].top, /^Holder tempoet, er en ny top realistisk om cirka [1-8] uger?\.$/)
  const fjern = paaSigtModel(props({ fremgangLogs: [set(20, 190), ...squat] }), now)
  assert.equal(fjern.lifts[0].top, 'Holder tempoet, er en ny top mere end 8 uger væk.')
})

test('for lidt data giver én rolig sætning og intet gæt', () => {
  for (const logs of [[], [set(1, 150), set(0, 152)], [3, 2, 1, 0].map(w => set(w, 150 + w)),
    [8, 7, 6, 5, 4, 3].map(w => set(w, 150 + w))]) {
    const m = paaSigtModel(props({ fremgangLogs: logs }), now)
    assert.equal(m.state, 'quiet', JSON.stringify(logs.length))
    assert.equal(m.message, PAA_SIGT_ROLIG)
    assert.deepEqual(m.lifts, [])
  }
})

test('lette sæt, varianter, deload og andre rep-områder giver ikke tendens', () => {
  const rows = [6, 4, 2, 0].map(w => set(w, 150 + 2 * (6 - w), { reps: 10 }))
  assert.equal(paaSigtModel(props({ fremgangLogs: rows }), now).state, 'quiet')
  const deload = squat.map(r => ({ ...r, exercises: { ...r.exercises, sessions: { weeks: { block_name: 'Deload' } } } }))
  assert.equal(paaSigtModel(props({ fremgangLogs: deload }), now).state, 'quiet')
  // Ét sæt i 4-6 reps i seneste uge styrer rep-området; 1-3-kurven sammenlignes ikke med det.
  const blandet = [...squat.filter(r => r.logged_at < '2026-11-16'), set(0, 140, { reps: 5 })]
  assert.equal(paaSigtModel(props({ fremgangLogs: blandet }), now).state, 'quiet')
})

test('fejl, indlæsning og manglende historik viser intet', () => {
  for (const extra of [{ fremgangError: true }, { fremgangLoading: true }, { exerciseLogsError: true },
    { exerciseLogsLoading: true }, { fremgangLogs: undefined }]) {
    assert.equal(paaSigtModel(props(extra), now).state, 'hidden')
    assert.equal(PaaSigtView(props(extra)), null)
  }
  assert.equal(paaSigtModel(props(), 'ikke en dato').state, 'hidden')
  assert.equal(PaaSigtView({ ...props(), entropi2: false }), null)
})

test('ugens plan: tunge sæt, let uge, aflastning og ukendt sværhed', () => {
  assert.equal(paaSigtModel(props({ currentWeek: week('RPE 8') }), now).lifts[0].plan,
    'Ugens plan har tunge sæt i squat, så det er her, fremgangen kan vise sig.')
  assert.equal(paaSigtModel(props({ currentWeek: week('@6') }), now).lifts[0].plan,
    'Ugens squat er planlagt let, så det er ikke ugen til at jagte en top.')
  assert.equal(paaSigtModel(props({ currentWeek: week('teknik') }), now).lifts[0].plan, null)
  const aflast = paaSigtModel(props({ currentWeek: week('RPE 8', 'Deload') }), now)
  assert.equal(aflast.deload, 'Denne uge er planlagt som aflastning, så en ny top ventes først bagefter.')
  assert.equal(aflast.lifts[0].plan, null)
  // En gammel uge er ikke "ugens plan".
  assert.equal(paaSigtModel(props({ currentWeek: { ...week('RPE 9'), start_date: '2026-10-01' } }), now).lifts[0].plan, null)
})

test('planlagt sværhed læser RPE, @ og procent', () => {
  assert.equal(planlagtSvaerhed('RPE 8,5'), 'tung')
  assert.equal(planlagtSvaerhed('@7'), 'middel')
  assert.equal(planlagtSvaerhed('RPE 6'), 'let')
  assert.equal(planlagtSvaerhed('87,5 %'), 'tung')
  assert.equal(planlagtSvaerhed('65%'), 'let')
  assert.equal(planlagtSvaerhed(''), null)
  assert.equal(planlagtSvaerhed(null), null)
})

test('flere hovedløft holdes adskilt; visningen er foldet ind og uden kg', () => {
  const bench = [6, 4, 2, 0].map(w => set(w, 100 - w, { name: 'Bænkpres' }))
  const m = paaSigtModel(props({ fremgangLogs: [...squat, ...bench] }), now)
  assert.deepEqual(m.lifts.map(l => l.lift), ['Squat', 'Bænkpres'])
  assert.match(m.lifts[1].text, /^Dit bænkpres er gået \d+ % frem på 6 uger\.$/)
  const html = renderToStaticMarkup(createElement(PaaSigtView, props({ fremgangLogs: [...squat, ...bench] })))
  assert.match(html, /<details[^>]*data-analysis-paa-sigt/)
  assert.doesNotMatch(html, /<details[^>]*\bopen/)
  assert.doesNotMatch(html, /\bkg\b|e1RM/)
  const rolig = renderToStaticMarkup(createElement(PaaSigtView, props({ fremgangLogs: [] })))
  assert.match(rolig, /data-paa-sigt-rolig/)
})
