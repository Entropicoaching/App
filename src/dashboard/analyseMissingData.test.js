import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { install } from './analyseConclusionLoader.mjs'
import { createRegistry } from '../testModuleRegistry.mjs'
import { mount, nodes, one, text } from './analyseTestDom.mjs'
install()
const { default: Missing } = await import('./analyseMissingData.mjs')
const { MISSING_REQUIREMENTS, missingRequirement } = await import('../dataMissing.mjs')
const { DATA_MESSAGES, hasEnoughData, dataEnoughEnabled: sharedEnabled, dataAllowed: sharedAllowed, dataMessage: sharedMessage } = await import('../dataEnough.mjs')
const { dataEnoughEnabled, dataAllowed, dataMessage } = await import('./analyseDataGate.mjs')
const { analyseMissingDataEnabled, DEFAULT_ANALYSE_MISSING_DATA } = await import('../analyseMissingFlag.mjs')
const { default: Tab } = await import('./AnalyseTab.jsx')
const { createCoachTemplateSender } = await import('./coachTemplateMessages.mjs')
const date = n => new Date(Date.UTC(2026, 9, 29 + n)).toISOString().slice(0, 10)
const today = date(0)
const check = n => ({ logged_date: date(n), readiness_score: 40, energy: 3, motivation: 3, stress: 3, soreness_level: 3, sleep_hours: 8 })
const rated = Array.from({ length: 24 }, (_, i) => ({ id: 'r' + i, date: date(-1 - i % 3), session_id: 's' + i % 3, rpe_actual: 8, rpe_source: 'athlete', rpe_planned: 8, lift: 'Squat' }))
const heavy = [-1, -8, -15, -22].map(n => ({ dag: date(n), qualified: true, e1rm: 100, lift: 'Squat', repZone: 3 }))
const weeks = [-7, -14, -21, -28].map(n => ({ start_date: date(n), complete: true, performedSessions: 1, mappingKnown: true }))
const matched = Array.from({ length: 12 }, (_, i) => ({ date: date(-3 * i), matched: true, value: 1, band: i % 2, comparable: true, independentRpe: true }))
const weights = [-1, -3, -7, -8, -10, -14].map(n => ({ logged_at: date(n), weight: 80 }))
const enough = {
  D02: { current: check(0), rows: [-1,-2,-3,-4,-5].map(check) },
  D04: { rows: [check(-1),check(-2)] }, D06: { rows: [-1,-2,-3].map(check) },
  D07: { explicitDecisionLink: true, checkinId: 'c', decisionId: 'd' },
  D08: { rows: matched }, D09: { rows: matched }, D10: { rows: rated },
  D11: { today, rows: rated.map(r => ({ ...r, comparable: true, targetRpe: 8, repZone: 3 })), targetRpe: 8, lift: 'Squat', repZone: 3 },
  D12: { today, rows: rated },
  D13: { planKey: 'p', rows: rated.map((r,i) => ({ ...r, session_id: 's' + i % 4, date: date(-i), comparable: true, planKey: 'p' })) },
  D14: { today, rows: rated, checkins: [-1,-2,-3].map(check) },
  D15: { today, rows: rated, closed: true }, D16: { today, rows: rated, lift: 'Squat', conflict: true, checkins: [-1,-2,-3].map(check) },
  D18: { rows: heavy }, D19: { today, weeks, qualified: true }, D21: { rows: heavy }, D22: { rows: heavy },
  D25: { today, rows: [-1,-8,-15,-29,-36,-43].map(n => ({ ...heavy[0], dag: date(n) })) },
  D26: { qualified: true, nonDeload: true, trainedWeeks: 4, trainedWeeksAfterPeak: 3, latestAge: 14 },
  D27: { qualified: true, nonDeload: true, trainedWeeks: 4, trainedWeeksAfterPeak: 3, latestAge: 14, fall: true, consecutiveObservedWeeks: 6 },
  D33: { today, weeks }, D35: { today, weeks, trend: true, comparable: true },
  D37: { today, weeks, plannedSets: 1, samePeriod: true },
  D38: { complete: true, plannedSets: 1, performedPositions: 1, allExercises: true },
  D39: { today, weeks, plannedSets: 1, samePeriod: true },
  D40: { complete: true, planKnown: true, dropout: true, historicalWeeks: 4, recentCompleteDays: 30, contextKnown: true },
  D41: { fullPlanWeek: true, performedSessions: 1, voiceCount: 1, openCount: 0, allSourcesConfirmed: true },
  D46: { today, rows: weights }, D47: { today, rows: weights },
  D48: { today, rows: Array.from({ length: 28 }, (_,i) => ({ date: date(-i), completeDay: true, kcal: 2000 })), weights: [-27,-26,-25,-3,-2,-1].map(n => ({ logged_at: date(n), weight: 80 })) },
  D56: { qualityChecked: true, validReps: 3, phasesKnown: true, calibrated: true, measurementBasis: true, interpretation: true, marcReviewed: true },
  D59: { currentId: 'current', athleteId: 'a', variation: 'v', metric: 'm', method: 'x', version: '1', rows: Array.from({ length: 5 }, (_,i) => ({ id: 'ref'+i, date: date(-i), approved: true, athleteId: 'a', variation: 'v', metric: 'm', method: 'x', version: '1', value: 1 })) },
  D69: { rows: [{ planReference: 'p', basisDate: today, engineMinimumDocumented: true, engineMinimumMet: true, historicalDirection: true, comparableSessions: 3 }] },
  D76: { openCount: 0, allSourcesConfirmed: true, refreshedAt: today },
}
const button = tree => one(tree, n => n.type === 'button').props
const props = { enabled: true, coachId: 'coach', athleteId: 'athlete' }

