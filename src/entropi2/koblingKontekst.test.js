// Entropi 2-kobling runde 3: læsekontekst (fund 1) og én mobilitetsvisning (fund 4).
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { entropi2ReadContext, entropi2ReadContextDeps, useEntropi2ReadContext } from './coachReadContext.mjs'
import { coachHomeModel } from './coach/coachModel.mjs'
import { activityDay } from '../dashboard/coachInactive.mjs'

const read = name => readFileSync(new URL(name, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const evening = new Date(2026, 10, 2, 23, 50)
const afterMidnight = new Date(2026, 10, 3, 0, 10)
const athletes = [{ id: 'syn-a', name: 'Syntetisk A' }]
const session = { user: { id: 'syn-coach' } }
const ready = { enabled: true, loading: false, loadError: false, coachId: 'syn-coach', athletes, calendarStatus: 'ready' }
// En uge der startede for fem dage siden: programmet slutter inden for syv dage.
const weeksFor = now => {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 5)
  return { 'syn-a': [{ id: 'syn-w1', athlete_id: 'syn-a', week_number: 1, start_date: activityDay(start), exercise_count: 3 }] }
}

// Samme sammenligning som Reacts useMemo: genbrug, så længe alle afhængigheder er Object.is-ens.
function memo() {
  let deps = null, value
  return (input, now) => {
    const next = entropi2ReadContextDeps(input)
    if (!deps || next.length !== deps.length || next.some((d, i) => !Object.is(d, deps[i]))) {
      deps = next
      value = entropi2ReadContext({ ...input, athleteIds: input.athletes.map(a => a.id), now })
    }
    return value
  }
}
const model = (readContext, calendarWeeks, today) => coachHomeModel({ session, athletes, readContext, calendarWeeks,
  loading: false, loadError: false, coachActionsStatus: { calendar: 'ready' } }, today)
const programActions = m => m.actions.filter(a => a.tab === 'program')

test('F1: kontekst fra kalenderlæsningen samme dag giver kalenderhandling', () => {
  const calendarWeeks = weeksFor(evening)
  const context = memo()({ ...ready, calendarWeeks }, evening)
  assert.deepEqual(context, { coachId: 'syn-coach', athleteIds: ['syn-a'], day: activityDay(evening) })
  const m = model(context, calendarWeeks, evening)
  assert.equal(m.calendarReady, true)
  assert.equal(programActions(m).length, 1)
})

test('F1: gammel kontekst efter dagsskifte uden ny læsning giver ingen kalenderhandling', () => {
  const calendarWeeks = weeksFor(evening)
  const cached = memo()
  const first = cached({ ...ready, calendarWeeks }, evening)
  // Ny gengivelse efter midnat med samme kalenderlæsning: konteksten genbruges med gårsdagens dag.
  const later = cached({ ...ready, calendarWeeks }, afterMidnight)
  assert.equal(later, first)
  assert.equal(later.day, activityDay(evening))
  const m = model(later, calendarWeeks, afterMidnight)
  assert.equal(m.calendarReady, false)
  assert.equal(programActions(m).length, 0)
  assert.equal(m.complete, false)
  // Først en ny kalenderlæsning (nyt objekt) giver dagens kontekst og handlingen tilbage.
  const freshWeeks = weeksFor(afterMidnight)
  const fresh = cached({ ...ready, calendarWeeks: freshWeeks }, afterMidnight)
  assert.notEqual(fresh, first)
  assert.equal(fresh.day, activityDay(afterMidnight))
  assert.equal(model(fresh, freshWeeks, afterMidnight).calendarReady, true)
})

test('F1: afhængighederne indeholder ingen tid, men skifter ved læsning, ejer, atleter og status', () => {
  const calendarWeeks = weeksFor(evening)
  const base = entropi2ReadContextDeps({ ...ready, calendarWeeks })
  assert.deepEqual(entropi2ReadContextDeps({ ...ready, calendarWeeks }), base)
  for (const change of [{ calendarWeeks: { ...calendarWeeks } }, { coachId: 'syn-other' },
    { athletes: [...athletes, { id: 'syn-b' }] }, { calendarStatus: 'loading' }, { loading: true }, { loadError: true }, { enabled: false }]) {
    const next = entropi2ReadContextDeps({ ...ready, calendarWeeks, ...change })
    assert.ok(next.some((d, i) => !Object.is(d, base[i])), JSON.stringify(Object.keys(change)))
  }
})

test('F1: ingen kontekst før kalenderen er læst, ved fejl, uden ejer eller med flaget slukket', () => {
  for (const change of [{ calendarStatus: 'loading' }, { calendarStatus: 'error' }, { calendarStatus: undefined },
    { loading: true }, { loadError: true }, { coachId: undefined }, { coachId: '' }, { enabled: false }, { enabled: 'true' }])
    assert.equal(entropi2ReadContext({ ...ready, athleteIds: ['syn-a'], ...change }), undefined, JSON.stringify(change))
})

test('F1: den faktiske hook giver samme kontekst i en faktisk React-gengivelse', () => {
  let seen
  const Probe = () => { seen = useEntropi2ReadContext({ ...ready, calendarWeeks: weeksFor(new Date()) }); return null }
  renderToString(createElement(Probe))
  assert.deepEqual(seen, { coachId: 'syn-coach', athleteIds: ['syn-a'], day: activityDay(new Date()) })
  renderToString(createElement(() => { seen = useEntropi2ReadContext({ ...ready, enabled: false, calendarWeeks: {} }); return null }))
  assert.equal(seen, undefined)
})

test('F1: Dashboard binder coachskærmens kontekst til hooken med kalenderlæsning og status', () => {
  const source = read('../Dashboard.jsx')
  assert.match(source, /const e2ReadContext = useEntropi2ReadContext\(\{ enabled: e2, loading, loadError, coachId: session\?\.user\?\.id, athletes, calendarWeeks, calendarStatus: coachActionsStatus\.calendar \}\)/)
  assert.match(source, /readContext=\{e2ReadContext\} \/>/)
  assert.doesNotMatch(source, /day: activityDay\(\)/)
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
