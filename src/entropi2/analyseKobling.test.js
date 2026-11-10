// Entropi 2-samling: analysen (R2-ENTROPI2-ANALYSE) øverst i atletens fremgang-fane bag flaget entropi2.
// Faktiske moduler og rigtig React; syntetiske data. Ingen browser, net eller database.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import Analysis from './analysis/Analysis.mjs'
import { Entropi2Analysis } from './athleteEntry.mjs'

const read = name => readFileSync(new URL(name, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const now = new Date('2026-11-01T12:00:00Z')
const log = (day, weight) => ({ exercise_id: `syn-${day}`, logged_at: day + 'T10:00:00Z', weight, reps_completed: 3,
  exercises: { name: 'Squat', sessions: { weeks: { block_name: 'Styrke' } } } })
const fremgangLogs = ['2026-10-04', '2026-10-11', '2026-10-18', '2026-10-25'].map((d, i) => log(d, 100 + i * 5))
const athlete = { id: 'syn-atlet' }
const nodes = n => !n || typeof n !== 'object' ? [] : [n, ...[].concat(n.props?.children ?? []).flatMap(nodes)]

test('ANALYSE: athleteEntry eksporterer præcis den faktiske Analysis-komponent', () => {
  assert.equal(Entropi2Analysis, Analysis)
  assert.match(read('./athleteEntry.mjs'), /^export \{ default as Entropi2Analysis \} from '\.\/analysis\/Analysis\.mjs'$/m)
})

test('ANALYSE: med entropi2 true vises analysen; ellers gengives intet', () => {
  const props = { athlete, currentWeek: null, exerciseLogs: [], fremgangLogs, fremgangLoading: false, setTab() {}, now }
  const html = renderToString(createElement(Entropi2Analysis, { ...props, entropi2: true }))
  assert.match(html, /data-entropi2-analysis/)
  assert.match(html, /Din analyse/)
  for (const entropi2 of [false, undefined, 'true', 1])
    assert.equal(renderToString(createElement(Entropi2Analysis, { ...props, entropi2 })), '', String(entropi2))
})

test('ANALYSE: knapperne kalder den eksisterende setTab med hjem, hjem og program', () => {
  const calls = []
  const tree = Entropi2Analysis({ entropi2: true, athlete, currentWeek: null, exerciseLogs: [], fremgangLogs,
    fremgangLoading: false, setTab: tab => calls.push(tab), now })
  const buttons = nodes(tree).filter(n => n.type === 'button' && n.props['data-analysis-destination'])
  assert.equal(buttons.length, 3)
  for (const button of buttons) button.props.onClick()
  assert.deepEqual(calls, ['hjem', 'hjem', 'program'])
  // Uden setTab vises ingen navigationsknapper; deling er en separat handling.
  const without = Entropi2Analysis({ entropi2: true, athlete, fremgangLogs, now })
  assert.equal(nodes(without).filter(n => n.type === 'button' && n.props['data-analysis-destination']).length, 0)
})

test('ANALYSE: AthleteView viser analysen øverst i fremgang-fanen kun med e2Atlet og eksisterende state', () => {
  const source = read('../AthleteView.jsx')
  const block = `        {/* FREMGANG */}
        {e2Atlet && tab === 'fremgang' && (
          <Entropi2Analysis entropi2={true} athlete={athlete} currentWeek={currentWeek} exerciseLogs={exerciseLogs}
            fremgangLogs={fremgangLogs} fremgangLoading={fremgangLoading} setTab={setTab}
            historicalMealLogs={historicalMealLogs} weightLogs={weightLogs}
            weightStatus={weightStatus} retryWeight={retryWeight}
            u3Client={inboxDatabase}
            trackingSnapshot={trackingSnapshot} onRetryTracking={onRetryTracking} readOnly={e2ReadOnly} />
        )}
        {tab === 'fremgang' && (
          <LazyBoundary
`
  assert.equal(source.split(block).length, 2)
  assert.equal(source.split('<Entropi2Analysis ').length, 2)
  assert.match(source, /import \{ [^}]*\bEntropi2Analysis\b[^}]* \} from '\.\/entropi2\/athleteEntry\.mjs'/)
  // Betingelsen evalueres: kun fremgang-fanen med e2Atlet.
  const line = source.split('\n').find(l => l.includes("{e2Atlet && tab === 'fremgang' && ("))
  const show = new Function('e2Atlet', 'tab', 'return Boolean(' + line.trim().slice(1, -4) + ')')
  assert.equal(show(true, 'fremgang'), true)
  for (const [e2Atlet, tab] of [[false, 'fremgang'], [true, 'hjem'], [true, 'kost'], [false, 'hjem']])
    assert.equal(show(e2Atlet, tab), false, `${e2Atlet} ${tab}`)
})
