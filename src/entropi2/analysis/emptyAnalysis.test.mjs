import test from 'node:test'
import assert from 'node:assert/strict'
import Analysis from './Analysis.mjs'
import DevelopmentView from './DevelopmentView.mjs'
import MineData from '../athlete/minedata/MineData.mjs'
import { weeklyShareSummary } from './weeklyShareSummary.mjs'
import { renderTree } from './testDom.mjs'

const now = new Date('2026-11-04T12:00:00Z')
const props = extra => ({ entropi2: true, now, athlete: { id: 'synthetic-a' },
  fremgangLogs: [], exerciseLogs: [], historicalMealLogs: [], weightLogs: [], ...extra })
const row = (day, extra = {}) => ({ exercise_id: `synthetic-${day}`, logged_at: day,
  weight: 100, reps_completed: 3,
  exercises: { name: 'Squat', sessions: { weeks: { block_name: 'Styrke' } } }, ...extra })
const view = extra => renderTree(Analysis(props(extra)))
const marked = (dom, key) => dom.querySelectorAll(`[${key}]`)

test('empty analysis has one friendly explanation, one optional help and no empty content folds', () => {
  const dom = view()
  assert.deepEqual(dom.querySelectorAll('h2').map(n => n.textContent), ['Din udvikling'])
  assert.equal(marked(dom, 'data-development')[0].querySelectorAll('p').length, 1)
  for (const key of ['data-analysis-secondary', 'data-analysis-more', 'data-analysis-mine-data',
    'data-analysis-intensity', 'data-analysis-rpe', 'data-analysis-share', 'data-analysis-records',
    'data-analysis-volume', 'data-fremgang-mine-tal']) assert.equal(marked(dom, key).length, 0, key)
  assert.equal(dom.querySelectorAll('figure').length, 0)
  assert.equal(marked(dom, 'data-analysis-help').length, 1)
  assert.equal((dom.textContent.match(/Programblokken skal være kendt/g) ?? []).length, 1)
  assert.doesNotMatch(dom.textContent, /Blok ukendt|Ingen reference|Ingen RPE-data|ukendt målstatus|0 svar/)
})

test('sparse historical observations retain 26 graph positions and only dated real detail rows', () => {
  const dom = view({ fremgangLogs: [row('2026-10-14'), row('2026-11-03', { weight: 110 })] })
  const primary = marked(dom, 'data-analysis-history')[0]
  assert.equal(marked(primary, 'data-history-value').length, 2)
  assert.deepEqual(marked(primary, 'data-history-value').map(n => n.textContent),
    ['14.10.2026: 110 kg e1RM', '03.11.2026: 121 kg e1RM'])
  const chart = primary.querySelectorAll('figure')[0]
  assert.equal(chart.querySelectorAll('span').length, 28) // 26 positions plus two axis labels
  assert.equal(marked(chart, 'data-history-bar').length, 2)
  assert.match(primary.textContent, /Uger uden data/)
  assert.doesNotMatch(primary.textContent, /Ingen sammenlignelige data|Blok ukendt|Ingen reference/)
})

test('light training retains measured volume without a strength chart or reference column', () => {
  const dom = view({ fremgangLogs: [row('2026-11-03', { reps_completed: 12 })] })
  const primary = marked(dom, 'data-analysis-history')[0]
  assert.equal(marked(primary, 'data-history-bar').length, 0)
  assert.equal(primary.querySelectorAll('figure').length, 1)
  assert.match(primary.textContent, /1.200 kg × reps/)
  assert.doesNotMatch(primary.textContent, /Sæt ≥80 %|Intensiteten kan ikke|Dødløft:|skøn/)
})

test('intensity is gated by independent supplied references, never by the same set estimate', () => {
  const base = { fremgangLogs: [row('2026-11-03')] }
  assert.equal(marked(view(base), 'data-analysis-intensity').length, 0)
  const dom = view({ fremgangLogs: [row('2026-11-03', { reference_e1rm: 125 })] })
  assert.equal(marked(dom, 'data-analysis-intensity').length, 1)
  assert.match(dom.textContent, /Sæt ≥80 %/)
  assert.match(dom.textContent, /1 af 1 registrerede sæt fordelt/)
})

test('RPE shows only weeks and series with confirmed athlete answers, including zero', () => {
  const input = [row('2026-11-03', { rpe_actual: 0, rpe_source: 'athlete' }),
    row('2026-10-14', { rpe_actual: 8, rpe_source: 'default' })]
  const card = marked(view({ fremgangLogs: input }), 'data-analysis-rpe')[0]
  assert.equal(card.querySelectorAll('li').length, 2) // all main lifts plus Squat
  assert.match(card.textContent, /RPE 0/)
  assert.doesNotMatch(card.textContent, /Ingen RPE-data|0 svar/)
  assert.equal(marked(view({ fremgangLogs: input.slice(1) }), 'data-analysis-rpe').length, 0)
})

