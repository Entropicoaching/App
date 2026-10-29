import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { install } from './analyseConclusionLoader.mjs'
import { mount, nodes, one, text } from './analyseTestDom.mjs'
install()
const { default: AnalyseTab } = await import('./AnalyseTab.jsx')
const { default: Message, analyseConclusionMessageEnabled, DEFAULT_ANALYSE_CONCLUSION_MESSAGE, conclusionNextAction } = await import('./analyseConclusionMessage.mjs')
const { createCoachTemplateSender } = await import('./coachTemplateMessages.mjs')
const row = (extra = {}) => ({ id: 'review', athlete_id: 'demo', status: 'coach_approved', lift: 'squat', analyzed_at: '2026-10-20', athlete_feedback: { focus: [{ text: 'Hold pausen. Mere tekst.' }], next_set: [{ text: 'Pres gulvet. Flere handlinger.' }] }, ...extra })
const base = { a: { id: 'demo', name: 'Demo' }, selectedAthlete: { id: 'demo', name: 'Demo' }, athleteLogs: [], athletePRHistory: [], athleteReadiness: [], athleteWeightLogs: [], exerciseLibrary: [], videoAnalyses: [row()], videoBaselines: [], weeks: [], videoLiftFilter: 'all', coachId: 'coach' }
function setup(extra = {}) {
  const writes = []
  let scope = { enabled: true, coachId: 'coach', athletes: [{ id: 'demo' }] }
  let result = { error: null }, wait
  const sender = createCoachTemplateSender({ enabled: true, getScope: () => scope, database: { from(table) {
    assert.equal(table, 'messages')
    return { async insert(value) { writes.push(value); if (wait) await wait; return result } }
  } } })
  const props = { ...base, analyseConclusionMessage: true, sendConclusionMessage: sender, ...extra }
  const app = mount(AnalyseTab, props)
  globalThis.window = { location: { search: '' } }
  return { app, props, writes, scope: v => { scope = v }, result: v => { result = v }, wait: v => { wait = v } }
}
const button = (tree, label) => one(tree, n => n.type === 'button' && text(n) === label).props
const field = (tree, label) => one(tree, n => n.props['aria-label'] === label).props
const clean = v => typeof v === 'function' ? '[handler]' : Array.isArray(v) ? v.map(clean) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clean(x)])) : v
function open(s) { button(s.app.render(), 'Klargør besked til atleten').onClick(); return s.app.render() }

test('new flag is default OFF, strict, independent of release flag; OFF DOM stays exact', () => {
  assert.equal(DEFAULT_ANALYSE_CONCLUSION_MESSAGE, false)
  for (const q of ['', '?rel1030=1', '?analyseConclusionMessage=0', '?analyseConclusionMessage=true', '?analyseConclusionMessage=1&analyseConclusionMessage=0']) assert.equal(analyseConclusionMessageEnabled(q), false)
  assert.equal(analyseConclusionMessageEnabled('?analyseConclusionMessage=1'), true)
  const s = setup({ analyseConclusionMessage: false })
  const a = s.app.render()
  assert.equal(nodes(a, n => n.props['aria-label'] === 'Send analysens konklusion').length, 0)
  assert.deepEqual(clean(a), clean(mount(AnalyseTab, { ...base }).render()))
  assert.equal(Message({ enabled: false, get logs() { throw Error('OFF read') } }), null)
  assert.equal(s.writes.length, 0)
})

test('actual tab: opening and editing send nothing; explicit Send uses the existing message path', async () => {
  const s = setup()
  let tree = open(s)
  assert.equal(field(tree, 'Konklusionssætning').value, 'Godkendt videoreview (Squat, 2026-10-20): Hold pausen.')
  assert.equal(field(tree, 'Næste handling').value, 'Pres gulvet.')
  field(tree, 'Konklusionssætning').onChange({ target: { value: 'Din pause er stabil.' } })
  field(tree, 'Næste handling').onChange({ target: { value: 'Bevar pausen i næste sæt.' } })
  tree = s.app.render(); s.app.render()
  assert.equal(s.writes.length, 0)
  await button(tree, 'Send').onClick()
  assert.deepEqual(s.writes, [{ athlete_id: 'demo', sender_role: 'coach', category: 'besked', content: 'Din pause er stabil.\n\nNæste handling: Bevar pausen i næste sæt.' }])
  await button(tree, 'Send').onClick()
  assert.equal(s.writes.length, 1)
  assert.match(text(s.app.render()), /Beskeden er sendt/)
})

test('cancel discards edits and never sends; opening again uses the source', () => {
  const s = setup(); let tree = open(s)
  field(tree, 'Næste handling').onChange({ target: { value: 'Kasser denne tekst' } })
  button(s.app.render(), 'Annuller').onClick()
  tree = open(s)
  assert.equal(field(tree, 'Næste handling').value, 'Pres gulvet.')
  assert.equal(s.writes.length, 0)
})

test('no automatic action is invented: missing action requires coach text; empty and oversized drafts cannot send', async () => {
  const s = setup({ videoAnalyses: [] }); let tree = open(s)
  assert.equal(field(tree, 'Næste handling').value, '')
  assert.equal(button(tree, 'Send').disabled, true)
  await button(tree, 'Send').onClick(); assert.equal(s.writes.length, 0)
  field(tree, 'Næste handling').onChange({ target: { value: 'Log næste træning.' } })
  tree = s.app.render(); assert.equal(button(tree, 'Send').disabled, false)
  field(tree, 'Konklusionssætning').onChange({ target: { value: ' ' } })
  tree = s.app.render(); await button(tree, 'Send').onClick(); assert.equal(s.writes.length, 0)
  field(tree, 'Konklusionssætning').onChange({ target: { value: 'x'.repeat(10000) } })
  tree = s.app.render(); assert.equal(button(tree, 'Send').disabled, true)
  await button(tree, 'Send').onClick(); assert.equal(s.writes.length, 0)
})

