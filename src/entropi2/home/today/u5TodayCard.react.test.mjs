import test from 'node:test'
import assert from 'node:assert/strict'
import { createDocument, elements, click } from '../../onboarding/firstVisitDom.mjs'

// Ægte React og ReactDOM på det syntetiske dokument, som forsidens øvrige prøver bruger.
let React, act, render, createRoot, TodayCard, Home, missing = false
try {
  React = await import('react'); ({ act } = React)
  ;({ renderToStaticMarkup: render } = await import('react-dom/server'))
  ;({ createRoot } = await import('react-dom/client'))
} catch (error) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND' || !/Cannot find package '(react|react-dom)'/.test(error.message)) throw error
  missing = true
}
if (!missing) {
  ;({ default: TodayCard } = await import('./TodayCard.mjs'))
  ;({ default: Home } = await import('../AthleteHome.mjs'))
}
const gate = { skip: missing ? 'Kræver ægte React.' : false }
const h = (...a) => React.createElement(...a)
const A = 'atlet-syntetisk-u5'
const today = '2026-11-10'
const trackingData = { status: 'ready', complete: true, athleteId: A, today,
  readinessRows: [{ athlete_id: A, logged_date: '2026-11-08', energy: 2, motivation: 4, stress: 2, soreness_level: 3, sleep_hours: 7 }] }

// Værten efterligner AthleteView: udkast i state, logWeight/saveReadiness læser udkastet fra seneste render.
function hostFor(writes, extra = {}) {
  return function Host() {
    const [weightInput, setWeightInput] = React.useState('')
    const [readinessInput, setReadinessInput] = React.useState({})
    const [weightLogs, setWeightLogs] = React.useState([{ athlete_id: A, logged_at: '2026-11-09', weight: 82.5 }])
    const [readinessLog, setReadinessLog] = React.useState(null)
    return h(TodayCard, { athlete: { id: A }, today, trackingData, u5GraceMs: 20, ...extra,
      weightInput, setWeightInput, weightLogs, readinessInput, setReadinessInput, readinessLog,
      logWeight: async () => { writes.push(['weight_logs', weightInput]); setWeightLogs(l => [...l, { athlete_id: A, logged_at: today, weight: Number(weightInput.replace(',', '.')) }]); setWeightInput('') },
      saveReadiness: async () => { writes.push(['readiness_logs', { ...readinessInput }]); setReadinessLog({ athlete_id: A, logged_date: today, energy: Number(readinessInput.energy) }) } })
  }
}
async function mount(node) {
  const doc = createDocument(), host = doc.createElement('div')
  const priorWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  Object.defineProperty(globalThis, 'window', { configurable: true, value: doc.defaultView })
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  const root = createRoot(host)
  await act(async () => root.render(node))
  return { host, text: () => host.textContent, async done() {
    await act(async () => root.unmount())
    if (priorWindow) Object.defineProperty(globalThis, 'window', priorWindow); else delete globalThis.window
  } }
}
const tap = async (host, label) => act(async () => { click(host, label); await new Promise(r => setTimeout(r, 0)) })

test('U5 2/4: vægt gemmes på ét tryk med seneste vægt, ±0,1 justerer', gate, async () => {
  const writes = [], m = await mount(h(hostFor(writes)))
  try {
    assert.match(m.text(), /Mangler i dag: vægt og dagsform/)
    await tap(m.host, '+0,1')
    await tap(m.host, 'Gem 82,6 kg')
    assert.deepEqual(writes, [['weight_logs', '82,6']])
    assert.match(m.text(), /Mangler i dag: dagsform/)
    assert.match(m.text(), /Klaret: vægt ✓/)
  } finally { await m.done() }
})

test('U5 2/4: dagsform gemmes på ét energitryk efter 5 sekunders fortryd, resten fra seneste række', gate, async () => {
  const writes = [], m = await mount(h(hostFor(writes)))
  try {
    await tap(m.host, '4')
    assert.match(m.text(), /Energi 4 gemmes om 5 sek\./)
    await tap(m.host, 'Fortryd')
    await act(async () => new Promise(r => setTimeout(r, 40)))
    assert.deepEqual(writes, [])
    await tap(m.host, '3')
    await act(async () => new Promise(r => setTimeout(r, 40)))
    await act(async () => new Promise(r => setTimeout(r, 0)))
    assert.deepEqual(writes, [['readiness_logs', { sleep: '', energy: '3', motivation: '4', stress: '2', soreness: '3' }]])
    assert.match(m.text(), /Klaret: dagsform ✓/)
  } finally { await m.done() }
})

test('U5 2/4: uden historik skrives vægten, og dagsform åbner den fulde formular', gate, async () => {
  const html = render(h(TodayCard, { athlete: { id: A }, today, trackingData: { ...trackingData, readinessRows: [] },
    weightLogs: [], logWeight() {}, setWeightInput() {}, saveReadiness() {}, setReadinessInput() {} }))
  assert.match(html, /aria-label="Vægt i kg"/)
  assert.match(html, /Udfyld dagsform/)
  assert.doesNotMatch(html, /Gem undefined|NaN/)
})

test('U5 2/4: forsiden viser kortet øverst kun med flaget, aldrig i forhåndsvisning', gate, () => {
  const props = { enabled: true, athlete: { id: A, name: 'Syntetisk Atlet' }, now: new Date('2026-11-10T12:00:00Z'), storage: null,
    weightLogs: [], readinessLog: null, setReadinessInput() {}, setWeightInput() {}, saveReadiness() {}, logWeight() {},
    readHomeReadiness: async () => ({ status: 'loading' }) }
  assert.doesNotMatch(render(h(Home, props)), /data-u5-today/)
  assert.doesNotMatch(render(h(Home, { ...props, u5Today: false })), /data-u5-today/)
  const on = render(h(Home, { ...props, u5Today: true }))
  assert.match(on, /data-u5-today/)
  assert.ok(on.indexOf('data-u5-today') < on.indexOf('aria-label="Dit næste pas"'))
  assert.doesNotMatch(render(h(Home, { ...props, u5Today: true, sessionReadOnly: true })), /data-u5-today/)
})
