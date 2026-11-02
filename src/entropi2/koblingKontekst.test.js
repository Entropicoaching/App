// Entropi 2-kobling runde 3 og 4: læsekontekst (fund 1) og én mobilitetsvisning (fund 4).
import test, { mock } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { entropi2CalendarRead, entropi2ReadContext, useEntropi2ReadContext } from './coachReadContext.mjs'
import { coachHomeModel } from './coach/coachModel.mjs'
import { activityDay } from '../dashboard/coachInactive.mjs'

const read = name => readFileSync(new URL(name, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const evening = new Date(2026, 10, 2, 23, 50)
const afterMidnight = new Date(2026, 10, 3, 0, 10)
const athletes = [{ id: 'syn-a', name: 'Syntetisk A' }]
const session = { user: { id: 'syn-coach' } }
// En uge der startede for fem dage siden: programmet slutter inden for syv dage.
const weeksFor = now => {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 5)
  return { 'syn-a': [{ id: 'syn-w1', athlete_id: 'syn-a', week_number: 1, start_date: activityDay(start), exercise_count: 3 }] }
}
// Afslutter en kalenderlæsning på tidspunktet `at` og giver den status, læseren ville efterlade.
function completedRead(calendarWeeks, at, { coachId = 'syn-coach', athleteIds = ['syn-a'] } = {}) {
  let status = {}
  const setStatus = fn => { status = fn(status) }
  const handle = entropi2CalendarRead({ enabled: true, coachId, athleteIds, setStatus })
  mock.timers.enable({ apis: ['Date'], now: at })
  try { handle.done(calendarWeeks) } finally { mock.timers.reset() }
  return { ...status, calendar: 'ready' }
}
const input = (calendarWeeks, coachActionsStatus, extra = {}) => ({ enabled: true, loading: false, loadError: false,
  coachId: 'syn-coach', athletes, calendarWeeks, coachActionsStatus, coachMorningData: {}, ...extra })
const model = (readContext, calendarWeeks, today) => coachHomeModel({ session, athletes, readContext, calendarWeeks,
  loading: false, loadError: false, coachActionsStatus: { calendar: 'ready' } }, today)
const programActions = m => m.actions.filter(a => a.tab === 'program')

test('F1: kontekst fra kalenderlæsningen samme dag giver kalenderhandling', () => {
  const calendarWeeks = weeksFor(evening)
  const context = entropi2ReadContext(input(calendarWeeks, completedRead(calendarWeeks, evening)))
  assert.deepEqual(context, { coachId: 'syn-coach', athleteIds: ['syn-a'], day: activityDay(evening) })
  const m = model(context, calendarWeeks, evening)
  assert.equal(m.calendarReady, true)
  assert.equal(programActions(m).length, 1)
})

test('F1: gammel kontekst efter dagsskifte uden ny læsning giver ingen kalenderhandling', () => {
  const calendarWeeks = weeksFor(evening)
  const status = completedRead(calendarWeeks, evening)
  const first = entropi2ReadContext(input(calendarWeeks, status))
  // Ny gengivelse efter midnat med samme kalenderlæsning: konteksten er læsningens egen, med gårsdagens dag.
  mock.timers.enable({ apis: ['Date'], now: afterMidnight })
  let later
  try { later = entropi2ReadContext(input(calendarWeeks, status)) } finally { mock.timers.reset() }
  assert.equal(later, first)
  assert.equal(later.day, activityDay(evening))
  const m = model(later, calendarWeeks, afterMidnight)
  assert.equal(m.calendarReady, false)
  assert.equal(programActions(m).length, 0)
  assert.equal(m.complete, false)
  // Først en ny kalenderlæsning giver dagens kontekst og handlingen tilbage.
  const freshWeeks = weeksFor(afterMidnight)
  const fresh = entropi2ReadContext(input(freshWeeks, completedRead(freshWeeks, afterMidnight)))
  assert.notEqual(fresh, first)
  assert.equal(fresh.day, activityDay(afterMidnight))
  assert.equal(model(fresh, freshWeeks, afterMidnight).calendarReady, true)
})

test('F1: konteksten invalideres ved ejer-, scope-, kalender- og statusskift, men ommærkes aldrig', () => {
  const two = [...athletes, { id: 'syn-b', name: 'Syntetisk B' }]
  const calendarWeeks = { ...weeksFor(evening), 'syn-b': [] }
  const status = completedRead(calendarWeeks, evening, { athleteIds: ['syn-a', 'syn-b'] })
  const context = entropi2ReadContext(input(calendarWeeks, status, { athletes: two }))
  assert.equal(context.day, activityDay(evening))
  // Omordnet atletliste er samme scope: samme objekt, samme dag; ingen ny dag fra gengivelsen.
  assert.equal(entropi2ReadContext(input(calendarWeeks, status, { athletes: [...two].reverse() })), context)
  for (const change of [{ coachId: 'syn-other' }, { athletes }, { athletes: [...two, { id: 'syn-c' }] },
    { calendarWeeks: { ...calendarWeeks } }, { coachActionsStatus: { ...status, calendar: 'loading' } },
    { coachActionsStatus: { ...status, e2Calendar: { token: {} } } },
    { coachActionsStatus: { ...status, activity: { state: 'loading' } } },
    { coachMorningData: { messages: { state: 'loading' } } }, { coachMorningData: { videos: { state: 'loading' } } }])
    assert.equal(entropi2ReadContext({ ...input(calendarWeeks, status, { athletes: two }), ...change }), undefined, JSON.stringify(Object.keys(change)))
})

test('F1: ingen kontekst før kalenderen er læst, ved fejl, uden ejer eller med flaget slukket', () => {
  const calendarWeeks = weeksFor(evening)
  const status = completedRead(calendarWeeks, evening)
  for (const change of [{ coachActionsStatus: { calendar: 'ready' } }, { coachActionsStatus: { ...status, calendar: 'error' } },
    { coachActionsStatus: { ...status, calendar: undefined } }, { coachActionsStatus: undefined },
    { loading: true }, { loadError: true }, { coachId: undefined }, { coachId: '' }, { enabled: false }, { enabled: 'true' }])
    assert.equal(entropi2ReadContext({ ...input(calendarWeeks, status), ...change }), undefined, JSON.stringify(change))
  // Slukket læser: ingen handle og ingen statusskrivning.
  let writes = 0
  assert.equal(entropi2CalendarRead({ enabled: false, coachId: 'syn-coach', athleteIds: ['syn-a'], setStatus: () => { writes++ } }), null)
  assert.equal(writes, 0)
})

test('F1: konteksten læses uden tid og memo, også i en faktisk React-gengivelse', () => {
  const calendarWeeks = weeksFor(new Date())
  const status = completedRead(calendarWeeks, new Date())
  let seen
  const Probe = () => { seen = useEntropi2ReadContext(input(calendarWeeks, status)); return null }
  renderToString(createElement(Probe))
  assert.equal(seen, status.e2Calendar.context)
  renderToString(createElement(() => { seen = useEntropi2ReadContext(input(calendarWeeks, status, { enabled: false })); return null }))
  assert.equal(seen, undefined)
  const source = read('./coachReadContext.mjs')
  assert.doesNotMatch(source, /from 'react'|useMemo|new Date/)
})

test('F1: Dashboard binder coachskærmens kontekst til læseresultatet og giver kun læseren funktionen med flaget', () => {
  const source = read('../Dashboard.jsx')
  assert.match(source, /const e2ReadContext = useEntropi2ReadContext\(\{ enabled: e2, loading, loadError, coachId: session\?\.user\?\.id, athletes, calendarWeeks, coachActionsStatus, coachMorningData \}\)/)
  assert.match(source, /\.\.\.\(e2 \? \{ entropi2CalendarRead \} : \{\}\),\n {2}\}\)/)
  assert.match(source, /readContext=\{e2ReadContext\} \/>/)
  assert.doesNotMatch(source, /day: activityDay\(\)/)
  const reader = read('../dashboard/laesninger.js')
  assert.match(reader, /typeof entropi2CalendarRead === 'function' && coachActionsEnabled\(coachActions\)/)
  assert.equal(reader.match(/e2Read\?\.done\(/g).length, 2)
})