test('pending clicks have one insert, failed sends preserve edits and can retry', async () => {
  const s = setup(); let resolve
  s.wait(new Promise(r => { resolve = r }))
  const tree = open(s), send = button(tree, 'Send').onClick
  const first = send(); await send()
  assert.equal(s.writes.length, 1)
  assert.equal(field(s.app.render(), 'Konklusionssætning').disabled, true)
  s.result({ error: Error('synthetic failure') }); resolve(); await first
  assert.match(text(s.app.render()), /Din tekst er bevaret/)
  s.result({ error: null }); s.wait(null)
  await button(s.app.render(), 'Send').onClick()
  assert.equal(s.writes.length, 2)
  assert.match(text(s.app.render()), /Beskeden er sendt/)
})

test('source, athlete and filter changes discard drafts; loading and error hide the sender', () => {
  const s = setup(); let tree = open(s)
  field(tree, 'Næste handling').onChange({ target: { value: 'Gammel kladde' } })
  for (const change of [{ selectedAthlete: { id: 'other' }, a: { id: 'other' } }, { videoLiftFilter: 'bench' }, { videoAnalyses: [row({ id: 'new', athlete_feedback: { focus: [{ text: 'Ny konklusion.' }], next_set: 'Ny handling.' } })] }]) {
    tree = s.app.render({ ...s.props, ...change })
    assert.equal(nodes(tree, n => n.props['aria-label'] === 'Konklusionssætning').length, 0)
    assert.equal(s.writes.length, 0)
  }
  for (const change of [{ videoAnalysisLoading: true }, { videoAnalysisError: 'synthetic' }]) {
    tree = s.app.render({ ...s.props, ...change })
    assert.equal(nodes(tree, n => n.props['aria-label'] === 'Send analysens konklusion').length, 0)
  }
})

test('counterexamples: stale recipient, disabled flag, changed coach and removed membership reject Send', async () => {
  for (const scope of [{ enabled: false, coachId: 'coach', athletes: [{ id: 'demo' }] }, { enabled: true, coachId: 'other', athletes: [{ id: 'demo' }] }, { enabled: true, coachId: 'coach', athletes: [{ id: 'other' }] }]) {
    const s = setup(); const tree = open(s); s.scope(scope)
    await button(tree, 'Send').onClick(); assert.equal(s.writes.length, 0)
    assert.match(text(s.app.render()), /blev ikke sendt/)
  }
})

test('counterexamples: next action follows exactly the headline review, never a foreign, draft or older review', () => {
  const valid = row({ athlete_feedback: { focus: [{ text: 'Pause.' }] } })
  const old = row({ analyzed_at: '2026-10-19' })
  for (const bad of [row({ athlete_id: 'other' }), row({ status: 'draft' }), row({ analyzed_at: 'invalid' })]) assert.equal(conclusionNextAction({ athleteId: 'demo', analyses: [bad, old, valid] }), '')
  assert.equal(conclusionNextAction({ athleteId: 'demo', analyses: [row()], liftFilter: 'bench' }), '')
  assert.equal(conclusionNextAction({ athleteId: 'demo', analyses: [row()], loading: true }), '')
  assert.equal(conclusionNextAction({ athleteId: 'demo', analyses: [row({ athlete_feedback: { focus: [{ text: 'Pause.' }], next_set: 'Pres gulvet\r\nHold grebet' } })] }), 'Pres gulvet')
})

test('no network or storage on render/edit/cancel; closed loader still rejects unlisted imports', async () => {
  const saved = ['fetch', 'localStorage', 'sessionStorage', 'XMLHttpRequest', 'WebSocket'].map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)])
  try {
    for (const [k] of saved) Object.defineProperty(globalThis, k, { configurable: true, get() { throw Error('Forbidden IO ' + k) } })
    const s = setup(); const tree = open(s)
    field(tree, 'Næste handling').onChange({ target: { value: 'Ret tekst' } })
    button(s.app.render(), 'Annuller').onClick(); s.app.render()
    assert.equal(s.writes.length, 0)
    for (const name of ['node:http', './notAllowed.mjs', '../../dataEnough.mjs']) await assert.rejects(import(name), /Closed loader/)
  } finally { for (const [k, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, k, descriptor); else delete globalThis[k] } }
})

test('Dashboard wires a separate live scope and the actual tab receives only that sender', () => {
  const source = readFileSync(new URL('../Dashboard.jsx', import.meta.url), 'utf8')
  assert.match(source, /enabled: analyseConclusionMessage === true && !videoAnalysisLoading && !videoAnalysisError/)
  assert.match(source, /athletes: athletes.filter\(item => item.id === selectedAthlete\?\.id\)/)
  assert.match(source, /getScope: \(\) => conclusionScopeRef.current/)
  const tabProps = source.slice(source.indexOf('factory={analyseTabFactory}')).match(/componentProps=\{\{([\s\S]*?)\}\}/)[1]
  assert.match(tabProps, /analyseConclusionMessage, coachId: session\?\.user\?\.id, sendConclusionMessage/)
  assert.match(source, /templateScopeRef.current = \{ enabled: coachTemplateMessages === true/)
})