test('logged food is visible without invented historical goal status', () => {
  const dom = view({ historicalMealLogs: [{ date: '2026-11-03', kcal: 500 }] })
  const mine = marked(dom, 'data-analysis-mine-data')[0]
  assert.match(mine.textContent, /Loggede kostdage1 registrerede dage af 28/)
  assert.doesNotMatch(mine.textContent, /Kostdage mod mål|ukendt målstatus|Ingen kostdage/)
  const ready = rows => ({ state: 'ready', rows })
  const explicit = renderTree(MineData({ athleteId: 'synthetic-a', today: '2026-11-04',
    nutritionDays: ready([{ athlete_id: 'synthetic-a', date: '2026-11-03', goalMet: false }]) }))
  assert.match(explicit.textContent, /Kostdage mod mål0 af 1/)
})

test('current program week sessions are labelled with their real coverage', () => {
  const dom = view({ currentWeek: { start_date: '2026-11-02', sessions: [
    { id: 's', exercises: [{ id: 'e', name: 'Squat', sets: 1 }] }] },
    exerciseLogs: [row('2026-11-03', { exercise_id: 'e', set_number: 1 })] })
  assert.match(marked(dom, 'data-analysis-mine-data')[0].textContent, /Pas i den viste programuge1 registrerede/)
  assert.doesNotMatch(dom.textContent, /samlet optælling for alle 4 uger/)
})

test('weekly report retains one weight observation and omits uncomputable changes and empty lifts', () => {
  const dom = view({ weightLogs: [{ athlete_id: 'synthetic-a', logged_at: '2026-11-03', weight: 80 }] })
  const report = marked(dom, 'data-entropi2-ugerapport')[0]
  assert.match(report.textContent, /Kropsvægt: 80 kg · 03.11.2026/)
  assert.doesNotMatch(report.textContent, /Vægtændring|mindst to|Ingen sammenlignelige|Kostdage logget:/)
})

test('share text contains only observed lines and an honest period', () => {
  assert.equal(weeklyShareSummary(props(), now), '')
  const text = weeklyShareSummary(props({ historicalMealLogs: [{ date: '2026-11-03', kcal: 0 }] }), now)
  assert.match(text, /^Ugesammendrag 02.11.2026 til 08.11.2026/)
  assert.match(text, /Kostdage logget: 1 af 7/)
  assert.doesNotMatch(text, /Pas gennemført|Tonnage|Bedste sæt|RPE|data mangler/)
})

test('real errors suppress retained history and remain actionable alerts', () => {
  const logs = ['2026-10-07', '2026-10-14', '2026-10-21', '2026-11-03'].map(day => row(day))
  for (const key of ['fremgangError', 'exerciseLogsError']) {
    const dom = view({ fremgangLogs: logs, [key]: true })
    assert.match(dom.textContent, /Din udvikling kunne ikke hentes/)
    assert.equal(marked(dom, 'data-analysis-value').length, 0)
    assert.equal(marked(dom, 'data-analysis-records').length, 0)
    assert.equal(dom.querySelectorAll('figure').length, 0)
  }
  const dom = view({ mealError: true, weightError: true })
  const mine = marked(dom, 'data-analysis-mine-data')[0]
  assert.equal((mine.textContent.match(/kunne ikke hentes/g) ?? []).length, 1)
  assert.equal(mine.querySelectorAll('[role]')[0].getAttribute('role'), 'alert')
})

test('no meet hides the forecast; insufficient real meets contain no made up numbers', () => {
  const logs = [row('2026-11-03')]
  const noMeet = renderTree(DevelopmentView(props({ fremgangLogs: logs })))
  assert.doesNotMatch(noMeet.textContent, /Frem mod næste stævne|Intet kommende stævne/)
  const realMeet = renderTree(DevelopmentView(props({ fremgangLogs: logs,
    athlete: { id: 'synthetic-a', competition_date: '2026-11-18' } })))
  assert.match(realMeet.textContent, /Planlagt stævne: 18.11.2026/)
  assert.doesNotMatch(realMeet.textContent, /Squat: skøn|Squat: for lidt|Bænkpres:/)
})

test('strict OFF is inert and the sole empty-state shortcut retains callback return and errors', () => {
  assert.equal(Analysis({ entropi2: false, get trackingSnapshot() { throw Error('OFF') } }), null)
  const calls = []
  const dom = view({ setTab: tab => { calls.push(tab); return 'routed' } })
  const buttons = marked(dom, 'data-analysis-destination')
  assert.equal(buttons.length, 1)
  assert.equal(buttons[0].dispatchEvent({ type: 'click' }), 'routed')
  assert.deepEqual(calls, ['program'])
})

test('recorded sets without a numeric volume do not create an empty chart', () => {
  const dom = renderTree(DevelopmentView(props({ fremgangLogs: [row('2026-11-03', { weight: null })] })))
  assert.equal(dom.querySelectorAll('figure').length, 0)
  assert.match(dom.textContent, /Volumen kan ikke beregnes/)
})
