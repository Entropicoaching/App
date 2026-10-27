import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync,existsSync} from 'node:fs'
import {spawnSync} from 'node:child_process'
import {jsx} from './coachRydJsx.mjs'
import {app,h,nodes,text} from './coachRydHarness.mjs'
const load=await app()
const {WorkInboxLink,coachRydEnabled}=await import('coachryd-test://1/coachRyd.mjs')
const read=name=>readFileSync(new URL(existsSync(new URL(name,import.meta.url))?name:'dashboard/'+name,import.meta.url),'utf8')
test('exact final JSX parses, including Dashboard lazy boundaries',()=>{
 for(const name of ['Dashboard','AnalyseTab','ForsideView','HubTab','IndbakkeView','MobilNav','ProfilHoved','Sidebar','VideoReviewModal']) {
  const result=spawnSync(process.execPath,['--input-type=module','--check'],{input:jsx(read(name+'.jsx')),encoding:'utf8'})
  assert.equal(result.status,0,name+': '+result.stderr)
 }
})
test('Dashboard entry handler remains unique on home and scoped on other routes',async()=>{
 const source=read('Dashboard.jsx')
 const expression=source.split(/\r?\n/).find(x=>x.includes('&& <WorkInboxLink')).trim().slice(1,-1)
 globalThis.__r2Entry={h,WorkInboxLink}
 const code=jsx('export default function entry({coachRyd,view,coachPriorityItems,setView,setSelectedAthlete}) { return ('+expression+') }')
 const {default:Entry}=await import('data:text/javascript,'+encodeURIComponent('const {h:__h,WorkInboxLink}=globalThis.__r2Entry;\n'+code))
 for(const view of ['inbox','list','profile','calendar','library']) {
  const calls=[],p={coachRyd:coachRydEnabled('?coachRyd=1'),view,coachPriorityItems:[],setView:x=>calls.push(x),setSelectedAthlete:x=>calls.push(x)}
  const tree=Entry(p),button=nodes(tree).find(n=>n.type==='button'&&text(n)==='Arbejdsindbakke')
  assert.equal(Boolean(button),!['inbox','list'].includes(view))
  if(button){button.props.onClick();assert.deepEqual(calls,['inbox',null])}
  assert.equal(nodes(Entry({...p,coachRyd:false})).some(n=>n.type==='button'),false)
 }
})
test('navigation and empty inbox keep the corrected common name',async()=>{
 for(const name of ['Sidebar','MobilNav','IndbakkeView']) {
  const Component=await load(name+'.jsx')
  for(const isMobile of [false,true]) {
   if(name==='MobilNav'&&!isMobile)continue
   const tree=Component({coachRyd:true,isMobile,sidebarOpen:true,view:'inbox',athletes:[],hiddenAthleteIds:new Set(),unreadCounts:{},athleteWeekSummary:{},todayData:{logs:[]},coachPriorityItems:[],coachPriorityCount:0,latestByTrack:{},unreadByTrack:{}})
   assert.match(text(tree),/Arbejdsindbakke/);assert.doesNotMatch(text(tree),/Coach Briefing/)
  }
 }
})
