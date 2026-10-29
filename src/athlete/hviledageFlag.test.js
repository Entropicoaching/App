import test from 'node:test'
import assert from 'node:assert/strict'
import { install } from './hviledageFlagLoader.mjs'
import { expand, nodes, text, snapshot } from './hviledageFlagDom.mjs'
install()
const {default: WeekCalendar} = await import('./WeekCalendar.jsx')
const {default: MainWeekCalendar} = await import('./hviledageMainWeekCalendar.txt')
const {default: ProgramTab} = await import('./ProgramTab.jsx')
const {default: BeforeWeek} = await import('./hviledageBeforeWeekCalendar.txt')
const {default: BeforeProgram} = await import('./hviledageBeforeProgramTab.txt')
const {default: HjemTab} = await import('./HjemTab.jsx')
const {default: EnkelHjemTab} = await import('./EnkelHjemTab.jsx')
const { readFileSync } = await import('node:fs')
const {default: MainProgramTab} = await import('./hviledageMainProgramTab.txt')
const {hviledageListeEnabled: enabled, DEFAULT_HVILEDAGE_LISTE} = await import('../hviledageListe.mjs')
const {REL1030_FEATURES} = await import('../rel1030.mjs')
const rest = {id:'rest',title:'Hvile session',weekday:1,exercises:[]}
const train = {id:'train',title:'Squat',weekday:0,exercises:[{id:'e',name:'Squat',sets:1,reps:'5'}]}
const week = {id:'w',week_number:1,sessions:[train,rest]}
const weekStart = new Date('2026-10-26T00:00:00')
const props = {week,weekStart,exerciseLogs:[],onOpenSession:()=>{}}
const list = tree => nodes(tree,n=>n.props['aria-label']==='Ugens hviledage')
test('default OFF; strict explicit flag, rel1030 and hviledage URL',()=>{
 assert.equal(DEFAULT_HVILEDAGE_LISTE,false)
 assert.ok(REL1030_FEATURES.includes('hviledage'))
 for(const search of ['', '?hviledage=0','?hviledage=true','?hviledage=1&hviledage=1','?rel1030=0','?rel1030=1&rel1030=1']) assert.equal(enabled(false,search),false,search)
 for(const search of ['?hviledage=1','?rel1030=1','?other=1&hviledage=1']) assert.equal(enabled(false,search),true,search)
 assert.equal(enabled(true),true); assert.equal(enabled('true'),false)
})
test('WeekCalendar OFF matches imported main complete DOM across calendar fixtures',()=>{
 for(const sessions of [[],[train],[rest],[train,rest],[{...train,weekday:null}],[{...train,exercises:undefined}]]) {
  const p={...props,week:{...week,sessions}}
  assert.deepEqual(snapshot(expand(WeekCalendar(p))),snapshot(expand(MainWeekCalendar(p))))
 }
})
test('WeekCalendar ON list, rest classification and click handler; URL resolves ON',()=>{
 let opened=[]
 const tree=expand(WeekCalendar({...props,hviledageListe:enabled(false,'?hviledage=1'),onOpenSession:id=>opened.push(id)}))
 assert.equal(list(tree).length,1)
 const days=nodes(tree,n=>n.type==='button' && 'data-dag' in n.props)
 assert.equal(days[1].props['data-dag'],'hvile'); days[1].props.onClick();assert.deepEqual(opened,[])
 days[0].props.onClick();assert.deepEqual(opened,['train'])
 assert.equal(list(expand(WeekCalendar({...props,hviledageListe:true,week:{sessions:[]}}))).length,1)
 assert.equal(WeekCalendar({...props,week:{sessions:[]}}),null)
})
const pp={allWeeks:[week],currentWeek:week,viewingWeekIdx:0,computeActiveWeekIdx:()=>0,
 weekStartDate:()=>weekStart,fmtWeekRange:()=>'',exerciseLogs:[],pastLogs:[],athlete:{},
 WEEKDAYS_LONG:['Mandag','Tirsdag','Onsdag','Torsdag','Fredag','Loerdag','Soendag'],
 isSessionDone:()=>false,progOpenSession:null,readinessLog:{readiness_score:100},
 sessionFeedback:{},dismissedFeedback:{},feedbackInputs:{},logInputs:{},warmupChecked:{},
 exWarmupExpanded:{},exWarmupWeightEditing:{},exWarmupWeightOverride:{},exerciseHistory:[],
 formatDate:()=>'',setProgOpenSession:()=>{}}