test('all rule IDs have explicit logging requirements and positive boundary evidence', () => {
  assert.deepEqual(Object.keys(MISSING_REQUIREMENTS).sort(), Object.keys(DATA_MESSAGES).sort())
  assert.deepEqual(Object.keys(enough).sort(), Object.keys(DATA_MESSAGES).sort())
})

for (const id of Object.keys(DATA_MESSAGES)) test(`${id}: missing/unknown evidence, no click, explicit send, sufficient evidence`, async () => {
  assert.equal(hasEnoughData(id, {}), false)
  assert.equal(hasEnoughData(id, enough[id]), true, 'positive gate fixture')
  assert.equal(missingRequirement(id, enough[id]), '')
  const writes = []
  const sender = createCoachTemplateSender({ enabled: true, getScope: () => ({ enabled: true, coachId: 'coach', athletes: [{id:'athlete'}] }), database: { from(table) {
    assert.equal(table, 'messages')
    return { insert: async value => { writes.push(value); return { error: null } } }
  } } })
  const app = mount(Missing, { ...props, rule: id, evidence: {}, sendMessage: sender })
  for (let i=0;i<3;i++) assert.ok(text(app.render()).includes(MISSING_REQUIREMENTS[id]))
  assert.equal(writes.length, 0)
  await button(app.render()).onClick()
  assert.deepEqual(writes, [{ athlete_id: 'athlete', sender_role: 'coach', category: 'besked', content: MISSING_REQUIREMENTS[id] }])
  assert.equal(button(app.render()).disabled, true)
  await button(app.render()).onClick(); assert.equal(writes.length, 1)
  assert.equal(mount(Missing, { ...props, rule: id, evidence: enough[id] }).render(), null)
  assert.equal(missingRequirement(id, { rows: [null, false, 123], weeks: [null] }), MISSING_REQUIREMENTS[id])
})

test('new flag is strict default OFF and independently enforces all dataEnough gates', () => {
  assert.equal(DEFAULT_ANALYSE_MISSING_DATA, false)
  for (const query of ['', '?rel1030=1', '?analyseMissingData=true', '?analyseMissingData=0', '?analyseMissingData=1&analyseMissingData=1', '?analyseMissingData=1&analyseMissingData=0']) assert.equal(analyseMissingDataEnabled(query), false)
  assert.equal(analyseMissingDataEnabled('?analyseMissingData=1'), true)
  const legacy = { type: 'p', props: { children: ['legacy'] } }
  assert.equal(Missing({ enabled: false, legacy, get evidence() { throw Error('OFF evidence read') } }), legacy)
  globalThis.window = { location: { search: '?analyseMissingData=1' } }
  globalThis.location = { search: '?analyseMissingData=1' }
  try {
    assert.equal(sharedEnabled(), false)
    assert.equal(dataEnoughEnabled(), true)
    for (const id of Object.keys(DATA_MESSAGES)) {
      assert.equal(sharedAllowed(id, {}), true)
      assert.equal(sharedMessage(id), DATA_MESSAGES[id])
      assert.equal(dataAllowed(id, {}), false)
      assert.equal(dataMessage(id), MISSING_REQUIREMENTS[id])
      assert.equal(dataAllowed(id, enough[id]), true)
    }
  } finally { delete globalThis.window; delete globalThis.location }
})

