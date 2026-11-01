import test from 'node:test'
import assert from 'node:assert/strict'
import { install, stateNames } from './homeRo2Loader.mjs'
import { reset, begin, state } from './homeRo2ViewRuntime.mjs'
import { nodes, text, renderRaw } from './homeRo2Dom.mjs'
const hooks = install()
const { default: View } = await import('./AthleteView.jsx')
const { default: Home } = await import('./athlete/HjemTab.jsx')
const { default: Enkel } = await import('./athlete/EnkelHjemTab.jsx')
const { default: Nyt } = await import('./nytIAppen.mjs')
const all = tree => nodes(tree, () => true)
const chip = n => Object.hasOwn(n.props, 'data-sekundaer')
async function fixture({ enkelPrototype = false, search = '?rel1101=1', route = 'traening', overrides = {}, ...extra } = {}) {
 const logs = [1,2,3].map(set_number => ({exercise_id:'ex',set_number,weight:40,reps_completed:5}))
 const week = {id:'week',week_number:1,sessions:[{id:'session',exercises:[{id:'ex',name:'Squat',sets:3,reps:5}]}]}
 globalThis.window = {location:{search}}
 globalThis.localStorage = {getItem:()=>null,setItem(){assert.fail('No writes')}}
 reset(stateNames,{allWeeks:[week],currentWeek:week,exerciseLogs:logs,enkelRoute:route,...overrides});begin()
 const raw = View({role:'athlete',session:{user:{id:'synthetic-user'}},enkelPrototype,...extra})
 const home = nodes(raw,n=>Object.hasOwn(n.props,'homeRo2'))[0]
 const component = home && (enkelPrototype ? (await home.type(home.props).props.factory()).default : home.type)
 const tree = home ? renderRaw(component, home.props) : null
 return {raw,home,tree,logs}
}
test('counter 1: actual default eager and lazy component identities and lazy factory remain intact', async()=>{
 for(const enkelPrototype of [false,true]) {
  const f=await fixture({enkelPrototype,search:''})
  assert.equal(f.home.type.name,enkelPrototype?'LazyEnkelHjemTab':'HjemTab')
  assert.equal(f.home.props.homeRo2,false)
  assert.equal(f.home.props.exerciseLogs,f.logs)
  if(enkelPrototype) {
   const boundary=f.home.type(f.home.props)
   assert.equal(boundary.props.label,'Hjem')
   assert.equal(boundary.props.componentProps,f.home.props)
   const actual=(await boundary.props.factory()).default
   assert.equal(actual,Enkel)
   const on1=await fixture({enkelPrototype,rel1101:true})
   const on2=await fixture({enkelPrototype,rel1101:true})
   assert.equal(on1.home.type(on1.home.props).props.factory,on2.home.type(on2.home.props).props.factory,'ON lazy factory remains stable across renders')
  } else assert.equal(f.home.type,Home)
 }
})
test('counter 2: strict gate invalid values retain OFF order and callbacks',async()=>{
 for(const enkelPrototype of [false,true]) for(const search of ['', '?rel1101=0','?rel1101=true','?rel1101=1&rel1101=1']) {
  const f=await fixture({enkelPrototype,search,route:'alle'}), list=all(f.tree)
  assert.equal(f.home.props.homeRo2,false)
  assert.ok(list.indexOf(list.find(n=>Object.hasOwn(n.props,'overviewSession'))) < list.indexOf(list.find(chip)))
 }
})
test('counter 3: actual Home ON chips precede calendar/day with three logs and original handlers',async()=>{
 for(const enkelPrototype of [false,true]) {
  const f=await fixture({enkelPrototype,route:'alle'}),list=all(f.tree),chips=list.filter(chip)
  assert.equal(chips.length,1)
  const calendar=list.find(n=>Object.hasOwn(n.props,'shownWd'))
  const day=list.find(n=>Object.hasOwn(n.props,'overviewSession'))
  assert.ok(calendar&&day)
  assert.ok(list.indexOf(chips[0])<list.indexOf(calendar))
  assert.ok(list.indexOf(chips[0])<list.indexOf(day))
  assert.equal(calendar.props.exerciseLogs,f.logs)
  assert.equal(day.props.exerciseLogs,f.logs)
  assert.equal(day.props.onLogSet,f.home.props.logDagensPasSet)
  const buttons=nodes(chips[0],n=>n.type==='button')
  assert.match(text(chips[0]),/Parathed.*Besked.*Film et sæt/)
  assert.equal(buttons[0].props.onClick,f.home.props.openReadiness)
  buttons[1].props.onClick();assert.equal(state().requestedTab,'beskeder')
  buttons[2].props.onClick();assert.equal(state().athleteVideoCoachOpen,true)
  assert.equal(state().athleteVideoCoachInstant,true)
 }
})
test('counter 4: fullscreen and news retain original position before Home; no duplicate news',async()=>{
 for(const enkelPrototype of [false,true]) {
  const f=await fixture({enkelPrototype}),list=all(f.raw)
  const full=list.filter(n=>Object.hasOwn(n.props,'onLogSet')&&Object.hasOwn(n.props,'allWeeks'))
  const news=list.filter(n=>n.type===Nyt)
  assert.equal(full.length,1);assert.equal(news.length,1)
  assert.ok(list.indexOf(full[0])<list.indexOf(news[0]))
  assert.ok(list.indexOf(news[0])<list.indexOf(f.home))
  assert.equal(full[0].props.onLogSet,f.home.props.logDagensPasSet)
  assert.equal(full[0].props.exerciseLogs,f.logs)
 }
})
test('counter 5: holiday and unrelated Enkel routes never acquire secondary chips',async()=>{
 for(const enkelPrototype of [false,true]) {
  const f=await fixture({enkelPrototype,overrides:{athlete:{id:'synthetic-athlete',status:'ferie'}}})
  assert.equal(f.home.props.onHoliday,true)
  assert.equal(nodes(f.tree,chip).length,0)
 }
 for(const route of ['traening','uge','dagsform','mere','kontakt']) assert.equal(nodes((await fixture({enkelPrototype:true,route})).tree,chip).length,0)
})
test('counter 6: explicit boolean ON and URL ON produce identical actual Home order',async()=>{
 for(const enkelPrototype of [false,true]) {
  const url=await fixture({enkelPrototype,route:'alle'})
  const prop=await fixture({enkelPrototype,route:'alle',search:'',rel1101:true})
  assert.equal(prop.home.props.homeRo2,true)
  assert.equal(JSON.stringify(prop.tree),JSON.stringify(url.tree))
 }
})
test.after(()=>hooks.deregister())