test('Program OFF restores rest session; ON keeps list and excludes rest session',()=>{
 const off=expand(ProgramTab(pp));const on=expand(ProgramTab({...pp,hviledageListe:true}))
 assert.equal(list(off).length,0);assert.equal(list(on).length,1)
 assert.ok(text(off).includes('Hvile session'));assert.ok(!text(on).includes('Hvile session'))
 const main=expand(MainProgramTab(pp))
 for(const title of ['Squat','Hvile session']) assert.equal(text(off).includes(title),text(main).includes(title))
})
test('ON complete synthetic DOM matches pinned candidate for WeekCalendar and Program',()=>{
 for (const sessions of [[],[train],[rest],[train,rest],[{...train,weekday:null}]]) {
  const p={...props,week:{...week,sessions}}
  assert.deepEqual(snapshot(expand(WeekCalendar({...p,hviledageListe:true}))),snapshot(expand(BeforeWeek(p))))
 }
 assert.deepEqual(snapshot(expand(ProgramTab({...pp,hviledageListe:true}))),snapshot(expand(BeforeProgram(pp))))
})
test('Home and simplified Home forward default OFF and explicit ON to actual WeekCalendar',()=>{
 const home={...pp,tab:'hjem',now:new Date('2026-10-26T12:00:00'),days:[],months:[],
 exerciseHistory:[],weightLogs:[],messages:[],sharedVideoAnalyses:[],readinessHistory:[],
 prs:[],liftProgress:[],weeklyTonnage:[],mereOpen:false,role:'coach',restPause:null}
 for(const Component of [HjemTab,EnkelHjemTab]) for(const flag of [undefined,false,true]) {
  const tree=Component({...home,hviledageListe:flag})
  const calendars=nodes(tree,n=>n.type===WeekCalendar)
  assert.equal(calendars.length,1)
  assert.equal(calendars[0].props.hviledageListe,flag===true)
  assert.equal(list(expand(calendars[0])).length,flag===true ? 1 : 0)
 }
})
test('App and AthleteView wire the named flag to normal and preview routes',()=>{
 const app=readFileSync(new URL('../App.jsx',import.meta.url),'utf8')
 const athlete=readFileSync(new URL('../AthleteView.jsx',import.meta.url),'utf8')
 assert.ok(app.includes('hviledageListe = false'))
 assert.equal(app.match(/componentProps=\{\{ \.\.\.rel3\.athlete, hviledageListe,/g)?.length,2)
 assert.ok(app.includes("hviledageListeEnabled(hviledageListe, typeof window === 'undefined' ? '' : window.location.search)"))
 assert.ok(athlete.includes('hviledageListe={hviledageListe === true}'))
 assert.ok(athlete.includes('hviledageListe: hviledageListe === true, restMobility'))
 const registry=JSON.parse(readFileSync(new URL('../testModuleRegistry.json',import.meta.url)))
 const flag=registry.modules.find(row=>row.path==='src/hviledageListe.mjs')
 assert.deepEqual(flag.allowedImporters,['src/App.jsx'])
 assert.equal(flag.imports['./rel1030.mjs'],'src/rel1030.mjs')
})
test('actual registry admits App -> flag -> rel1030 and denies unrelated importer',async()=>{
 const {createRegistry}=await import('../testModuleRegistry.mjs')
 const registry=createRegistry()
 const loader='e2e/rel1030Harness.mjs'
 assert.ok(registry.lookup(loader,'./hviledageListe.mjs',new URL('../App.jsx',import.meta.url).href))
 assert.ok(registry.lookup(loader,'./rel1030.mjs',new URL('../hviledageListe.mjs',import.meta.url).href))
 assert.equal(registry.lookup(loader,'./hviledageListe.mjs',new URL('../Dashboard.jsx',import.meta.url).href),null)
})
