import test from 'node:test'
import assert from 'node:assert/strict'
import { app, nodes, text, normalized } from './coachRyd2Harness.mjs'
const load = await app(), base = await app(true)
const helper = await import('coachryd-test://1/coachRyd.mjs')
const noop = () => {}
const athlete = { id:'fixture-a', name:'Testatlet', status:'active' }
const common = { a:athlete, athletes:[], hiddenAthleteIds:new Set(), unreadCounts:{}, weeklyActivity:{}, athleteReadiness:[], videoAnalyses:[], athleteCurrentWeek:{}, athleteLastLogs:{}, calendarWeeks:{}, snoozedAthletes:{}, athleteWeekCompletion:{}, athleteWeekSummary:{}, coachBriefingSeen:{}, coachPriorityItems:[], coachPriorityCount:0, latestByTrack:{}, unreadByTrack:{}, videoMeasurementByAthlete:{}, profilesLastSeen:{}, activeTab:'program', profileReturnView:'inbox', athleteSortMode:'navn', blockPlan:[], setActiveTab:noop, setEditing:noop, setNavMenuOpen:noop, setView:noop, setSelectedAthlete:noop }
const button = (tree,label) => nodes(tree).find(n => n.type==='button' && text(n).trim()===label)
const folded = (tree,label) => nodes(tree).some(n => n.type==='details' && !n.props.open && text(n).includes(label))

test('strict default OFF and inbox entry preserve old deep links', () => {
 assert.equal(helper.DEFAULT_COACH_RYD,false)
 for(const search of ['', '?coachRyd=0', '?coachRyd=true','?coachRyd=1&coachRyd=1','?coachRyd=1&coachRyd=0']) assert.equal(helper.coachRydEnabled(search),false)
 assert.equal(helper.coachRydEnabled('?coachRyd=1'),true)
 assert.equal(helper.coachRydEntryView(true,'list'),'inbox')
 for(const flag of [false,undefined,'1']) for(const old of ['list','inbox']) assert.equal(helper.coachRydEntryView(flag,old),old)
})

test('F1 before FAIL after PASS: home status cards and grid are in one closed fold',async()=>{
 const Final=await load('HubTab.jsx'),Before=await base('HubTab.jsx')
 for(const isMobile of [false,true]) {
  const p={...common,isMobile,coachRyd:true}
  const check=tree=>assert.ok(folded(tree,'Træninger denne uge'))
  assert.throws(()=>check(Before(p)),assert.AssertionError);check(Final(p))
  assert.equal(nodes(Final(p)).filter(n=>n.type==='details').length,1)
 }
})

test('F2 before FAIL after PASS: administration is under More, identity retains data',async()=>{
 const Final=await load('ProfilHoved.jsx'),Before=await base('ProfilHoved.jsx')
 for(const isMobile of [false,true]) {
  const p={...common,isMobile,coachRyd:true,navMenuOpen:false}
  assert.ok(button(Before(p),'Fjern'));assert.equal(button(Final(p),'Fjern'),undefined)
  const calls=[],tree=Final({...p,navMenuOpen:true,setShowDeleteModal:x=>calls.push(x)})
  const remove=button(tree,'Fjern');assert.ok(remove)
  assert.ok(!nodes(tree).filter(n=>n.type==='details').some(n=>nodes(n).includes(remove)))
  remove.props.onClick();assert.deepEqual(calls,[true])
  assert.ok(folded(tree,'Profiloplysninger'))
 }
})

