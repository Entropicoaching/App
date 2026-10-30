import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { install } from './hjemoevLoader.mjs'
install()
const { renderHomeworkEntry, renderHomeworkHome } = await import('./hjemoevKompakt.mjs')
const { hjemoevKompaktEnabled, DEFAULT_HJEMOEV_KOMPAKT, rel1030Feature } = await import('../rel1030.mjs')
const { MobilityHomeworkHome, saveHomework, homeworkLibrary } = await import('../mobilityHomework.mjs')
const { MobilityHomeworkProgress } = await import('../mobilityAdherence.mjs')
const { default: Hjem } = await import('./HjemTab.jsx')
const { default: BaseHjem } = await import('./hjemoevBaseHjemTab.txt')
const { default: Mobilitet } = await import('./MobiliseringTab.jsx')
const { renderMore } = await import('./enkelPrototype.mjs')
const { createElement: h, mount, nodes, text, button } = await import('./hjemoevDom.mjs')
const noop = () => {}
function storage() { const data = new Map(); return { getItem: k => data.get(k) ?? null, setItem: (k,v) => data.set(k,v) } }
const store = storage(), athleteId = 'synthetic-homework-a'
const exercises = homeworkLibrary()[0].exercises.slice(0,3)
assert.equal(saveHomework(athleteId, { problemId: 'squat-hip', exerciseIds: exercises.map(x=>x.id) }, store).error, null)
globalThis.localStorage = store
const options = { compact: true, tab: 'hjem', enkelOn: false, route: 'traening', enabled: true, athleteId, storage: store, Home: MobilityHomeworkHome }
const homeProps = { tab: 'hjem', now: new Date('2026-10-30T12:00:00Z'), days: [], months: [], allWeeks: [], exerciseLogs: [], exerciseHistory: [], athlete: { id: athleteId }, messages: [], readinessHistory: [], weeklyTonnage: [], liftProgress: [], weightLogs: [], prs: {}, forloebLogs: [], sharedVideoAnalyses: [], setTab: noop, setMereOpen: noop, renderSharedFeedbackCards: noop, readinessInput: { soreZones: [] } }
function homeView(props = {}) { return mount(Hjem, { ...homeProps, ...props }).render() }
function show(node) { return mount(() => node, {}).render() }

test('default OFF and strict prop/query/rel1030 activation', () => {
  assert.equal(DEFAULT_HJEMOEV_KOMPAKT, false)
  for (const query of ['', '?hjemoevKompakt=0', '?hjemoevKompakt=true', '?hjemoevKompakt=1&hjemoevKompakt=1', '?rel1030=1&rel1030=0']) assert.equal(hjemoevKompaktEnabled(false,query),false)
  for (const query of ['?hjemoevKompakt=1', '?rel1030=1']) assert.equal(hjemoevKompaktEnabled(false,query),true)
  assert.equal(hjemoevKompaktEnabled(true,''),true)
  assert.equal(hjemoevKompaktEnabled('true',''),false)
  assert.equal(rel1030Feature('hjemoevKompakt','?rel1030=1'),false) // closed release list unchanged; explicit gate resolves rel1030
})

test('OFF existing homework DOM is identical, also progress callbacks', () => {
  const old = show(h(MobilityHomeworkHome,{key:athleteId,enabled:true,athleteId}))
  const current = show(renderHomeworkHome(h,{...options,compact:false,storage:undefined}))
  assert.equal(JSON.stringify(current),JSON.stringify(old))
  const poisoned = { getItem() { assert.fail('OFF storage read') } }
  assert.equal(renderHomeworkEntry(h,{storage:poisoned}),null)
  assert.equal(show(renderHomeworkHome(h,{...options,compact:false,enabled:false,storage:poisoned})),null)
  const progress = child => show(h(MobilityHomeworkProgress,{enabled:true,athleteId},child))
  assert.equal(JSON.stringify(progress(renderHomeworkHome(h,{...options,compact:false}))),JSON.stringify(progress(h(MobilityHomeworkHome,{enabled:true,athleteId,storage:store}))))
})

test('OFF exact pinned Hjem DOM equals final with absent/null entry, Mere closed/open', () => {
  for (const mereOpen of [false,true]) for (const onHoliday of [false,true]) {
    const props = {...homeProps,mereOpen,onHoliday}
    assert.equal(JSON.stringify(mount(Hjem,props).render()),JSON.stringify(mount(BaseHjem,props).render()))
    assert.equal(JSON.stringify(mount(Hjem,{...props,homeworkEntry:null}).render()),JSON.stringify(mount(BaseHjem,props).render()))
  }
})