test('qualified heavy-day deficits count distinct days and never invalid or mixed evidence', () => {
  assert.match(missingRequirement('D21', { rows: heavy.slice(0,2) }), /2 forskellige dage mere for Squat/)
  assert.match(missingRequirement('D21', { rows: [heavy[0], heavy[0]] }), /3 forskellige dage mere/)
  for (const rows of [heavy.map(r => ({...r,qualified:false})), [heavy[0],{...heavy[1],lift:'Bænkpres'}]]) assert.equal(missingRequirement('D21',{rows}), MISSING_REQUIREMENTS.D21)
  assert.equal(missingRequirement('UNKNOWN'), '')
})

test('actual tab ON shows requirements and OFF matches pinned copied tab', async () => {
  const base = { a:{id:'athlete',name:'Demo'}, selectedAthlete:{id:'athlete'}, athleteLogs:[], athletePRHistory:[], athleteReadiness:[], athleteWeightLogs:[], exerciseLibrary:[], videoAnalyses:[], videoBaselines:[], weeks:[], videoLiftFilter:'all', coachId:'coach' }
  const clean = value => typeof value === 'function' ? '[handler]' : Array.isArray(value) ? value.map(clean) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([k,v])=>[k,clean(v)])) : value
  // Existing pinned baseline fixture; no new source fixture is introduced.
  const { default: Before } = await import('./analyseConclusionBaseline.jsx')
  for (const query of ['', '?appData2=1', '?analyseMissingData=0', '?analyseMissingData=true']) {
    globalThis.window={location:{search:query}}; globalThis.location={search:query}
    assert.deepEqual(clean(mount(Tab,base).render()),clean(mount(Before,base).render()))
  }
  let calls=0
  globalThis.window={location:{search:'?analyseMissingData=1'}}
  globalThis.location={search:'?analyseMissingData=1'}
  const app=mount(Tab,{...base,analyseMissingData:true,sendMissingDataMessage:async()=>{calls++;return true}})
  const tree=app.render(); app.render()
  assert.equal(calls,0)
  assert.ok(nodes(tree,n=>n.props['data-missing-rule']==='D21').length)
  assert.ok(text(tree).includes(MISSING_REQUIREMENTS.D21))
  assert.doesNotMatch(text(tree),/Mulig overtræning|Observeret e1RM-trend/)
  await nodes(app.render(),n=>n.type==='button'&&text(n)==='Send logkrav til atleten')[0].props.onClick()
  assert.equal(calls,1)
  delete globalThis.window; delete globalThis.location
})

test('failed/pending sends, disabled scope, stale handlers and no IO on render', async () => {
  let calls=0, release
  const pending=new Promise(resolve=>{release=resolve})
  const input={...props,rule:'D21',evidence:{},sendMessage:async()=>{calls++;await pending;return false}}
  const app=mount(Missing,input), send=button(app.render()).onClick
  const first=send(); await send(); assert.equal(calls,1)
  release(); await first
  assert.match(text(app.render()),/blev ikke sendt/)
  const stale=button(app.render()).onClick
  app.render({...input,loading:true}); await stale(); assert.equal(calls,1)
  assert.equal(nodes(app.render({...input,error:'failed'}),n=>n.type==='button').length,0)
  const current=button(app.render(input)).onClick; app.dispose(); await current(); assert.equal(calls,1)
  for (const scope of [{enabled:false,coachId:'coach',athletes:[{id:'athlete'}]}, {enabled:true,coachId:'other',athletes:[{id:'athlete'}]}, {enabled:true,coachId:'coach',athletes:[{id:'other'}]}]) {
    const sender=createCoachTemplateSender({enabled:true,getScope:()=>scope,database:{from(){throw Error('Unexpected write')}}})
    const view=mount(Missing,{...input,sendMessage:sender}); await button(view.render()).onClick()
    assert.match(text(view.render()),/blev ikke sendt/)
  }
  const saved=['fetch','localStorage','sessionStorage','XMLHttpRequest','WebSocket'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)])
  try {
    for(const [k] of saved) Object.defineProperty(globalThis,k,{configurable:true,get(){throw Error('Forbidden IO')}})
    mount(Missing,input).render()
  } finally { for(const [k,d] of saved) {if(d) Object.defineProperty(globalThis,k,d);else delete globalThis[k]} }
})