test('F3 before FAIL after PASS: calendar tasks move to inbox, same handlers and scope',async()=>{
 const Calendar=await load('KalenderView.jsx'),Before=await base('KalenderView.jsx'),Inbox=await load('IndbakkeView.jsx')
 for(const isMobile of [false,true]) {
  const calls=[],p={...common,athletes:[athlete],isMobile,coachRyd:true,openProfile:(...x)=>calls.push(x),openPlanReview:x=>calls.push(x),snoozeAthlete:(...x)=>calls.push(x)}
  const check=tree=>assert.ok(!text(tree).includes('Kræver din opmærksomhed'))
  assert.throws(()=>check(Before(p)),assert.AssertionError);check(Calendar(p))
  const tasks=Calendar({...p,tasksOnly:true}),tree=Inbox({...p,calendarTasks:tasks})
  assert.match(text(tree),/Kræver din opmærksomhed/)
  assert.ok(!text(tasks).includes('Tidslinje'))
  nodes(tasks).find(n=>n.props.onClick&&text(n).includes('Intet program oprettet')).props.onClick()
  assert.deepEqual(calls.shift(),[athlete,'program'])
  button(tasks,'7d').props.onClick();const snooze=calls.shift();assert.equal(snooze[0],athlete.id);assert.match(snooze[1],/^\d{4}-\d{2}-\d{2}$/)
  nodes(tasks).find(n=>n.type==='input'&&n.props.type==='date').props.onChange({target:{value:'2026-11-01'}})
  assert.deepEqual(calls.shift(),[athlete.id,'2026-11-01'])
  button(tasks,'Åbn plan').props.onClick();assert.equal(calls.shift().athlete,athlete)
  const hidden=Calendar({...p,tasksOnly:true,hiddenAthleteIds:new Set([athlete.id])})
  assert.ok(!text(hidden).includes(athlete.name))
  const paused=Calendar({...p,tasksOnly:true,snoozedAthletes:{[athlete.id]:'2099-01-01'}})
  button(paused,'Vis nu').props.onClick();assert.deepEqual(calls.shift(),[athlete.id,null])
 }
})

test('F4 before FAIL after PASS: home task rows move, seen handler is available in inbox',async()=>{
 const Home=await load('ForsideView.jsx'),Before=await base('ForsideView.jsx'),Inbox=await load('IndbakkeView.jsx')
 const item={key:'fixture-task',kind:'message',title:'Unik opgave',detail:'Svar her',label:'Besked',color:'#fff',athlete,track:'besked',createdAt:'2026-10-27T12:00:00Z',message:{id:'m'}}
 const p={...common,coachRyd:true,coachPriorityItems:[item],coachPriorityCount:1}
 assert.match(text(Before(p)),/Unik opgave/);assert.ok(!text(Home(p)).includes('Unik opgave'))
 const calls=[],tree=Inbox({...p,handleCoachBriefingSeen:x=>calls.push(x),openCoachPriorityItem:(...x)=>calls.push(x)})
 button(tree,'Set').props.onClick();assert.equal(calls.shift(),item)
 nodes(tree).find(n=>n.type==='button'&&text(n).includes('Unik opgave')).props.onClick();assert.deepEqual(calls.shift(),[item,'inbox'])
})

test('OFF exact pinned trees for all changed views, both widths and flag absent',async()=>{
 for(const name of ['HubTab','ProfilHoved','ForsideView','IndbakkeView','KalenderView']) {
  const Final=await load(name+'.jsx'),Before=await base(name+'.jsx')
  for(const isMobile of [false,true]) for(const coachRyd of [false,undefined]) for(const athletes of [[],[athlete]]) {
   const p={...common,athletes,isMobile,coachRyd}
   assert.deepEqual(normalized(Final(p)),normalized(Before(p)),name)
  }
 }
})

test('all profile destinations and primary action order retain setter arguments',async()=>{
 const Profile=await load('ProfilHoved.jsx'),Hub=await load('HubTab.jsx')
 for(const isMobile of [false,true]) {
  const calls=[],p={...common,isMobile,coachRyd:true,navMenuOpen:true,setActiveTab:x=>calls.push(['tab',x]),setEditing:x=>calls.push(['edit',x]),setNavMenuOpen:x=>calls.push(['menu',x])}
  const tree=Profile(p),buttons=nodes(tree).filter(n=>n.type==='button')
  assert.deepEqual(buttons.slice(0,3).map(text),['Plan','Log','Svar'])
  for(const label of ['Plan','Log','Svar']) button(tree,label).props.onClick()
  assert.deepEqual(calls.splice(0),['program','log','beskeder'].flatMap(k=>[['tab',k],['edit',null],['menu',false]]))
  for(const key of ['hub','oversigt','kost','analyse','opvarmning','stævne','noter']) {
   const destination=nodes(tree).find(n=>n.type==='button'&&n.props.key===key);assert.ok(destination,key)
   destination.props.onClick();assert.deepEqual(calls.splice(0),[['tab',key],['edit',null],['menu',false]])
  }
  const hub=Hub(p)
  for(const dest of nodes(hub).filter(n=>n.type==='button')) {dest.props.onClick();assert.deepEqual(calls.splice(0),[['tab',dest.props.key],['edit',null]])}
 }
})
