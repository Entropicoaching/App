import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { dashboardKilde, DASHBOARD_MODULER } from '../../scripts/dashboardKilde.mjs'
import { openReadinessSurface, readinessNavigation } from './readinessShortcut.mjs'
import { previewNavigation } from './enkelPrototype.mjs'
import { weightTrendText } from './weightTrend.mjs'
import { checkinNoteTimingText } from '../readinessInsight.js'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const athlete = read('../AthleteView.jsx')
const enkel = read('./EnkelHjemTab.jsx')

// Import exact JS declarations from the pinned candidate. No JSX compilation,
// React runtime, backend or copied implementation is used in this probe.
async function declarations(source, names, setup = '') {
  const module = `${setup}\n${source}\nexport { ${names.join(', ')} }`
  return import('data:text/javascript;base64,' + Buffer.from(module).toString('base64'))
}

test('F1: dashboard source collection includes the moved status handler exactly once', () => {
  assert.equal(DASHBOARD_MODULER.filter(x => x === 'dashboard/videoReviewStatus.mjs').length, 1)
  const handler = read('../dashboard/videoReviewStatus.mjs')
  const collected = dashboardKilde().replace(/\r\n/g, '\n')
  assert.ok(collected.includes(handler.replace(/(from\s+')\.\.\//g, '$1./')))
  assert.match(collected, /Den personlige sammenligning matcher ikke/)
})

test('F2: all three affected test modules are reachable from discovered test.js files', async () => {
  const files = readdirSync(new URL('.', import.meta.url)).filter(name => name.endsWith('.test.js'))
  for (const stem of ['readinessShortcut', 'weightTrend', 'vaerdTekst']) {
    assert.ok(files.includes(`${stem}.test.js`))
    assert.equal(read(`./${stem}.test.js`).trim(), `import './${stem}.test.mjs'`)
  }
  assert.ok(!process.exitCode)
})

test('F3: default view stays eager; enabled view passes props and a deferred factory to LazyBoundary', async () => {
  assert.doesNotMatch(athlete, /^import\s+.*from\s+['"].*Enkel(?:Hjem|Fremgang)Tab/m)
  assert.match(athlete, /enkelPrototype = false/)
  assert.match(athlete, /const enkelOn = enkelPrototype === true/)
  const factory = athlete.match(/^const enkelHjemFactory = .+$/m)?.[0]
  const wrapper = athlete.match(/function LazyEnkelHjemTab\(props\) \{[\s\S]*?\n\}/)?.[0]
  const selection = athlete.match(/const HjemVisning = .+$/m)?.[0]
  assert.ok(factory && wrapper && selection)
  const m = await declarations(`${factory}\n${wrapper}\nfunction select(enkelOn) { ${selection}; return HjemVisning }`,
    ['select', 'LazyEnkelHjemTab'],
    `const HjemTab = 'legacy'; const LazyBoundary = 'boundary';
     const createElement = (type, props) => ({ type, props });`)
  for (const enabled of [false, true]) {
    const selected = m.select(enabled)
    if (!enabled) { assert.equal(selected, 'legacy'); continue }
    const props = { tab: 'hjem', enkelDel: 'traening', readinessInput: { sleep: '7' } }
    const node = selected(props)
    assert.equal(node.type, 'boundary')
    assert.strictEqual(node.props.componentProps, props)
    assert.equal(typeof node.props.factory, 'function')
    assert.match(String(node.props.factory), /import\('\.\/athlete\/EnkelHjemTab(?:\.jsx)?'\)/)
  }
  assert.match(athlete, /factory=\{fremgangFokus === true \? fremgangFokusFactory : enkelOn \? enkelFremgangFactory : fremgangFactory\}/)
})

test('F4: effect suppression immediately precedes the message effect; readiness action remains executable', async () => {
  assert.match(athlete, /\/\/ eslint-disable-next-line react-hooks\/exhaustive-deps -- begge kaldes synkront[^\n]*\n\s*useEffect\(/)
  const statement = athlete.match(/const openReadiness = .+$/m)?.[0]
  assert.ok(statement)
  const m = await declarations(`function action(enkelOn, setTab, legacyOpenReadiness) { ${statement}; return openReadiness }`, ['action'])
  const calls = []
  m.action(true, x => calls.push(x), () => calls.push('legacy'))()
  m.action(false, x => calls.push(x), () => calls.push('legacy'))()
  assert.deepEqual(calls, ['dagsform', 'legacy'])
})

test('F5: Enkel uses current timing and weight helpers with actual candidate call statements', async () => {
  assert.match(enkel, /import \{ weightTrendText \} from '\.\/weightTrend.mjs'/)
  assert.match(enkel, /import \{[^\n]*checkinNoteTimingText[^\n]*\} from '\.\.\/readinessInsight(?:\.js)?'/)
  assert.doesNotMatch(enkel, /Sidst det gjorde en forskel|siden forrige uge/)
  assert.match(enkel, /\{noteTiming.heading\}/)
  assert.match(enkel, /\{noteTiming.description\}/)
  assert.match(enkel, /\{trendText\}/)
  const timing = enkel.match(/const noteTiming = .+$/m)?.[0]
  const trend = enkel.match(/const trendText = .+$/m)?.[0]
  assert.ok(timing && trend)
  const m = await declarations(`function display(planChange, fmtD, sorted, checkinNoteTimingText, weightTrendText) {
    ${timing}; ${trend}; return { noteTiming, trendText }
  }`, ['display'])
  const change = { checkinDate: '2026-10-20', weekStartDate: '2026-10-26' }
  const rows = Array.from({ length: 8 }, (_, i) => ({ logged_at: `2026-10-${String(i + 1).padStart(2, '0')}`, weight: i ? 82 : 80 }))
  const result = m.display(change, x => x, rows, checkinNoteTimingText, weightTrendText)
  assert.equal(result.noteTiming.heading, 'Coachnote efter et check-in')
  assert.match(result.noteTiming.description, /Datoerne viser kun/)
  assert.match(result.trendText, /7 vejninger.*1 vejning/)
  assert.deepEqual(m.display(null, x => x, [], checkinNoteTimingText, weightTrendText), { noteTiming: null, trendText: null })
})

test('F6: leaving and returning closes shortcut in both navigation modes and preserves input', () => {
  assert.match(athlete, /const setTab = readinessNavigation\(destination => navigate\(kostDestination\(destination, visKost\)\), setReadinessOpen\)/)
  for (const enabled of [false, true]) {
    const input = { sleep: '7,5', energy: 3 }
    const state = { tab: 'hjem', route: 'traening', open: false, input }
    const go = readinessNavigation(previewNavigation(enabled, x => state.tab = x, x => state.route = x), x => state.open = x)
    openReadinessSurface({ setTab: go, setMereOpen() {}, setReadinessOpen: x => state.open = x,
      readinessCardRef: { current: null }, requestFrame() {} })
    assert.equal(state.open, true)
    go('program'); assert.equal(state.open, false)
    go('hjem'); assert.equal(state.open, false)
    assert.strictEqual(state.input, input)
    assert.deepEqual(state.input, { sleep: '7,5', energy: 3 })
    assert.equal(state.tab, 'hjem')
    if (enabled) assert.equal(state.route, 'traening')
  }
})