test('ON home is one row with exact count, handler and bounded 375x812 style', () => {
  let opened=0
  const tree=show(renderHomeworkHome(h,{...options,onOpen:()=>opened++}))
  assert.equal(nodes(tree,n=>n.type==='button').length,1)
  assert.equal(nodes(tree,n=>n.type==='li').length,0)
  assert.equal(tree.props['aria-label'],'Hjemmeøvelser fra din coach (3)')
  assert.equal(text(tree),'Hjemmeøvelser fra din coach (3)→')
  assert.ok(tree.props.style.height+12 < 812*0.1)
  assert.equal(tree.props.style.boxSizing,'border-box')
  assert.equal(tree.props.children[0].props.style.whiteSpace,'nowrap')
  tree.props.onClick(); assert.equal(opened,1)
})

test('N0 hidden; athlete isolation and storage failures never show another assignment', () => {
  assert.equal(renderHomeworkHome(h,{...options,athleteId:'synthetic-other'}),null)
  assert.equal(renderHomeworkHome(h,{...options,storage:storage()}),null)
  const broken={getItem(){throw Error('synthetic denied')}}
  const tree=show(renderHomeworkHome(h,{...options,storage:broken}))
  assert.equal(tree.props['aria-label'],'Hjemmeøvelser fra din coach')
  assert.ok(!text(tree).includes('(3)'))
  const page=mount(MobilityHomeworkHome,{enabled:true,athleteId,storage:broken}).render()
  assert.match(text(page),/Tildelingen kunne ikke læses/)
})

test('Mere and Mobilitet entries invoke the same imported click handler; warmup has none', () => {
  let opened=0
  const entry=renderHomeworkEntry(h,{enabled:true,athleteId,storage:store,onOpen:()=>opened++})
  assert.ok(!text(homeView({homeworkEntry:entry,mereOpen:false})).includes('Hjemmeøvelser fra din coach'))
  const more=homeView({homeworkEntry:entry,mereOpen:true})
  button(more,'Hjemmeøvelser fra din coach (3)→').onClick()
  const mobilityProps={mobilityMode:null,homeworkEntry:entry,setMobilityMode:noop,setTab:noop}
  const hub=mount(Mobilitet,mobilityProps).render()
  button(hub,'Hjemmeøvelser fra din coach (3)→').onClick()
  const warmup=mount(Mobilitet,{...mobilityProps,mobilityMode:'opvarmning',warmupPhase:'focus',warmupFocus:null,warmupProblems:[],warmupTemplates:[]}).render()
  assert.ok(!text(warmup).includes('Hjemmeøvelser fra din coach'))
  const simple=show(h('div',null,renderMore(h,{go:noop}),entry))
  button(simple,'Hjemmeøvelser fra din coach (3)→').onClick()
  assert.equal(opened,3)
})

test('own page reuses actual imported exercises, descriptions, scope notice and reload handler', () => {
  const app=mount(MobilityHomeworkHome,{enabled:true,athleteId,storage:store})
  let tree=app.render()
  assert.equal(nodes(tree,n=>n.type==='li').length,3)
  for (const ex of exercises) { assert.ok(text(tree).includes(ex.name)); assert.ok(text(tree).includes(ex.desc)); assert.ok(text(tree).includes(ex.label)) }
  assert.match(text(tree),/Kun gemt i denne browser på denne enhed/)
  assert.equal(saveHomework(athleteId,null,store).error,null)
  button(tree,'Genindlæs hjemmeøvelser').onClick();tree=app.render()
  assert.equal(nodes(tree,n=>n.type==='li').length,0)
  saveHomework(athleteId,{problemId:'squat-hip',exerciseIds:exercises.map(x=>x.id)},store)
})

test('no home row on pre-session/program/mobility or other simple routes', () => {
  for(const tab of ['program','mobilisering','fremgang','mere']) assert.equal(renderHomeworkHome(h,{...options,tab}),null)
  for(const route of ['dagsform','uge','mere','program']) assert.equal(renderHomeworkHome(h,{...options,enkelOn:true,route}),null)
  for(const route of ['traening','alle']) assert.ok(renderHomeworkHome(h,{...options,enkelOn:true,route}))
})

test('actual final App/AthleteView wiring keeps page separate and propagates flags at both athlete boundaries', () => {
  const source=n=>readFileSync(new URL(n,import.meta.url),'utf8')
  const app=source('../App.jsx'), view=source('../AthleteView.jsx')
  assert.equal((app.match(/componentProps=\{\{ \.\.\.rel3\.athlete[^\n]*, hjemoevKompakt\}\}/g)||[]).length,2)
  assert.match(app,/hjemoevKompakt = hjemoevKompaktEnabled/)
  assert.match(view,/const openHomework = \(\) => \{ setMobilityMode\('hjemmeoevelser'\); setTab\('mobilisering'\) \}/)
  assert.match(view,/tab === 'mobilisering' && !\(compactHomework && mobilityMode === 'hjemmeoevelser'\)/)
  assert.match(view,/\{!compactHomework && \(<>/)
  assert.match(view,/route === 'mere' && homeworkEntry/)
  assert.match(view,/homeworkEntry=\{homeworkEntry\}/)
})
