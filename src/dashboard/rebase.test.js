import './rebasePageLoader.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { walk, text, createElement as h } from './rebaseDom.mjs'
import { resolve as resolveReader } from './coachWeekTestLoader.mjs'
import { resolve as resolvePage } from './rebasePageLoader.mjs'
const { default: Forside } = await import('./ForsideView.jsx')
const { renderWeekOverview } = await import('./coachWeekOverview.mjs')
const athletes=[{id:'a',name:'Anne'},{id:'b',name:'Bo'},{id:'hidden',name:'Hidden'}]
const week={id:'w',week_number:1,planned_sets:10}
function props(openProfile){return {athletes,hiddenAthleteIds:new Set(['hidden']),calendarWeeks:Object.fromEntries(athletes.map(a=>[a.id,[week]])),athleteCurrentWeek:{},athleteWeekCompletion:{a:{'id:w':{coachWeekSets:9}},b:{'id:w':{coachWeekSets:1}}},athleteWeekSummary:{},athleteLastLogs:{},unreadCounts:{},videoMeasurementByAthlete:{},coachPriorityItems:[],coachBriefingSeen:{},coachPriorityCount:0,coachWeekDataStatus:{plan:'ready',logs:'ready'},openProfile}}
test('actual Forside explicitly opens deviation-sorted visible athletes on Log',()=>{
 const calls=[];const tree=Forside({...props((...a)=>calls.push(a)),coachWeekEnabled:true})
 const section=walk(tree,n=>n.props?.['data-coach-week'])[0]
 assert.ok(section);assert.ok(!text(section).includes('Hidden'))
 const buttons=walk(section,n=>n.type==='button');assert.equal(buttons.length,2)
 buttons.forEach(n=>n.props.onClick())
 assert.deepEqual(calls,[[athletes[1],'log'],[athletes[0],'log']])
})
test('actual Forside default and explicit OFF have identical tree and no overview',()=>{
 const p=props(()=>assert.fail('click'))
 const snapshot = tree => JSON.stringify(tree, (key,value) => typeof value === 'function' ? '[handler]' : value)
 assert.equal(snapshot(Forside(p)),snapshot(Forside({...p,coachWeekEnabled:false})))
 assert.equal(walk(Forside(p),n=>n.props?.['data-coach-week']).length,0)
})
test('shared renderer retains Program default and rejects unintended tab values',()=>{
 for(const profileTab of [undefined,'analyse','LOG',null]){
  let call;const tree=renderWeekOverview(h,{enabled:true,entries:[{athlete:athletes[0],current:week}],completion:{},status:{plan:'ready',logs:'ready'},profileTab,openProfile:(...a)=>call=a})
  walk(tree,n=>n.type==='button')[0].props.onClick();assert.deepEqual(call,[athletes[0],'program'])
 }
})
test('closed loaders reject unpinned, basename-alias and case-folded dependencies',()=>{
 const root=new URL('./',import.meta.url);const next=()=>{throw Error('unexpected fallback')}
 for(const spec of ['./unapproved.mjs','../wrong/coachWeekOverview.mjs','./CoachWeekOverview.mjs','node:fs']){
  assert.throws(()=>resolveReader(spec,{parentURL:new URL('laesninger.js',root).href},next),/Unpinned dependency/)
  assert.throws(()=>resolvePage(spec,{parentURL:new URL('ForsideView.jsx',root).href},next),/Unpinned Forside dependency/)
 }
})
