import './checklistHarness.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
const { FridayChecklist, FridayChecklistEntry, FRIDAY_CHECKS, openFridayCheck, readFridayChecks, saveFridayCheck } = await import('./dashboard/fridayChecklist.mjs')
import { rel1030Enabled, DEFAULT_REL1030 } from './rel1030.mjs'
import { mount, nodes, text, button, field } from './checklistDom.mjs'
const store = () => { const data = new Map(); return { data, getItem: key => data.get(key) ?? null, setItem: (key,value) => data.set(key,value) } }
const athlete = { id: 'synthetic-a', name: 'Testatlet' }
const setup = (storage = store(), coachId = 'coach-a') => {
  const calls = [], props = { enabled: true, coachId, storage, athletes: [athlete], openProfile: (...args) => calls.push(['profile', ...args]), onPreviewAthlete: (...args) => calls.push(['preview', ...args]), setView: view => calls.push(['view', view]) }
  const app = mount(FridayChecklist, props)
  return { app, calls, props, storage }
}
test('default OFF renders nothing and never touches storage', () => {
  assert.equal(DEFAULT_REL1030, false)
  for (const query of ['', '?rel1030=0', '?rel1030=1&rel1030=0']) assert.equal(rel1030Enabled(query), false)
  assert.equal(rel1030Enabled('?rel1030=1'), true)
  const storage = new Proxy({}, {get() { throw Error('Storage forbidden while off') }})
  assert.equal(mount(FridayChecklist, {storage}).render(), null)
  assert.equal(FridayChecklistEntry({}), null)
  let opened = false
  FridayChecklistEntry({enabled:true,open:()=>opened=true}).props.onClick()
  assert.equal(opened,true)
})
test('seven static points, no automatic checks, choice required', () => {
  const {app,calls} = setup(), tree=app.render()
  assert.equal(nodes(tree,n=>n.type==='input').length,7)
  assert.ok(nodes(tree,n=>n.type==='input').every(n=>!n.props.checked))
  assert.equal(nodes(tree,n=>n.props.role==='link' && n.props.disabled).length,6)
  button(tree,'Åbn Coachens oprydning').onClick()
  assert.deepEqual(calls,[['view','list']])
})
test('each rendered link uses the intended existing screen and handler', () => {
  const {app,calls}=setup()
  nodes(app.render(),n=>n.type==='select')[0].props.onChange({target:{value:athlete.id}})
  const tree=app.render()
  for(const item of FRIDAY_CHECKS) button(tree,'Åbn '+item.label).onClick()
  assert.deepEqual(calls,[['preview',athlete.id,'program'],['preview',athlete.id,'hjem'],['preview',athlete.id,'mobilisering'],['profile',athlete,'analyse'],['view','list'],['profile',athlete,'analyse'],['preview',athlete.id,'fremgang']])
})
test('checkbox handlers persist check and uncheck through remount per coach', () => {
  const {app,storage}=setup()
  nodes(app.render(),n=>n.type==='input')[0].props.onChange({target:{checked:true}})
  nodes(app.render(),n=>n.type==='input')[6].props.onChange({target:{checked:true}})
  assert.equal(nodes(setup(storage).app.render(),n=>n.type==='input')[0].props.checked,true)
  assert.equal(nodes(setup(storage,'coach-b').app.render(),n=>n.type==='input')[0].props.checked,false)
  nodes(app.render(),n=>n.type==='input')[0].props.onChange({target:{checked:false}})
  const checks=nodes(setup(storage).app.render(),n=>n.type==='input')
  assert.equal(checks[0].props.checked,false); assert.equal(checks[6].props.checked,true)
  assert.ok(!JSON.stringify([...storage.data]).includes(athlete.id))
})
test('invalid, vanished athlete and disabled route never navigate', () => {
  const {props,calls}=setup()
  for(const id of ['program','mobility','analysis','timestamps','progress']) assert.equal(openFridayCheck(id,'missing',props),false)
  assert.equal(openFridayCheck('program',athlete.id,{...props,enabled:false}),false)
  assert.equal(openFridayCheck('unknown',athlete.id,props),false)
  assert.equal(openFridayCheck('mobility',athlete.id,{...props,onPreviewAthlete:null}),false)
  assert.deepEqual(calls,[])
})
test('blocked storage has visible error and does not claim a successful check', () => {
  const storage={getItem:()=>null,setItem:()=>{throw Error('quota')}}
  const {app}=setup(storage)
  nodes(app.render(),n=>n.type==='input')[0].props.onChange({target:{checked:true}})
  const tree=app.render()
  assert.equal(nodes(tree,n=>n.type==='input')[0].props.checked,false)
  assert.match(text(nodes(tree,n=>n.props.role==='alert')[0]),/kunne ikke gemmes/)
})
test('corrupt, hostile and missing account storage stays isolated', () => {
  for(const payload of ['null','[]','{broken','{"program":"true","progress":true,"foreign":true}']) {
    const storage={getItem:()=>payload,setItem:()=>{}}
    const result=readFridayChecks('coach-a',storage)
    assert.equal(result.checked.program===true,false)
    assert.equal('foreign' in result.checked,false)
  }
  const storage=new Proxy({},{get(){throw Error('must not access')}})
  assert.ok(readFridayChecks('',storage).error)
  assert.ok(saveFridayCheck('',{},'program',true,storage).error)
  assert.ok(saveFridayCheck('a',{},'unknown',true,storage).error)
})
