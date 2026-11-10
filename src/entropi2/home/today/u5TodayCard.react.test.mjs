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
    assert.deepEqual(writes, [['readiness_logs', { sleep: '', energy: '3', motivation: '4', stress: '2', soreness: '3', soreZones: [] }]])
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
  // Fra U5 4/4 er standarden tændt; slukket kræver en eksplicit false.
  const props = { enabled: true, athlete: { id: A, name: 'Syntetisk Atlet' }, now: new Date('2026-11-10T12:00:00Z'), storage: null,
    weightLogs: [], readinessLog: null, setReadinessInput() {}, setWeightInput() {}, saveReadiness() {}, logWeight() {},
    readHomeReadiness: async () => ({ status: 'loading' }) }
  assert.doesNotMatch(render(h(Home, { ...props, u5Today: false })), /data-u5-today/)
  const on = render(h(Home, { ...props, u5Today: true }))
  assert.match(on, /data-u5-today/)
  assert.ok(on.indexOf('data-u5-today') < on.indexOf('aria-label="Dit næste pas"'))
  assert.doesNotMatch(render(h(Home, { ...props, u5Today: true, sessionReadOnly: true })), /data-u5-today/)
})

// Syntetisk klient med samme kædeform som Supabase; registrerer skrivninger.
function fakeClient(tables, writes) {
  return { from(name) {
    const q = { filters: [], select() { return q }, eq(k, v) { q.filters.push(r => r[k] === v); return q },
      gte(k, v) { q.filters.push(r => r[k] >= v); return q }, lte(k, v) { q.filters.push(r => r[k] <= v); return q },
      order() { return q }, limit() { return q },
      insert(row) { writes.push([name, row]); (tables[name] ||= []).push(row); return Promise.resolve({ error: null, data: [row] }) },
      then(ok, fail) { return Promise.resolve({ error: null, data: (tables[name] || []).filter(r => q.filters.every(f => f(r))) }).then(ok, fail) } }
    return q
  } }
}

test('U5 3/4: mad logges på ét tryk som i går gennem meal_logs', gate, async () => {
  const writes = [], tables = { meal_logs: [
    { athlete_id: A, date: '2026-11-09', meal: 'Havregrød', kcal: 400, protein: 20, carb: 60, fat: 8 },
    { athlete_id: A, date: '2026-11-09', meal: 'Kylling og ris', kcal: 650, protein: 45, carb: 70, fat: 15 }] }
  const m = await mount(h(TodayCard, { athlete: { id: A }, today, u5Client: fakeClient(tables, writes), setTab() {} }))
  try {
    await act(async () => new Promise(r => setTimeout(r, 0)))
    assert.match(m.text(), /Mangler i dag: mad/)
    await tap(m.host, 'Jeg spiste som i går (2 måltider)')
    await act(async () => new Promise(r => setTimeout(r, 20)))
    assert.deepEqual(writes.map(([t, r]) => [t, r.date, r.meal]), [['meal_logs', today, 'Havregrød'], ['meal_logs', today, 'Kylling og ris']])
    assert.match(m.text(), /Alt er logget i dag/)
  } finally { await m.done() }
})

test('U5 3/4: uden måltider i går fører Log mad til Kost; skjult kost viser ingen madrække', gate, async () => {
  const tabs = [], m = await mount(h(TodayCard, { athlete: { id: A }, today, u5Client: fakeClient({}, []), setTab: t => tabs.push(t) }))
  try {
    await act(async () => new Promise(r => setTimeout(r, 0)))
    await tap(m.host, 'Log mad')
    assert.deepEqual(tabs, ['kost'])
  } finally { await m.done() }
  assert.equal(render(h(TodayCard, { athlete: { id: A }, today, visKost: false, u5ReadMeals: () => assert.fail('ingen læsning') })), '')
})

test('U5 3/4: dagens pas: første sæt uden coachvægt får sidste pas i udkastet, uden ekstra Start-knap', gate, async () => {
  const tables = { exercise_logs: [{ athlete_id: A, weight: 140, reps_completed: 5, logged_at: '2026-11-03T10:00:00Z', skipped: false, exercises: { name: 'Squat' } }] }
  let inputs = { 'ex-bench_1': { weight: '' } }
  const exercises = [{ id: 'ex-squat', name: 'Squat', reps: '5', recommended_weight: null }, { id: 'ex-bench', name: 'Bænkpres', reps: '5', recommended_weight: 100 }]
  const m = await mount(h(TodayCard, { athlete: { id: A }, today, visKost: false, u5Client: fakeClient(tables, []),
    u5Training: { kind: 'today', logged: 0, total: 6, exercises }, logInputs: inputs,
    setLogInputs: f => { inputs = f(inputs) } }))
  try {
    await act(async () => new Promise(r => setTimeout(r, 0)))
    assert.match(m.text(), /Træning · 0 af 6 sæt/)
    assert.doesNotMatch(m.text(), /Start dagens pas</)
    assert.equal(elements(m.host).filter(n => n.tagName === 'BUTTON').length, 0)
    assert.deepEqual(inputs, { 'ex-bench_1': { weight: '' }, 'ex-squat_1': { weight: '140', reps: '5' } })
  } finally { await m.done() }
})

test('U5 4/4: flaget er tændt; kortet står øverst, Start og Log i dag findes én gang', gate, async () => {
  const { DEFAULT_U5_TODAY } = await import('./flag.mjs')
  assert.equal(DEFAULT_U5_TODAY, true)
  const week = { id: 'u5-uge', athlete_id: A, start_date: '2026-11-09', week_number: 2,
    sessions: [{ id: 'u5-pas', weekday: 1, title: 'Syntetisk pas', exercises: [{ id: 'u5-ex', name: 'Squat', sets: 2, reps: '5' }] }] }
  const html = render(h(Home, { enabled: true, athlete: { id: A, name: 'Syntetisk Atlet' }, now: new Date('2026-11-10T12:00:00Z'),
    storage: null, allWeeks: [week], currentWeek: week, exerciseLogs: [], onStartSession() {}, setLogInputs() {}, onLogSet() {},
    weightLogs: [], readinessLog: null, setReadinessInput() {}, setWeightInput() {}, saveReadiness() {}, logWeight() {},
    readHomeReadiness: async () => ({ status: 'loading' }) }))
  assert.equal((html.match(/>Start (dagens|næste) pas</g) ?? []).length, 1)
  const card = html.slice(html.indexOf('data-u5-today'), html.indexOf('aria-label="Dit næste pas"'))
  assert.ok(card.length > 0)
  assert.match(card, /Træning · 0 af 2 sæt/)
  assert.equal((html.match(/data-home-quick-logs=/g) ?? []).length, 1)
  assert.ok(html.indexOf('data-home-quick-logs') > html.indexOf('aria-label="Dit næste pas"'))
})
