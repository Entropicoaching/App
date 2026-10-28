import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { jsx } from './coachRyd2Jsx.mjs'
import { app, nodes, text, normalized } from './coachRyd2Harness.mjs'
const load = await app(), base = await app(true)
const helper = await import('coachryd-test://1/coachRyd.mjs')
const { coachBriefingPointKey } = await import('coachryd-test://1/coachBriefingSeen.js')
const noop=()=>{}
const athlete={id:'counter-a',name:'Modproeve',status:'active'}
const common={athletes:[],a:athlete,hiddenAthleteIds:new Set(),unreadCounts:{},weeklyActivity:{},athleteReadiness:[],videoAnalyses:[],latestByTrack:{},unreadByTrack:{},coachPriorityItems:[],coachPriorityCount:0,profilesLastSeen:{},athleteWeekSummary:{},todayData:{},activeTab:'hub',profileReturnView:'inbox',calendarWeeks:{},athleteCurrentWeek:{},athleteLastLogs:{},snoozedAthletes:{}}
const button=(tree,label)=>nodes(tree).find(n=>n.type==='button'&&text(n).trim()===label)

test('counter: closed loader refuses traversal, backend file and unknown direct imports',async()=>{
 await assert.rejects(import('coachryd-test://1/../input-776-773-supabase.js'),/Unapproved dependency/)
 await assert.rejects(import('coachryd-test://1/ORDER.md'),/Unapproved dependency/)
 await assert.rejects(import('coachryd-test://1/not-allowed.mjs'),/Unapproved dependency/)
})

test('counter: fresh profile menu stays More on every secondary destination',async()=>{
 const Profile=await load('ProfilHoved.jsx')
 for(const activeTab of ['hub','analyse','oversigt','noter','kost','stævne']) for(const isMobile of [false,true]) {
  const calls=[],tree=Profile({...common,coachRyd:true,isMobile,activeTab,setNavMenuOpen:fn=>calls.push(fn(false)),setActiveTab:noop,setEditing:noop})
  const more=nodes(tree).find(n=>n.type==='button'&&text(n).startsWith('Mere'))
  assert.ok(more);more.props.onClick();assert.deepEqual(calls,[true]);assert.equal(button(tree,'Fjern'),undefined)
 }
})

test('counter: signal and seen handlers keep exact payload, saving guard and occurrence key',async()=>{
 const Inbox=await load('IndbakkeView.jsx'),calls=[]
 const signal={key:'s',kind:'signal',title:'Smerte',label:'Smerte',color:'#fff',athlete,signal:{o_athlete_id:athlete.id,o_detector:'pain'}}
 let tree=Inbox({...common,coachRyd:true,coachPriorityItems:[signal],handleTrainingSignal:(...x)=>calls.push(x),openCoachPriorityItem:(...x)=>calls.push(x)})
 button(tree,'Set').props.onClick();button(tree,'Udsæt 7 dage').props.onClick()
 assert.deepEqual(calls,[[signal.signal,'acknowledge'],[signal.signal,'snooze']])
 tree=Inbox({...common,coachRyd:true,coachPriorityItems:[signal],trainingSignalUpdatingKey:athlete.id+':pain'})
 assert.equal(button(tree,'Gemmer…').props.disabled,true);assert.equal(button(tree,'Udsæt 7 dage').props.disabled,true)
 for(const kind of ['message','video']) {
  const item={key:'task',kind,athlete,track:'besked',title:'En opgave',detail:'Belæg',color:'#fff',createdAt:'2026-10-27T10:00:00Z',video:{id:'v'}}
  const key=coachBriefingPointKey(item);assert.ok(key)
  const p={...common,coachRyd:true,coachPriorityItems:[item]}
  assert.equal(button(Inbox({...p,coachBriefingSeenSavingKey:key}),'Set').props.disabled,true)
  const seen=Inbox({...p,coachBriefingSeen:{[key]:true}});assert.match(text(seen),/Set ✓/);assert.equal(button(seen,'Set'),undefined)
 }
})

test('counter: empty signal queue cannot claim calendar inbox is clear',async()=>{
 const Inbox=await load('IndbakkeView.jsx')
 const tree=Inbox({...common,coachRyd:true,inboxRefreshStatus:{kind:'success'},calendarTasks:helper.CoachFold({enabled:false,children:['Der mangler en plan']})})
 assert.match(text(tree),/Der mangler en plan/);assert.ok(!text(tree).includes('Arbejdsindbakke er ryddet'))
})

test('counter: existing global destinations keep callbacks in both navigation surfaces',async()=>{
 const Sidebar=await load('Sidebar.jsx'),Mobile=await load('MobilNav.jsx')
 for(const [Component,isMobile] of [[Sidebar,false],[Mobile,true]]) {
  const p={...common,coachRyd:true,isMobile,view:'inbox',menuSheetOpen:true,sidebarMoreOpen:true,onPreviewAthlete:noop,setSidebarOpen:noop,setMenuSheetOpen:noop,exportBackup:noop,exportTraeningsdata:noop}
  for(const [label,dest] of [['Forside','list'],['Kalender','calendar'],['Bibliotek','library'],['Arbejdsindbakke','inbox']]) {
   const calls=[],tree=Component({...p,setView:x=>calls.push(['view',x]),setSelectedAthlete:x=>calls.push(['athlete',x])})
   const n=nodes(tree).find(n=>n.props.onClick&&text(n).trim()===label);assert.ok(n,label);n.props.onClick()
   assert.ok(calls.some(x=>x[0]==='view'&&x[1]===dest));assert.ok(calls.some(x=>x[0]==='athlete'&&x[1]===null))
  }
 }
})

test('Dashboard wiring parses and forwards the original calendar handlers under opt-in',()=>{
 const source=readFileSync(new URL('./Dashboard.jsx',import.meta.url),'utf8')
 assert.match(source,/useState\(coachRydEntryView\(coachRyd, initialCoachEntryRef.current.view\)\)/)
 assert.match(source,/calendarTasks: coachRyd \? <KalenderView tasksOnly/)
 for(const name of ['openProfile','openPlanReview','snoozeAthlete']) assert.match(source.slice(source.indexOf('calendarTasks:'),source.indexOf('calendarTasks:')+400),new RegExp(name))
 assert.doesNotThrow(()=>jsx(source))
})
