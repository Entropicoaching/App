import './checklistHarness.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
const { FridayChecklist, openFridayCheck }=await import('./dashboard/fridayChecklist.mjs')
import {mount,nodes,text} from './checklistDom.mjs'
test('counterexample: account switch through keyed remount cannot reuse checks',()=>{
  const data=new Map(),storage={getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value)}
  const props={enabled:true,coachId:'a',storage,athletes:[],setView:()=>{}}
  const first=mount(FridayChecklist,props)
  nodes(first.render(),n=>n.type==='input')[2].props.onChange({target:{checked:true}})
  const second=mount(FridayChecklist,{...props,coachId:'b'})
  assert.ok(nodes(second.render(),n=>n.type==='input').every(n=>!n.props.checked))
})
test('counterexample: removed selected athlete is disabled on next render',()=>{
  let called=false
  const props={enabled:true,coachId:'a',storage:{getItem:()=>null},athletes:[{id:'x',name:'Synthetic'}],onPreviewAthlete:()=>called=true,setView:()=>{}}
  const app=mount(FridayChecklist,props)
  nodes(app.render(),n=>n.type==='select')[0].props.onChange({target:{value:'x'}})
  const tree=app.render({...props,athletes:[]})
  assert.equal(nodes(tree,n=>n.props.role==='link' && n.props.disabled).length,6)
  assert.equal(openFridayCheck('mobility','x',{...props,athletes:[]}),false)
  assert.equal(called,false)
})
test('counterexample: read failure is visible and no shared fallback key is written',()=>{
  let writes=0
  const storage={getItem:()=>{throw Error('blocked')},setItem:()=>writes++}
  const app=mount(FridayChecklist,{enabled:true,coachId:'a',storage,athletes:[]})
  assert.match(text(nodes(app.render(),n=>n.props.role==='alert')[0]),/kunne ikke læses/)
  assert.equal(writes,0)
})