test('Dashboard wires a separately guarded existing message sender', () => {
  const source=readFileSync(new URL('../Dashboard.jsx',import.meta.url),'utf8')
  assert.match(source,/enabled: analyseMissingData === true && !videoAnalysisLoading && !videoAnalysisError/)
  assert.match(source,/getScope: \(\) => missingDataScopeRef.current/)
  assert.match(source,/analyseMissingData, sendMissingDataMessage,/)
})


test('analysis flag does not change shared gates for any accepted or rejected query', () => {
  const queries = ['', '?rel1030=1', '?appData2=1', '?analyseMissingData=1', '?analyseMissingData=0', '?analyseMissingData=true', '?analyseMissingData=1&analyseMissingData=0', '?analyseMissingData=1&analyseMissingData=1']
  try {
    for (const query of queries) {
      globalThis.location = { search: query }
      globalThis.window = { location: { search: query } }
      const enabled = analyseMissingDataEnabled(query)
      const shared = sharedEnabled()
      const originalQuery = query.replace(/([?&])analyseMissingData=[^&]*/g, '$1').replace(/&+/g, '&')
      globalThis.location.search = originalQuery
      const withoutAnalysis = sharedEnabled()
      globalThis.location.search = query
      assert.equal(shared, withoutAnalysis, query)
      assert.equal(dataEnoughEnabled(), enabled || shared, query)
      for (const id of Object.keys(DATA_MESSAGES)) {
        assert.equal(sharedAllowed(id, {}), !shared, id + query)
        assert.equal(sharedMessage(id), DATA_MESSAGES[id], id + query)
        assert.equal(dataAllowed(id, {}), enabled ? false : sharedAllowed(id, {}), id + query)
        assert.equal(dataMessage(id), enabled ? MISSING_REQUIREMENTS[id] : sharedMessage(id), id + query)
      }
    }
  } finally { delete globalThis.location; delete globalThis.window }
})

test('shared module retains protected release property and has no analysis dependencies', () => {
  const shared = readFileSync(new URL('../dataEnough.mjs', import.meta.url), 'utf8')
  assert.ok(shared.includes("return trin1AppData2(globalThis.location?.search || '')"))
  assert.doesNotMatch(shared, /analyseMissing|dataMissing/)
  const tab = readFileSync(new URL('./AnalyseTab.jsx', import.meta.url), 'utf8')
  assert.match(tab, /import \{ dataEnoughEnabled, dataAllowed, dataMessage \} from '.\/analyseDataGate.mjs'/)
})


test('every closed loader admits only the registered analysis gate edges', () => {
  const data = JSON.parse(readFileSync(new URL('../testModuleRegistry.json', import.meta.url), 'utf8'))
  const root = new URL('../../', import.meta.url)
  const registry = createRegistry(data, root)
  const tab = new URL('src/dashboard/AnalyseTab.jsx', root).href
  const gate = new URL('src/dashboard/analyseDataGate.mjs', root).href
  const dashboard = new URL('src/Dashboard.jsx', root).href
  for (const loader of Object.keys(data.loaders)) {
    assert.equal(registry.lookup(loader, './analyseDataGate.mjs', tab).url, gate)
    assert.equal(registry.lookup(loader, './dashboard/analyseDataGate.mjs', dashboard), null)
    for (const [specifier, path] of [['../dataEnough.mjs', 'src/dataEnough.mjs'], ['../dataMissing.mjs', 'src/dataMissing.mjs'], ['../analyseMissingFlag.mjs', 'src/analyseMissingFlag.mjs']]) {
      assert.equal(registry.lookup(loader, specifier, gate).url, new URL(path, root).href)
    }
    for (const specifier of ['../dashboard/analyseDataGate.mjs', './analyseDataGate', './analyseDataGate.mjs?x', './AnalyseDataGate.mjs']) assert.equal(registry.lookup(loader, specifier, tab), null)
    assert.equal(registry.lookup(loader, 'node:fs', gate), null)
  }
})