// Fund 4: de præcise betingelser for alle mobilitetsgrene i AthleteView evalueres.
test('F4: med flaget tændt vises præcis én mobilitetsvisning; slukket er de gamle grene uændrede', () => {
  const lines = read('../AthleteView.jsx').split('\n')
    .filter(line => /^ {8}\{.*tab === 'mobilisering'.*&& \($/.test(line))
  assert.equal(lines.length, 3, lines.join('\n'))
  const branches = lines.map(line => new Function('e2Atlet', 'tab', 'compactHomework', 'mobilityMode',
    'return Boolean(' + line.trim().slice(1, -4) + ')'))
  const old = [
    (tab, compactHomework, mobilityMode) => compactHomework && tab === 'mobilisering' && mobilityMode === 'hjemmeoevelser',
    (tab, compactHomework, mobilityMode) => tab === 'mobilisering' && !(compactHomework && mobilityMode === 'hjemmeoevelser'),
  ]
  for (const tab of ['mobilisering', 'hjem'])
    for (const compactHomework of [false, true])
      for (const mobilityMode of [null, 'hjemmeoevelser', 'andet']) {
        const on = branches.filter(branch => branch(true, tab, compactHomework, mobilityMode)).length
        assert.equal(on, tab === 'mobilisering' ? 1 : 0, `ON ${tab} ${compactHomework} ${mobilityMode}`)
        const off = branches.map(branch => branch(false, tab, compactHomework, mobilityMode))
        assert.equal(off[0], false, 'Entropi 2-skærmen er slukket uden flaget')
        assert.deepEqual(off.slice(1), old.map(branch => Boolean(branch(tab, compactHomework, mobilityMode))))
      }
  assert.match(lines[0], /^ {8}\{e2Atlet && tab === 'mobilisering' && \($/)
})
