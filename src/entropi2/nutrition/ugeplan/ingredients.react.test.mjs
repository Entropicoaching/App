// Real ReactDOM, real mounted screen/controller/template/week/shopping modules.
// Synthetic host and facts only: no browser, backend, layout or live acceptance.
import test from 'node:test'
import assert from 'node:assert/strict'
import { act } from 'react'
import { createNutritionController } from '../controller.mjs'
import { mountNutrition } from '../view.mjs'
import { mountUgeplanReact } from './reactMount.mjs'
import { sessionReactDocument } from '../../session/sessionQuickSetReactDom.mjs'
const athleteId='synthetic:ui', date='2026-11-04'
const ingredients=[{foodId:'lentils',name:'Linser',quantity:200,unit:'g',preparation:'kogt',source:{citation:'synthetic',verification:'test only'}},
  {foodId:'rice',name:'Ris',quantity:75,unit:'g',preparation:'tør',source:'synthetic'}]
const propsOf = node => node[Object.keys(node).find(k => k.startsWith('__reactProps$'))]
const tick = () => new Promise(resolve => setImmediate(resolve))

async function screen(t, explicit=true) {
  const doc=sessionReactDocument(), host=doc.createElement('div'); doc.body.append(host)
  // React's select host contract; this is host plumbing, no product logic.
  Object.defineProperty(Object.getPrototypeOf(host),'options',{configurable:true,get(){return this.querySelectorAll('option')}})
  const previousWindow=globalThis.window, previousAct=globalThis.IS_REACT_ACT_ENVIRONMENT
  globalThis.window=doc.defaultView; globalThis.IS_REACT_ACT_ENVIRONMENT=true
  const data=new Map(), writes=[], backend=[]
  const storage={getItem:k=>data.get(k)??null,setItem(k,v){writes.push(k);data.set(k,v)}}
  const rows=['a','b','c'].map(id=>({id,athlete_id:athleteId,date,meal:'Synthetic <bowl>',kcal:400,protein:20,carb:60,fat:10,
    ...(explicit?{ingredients:structuredClone(ingredients)}:{})}))
  const controller=createNutritionController({enabled:true,athlete:{id:athleteId},date,storage,
    contracts:{load:async()=>rows,save:async payload=>{backend.push(payload);return true}}})
  let dispose
  await act(async()=>{dispose=mountNutrition(host,controller,{mountWeekPlan:mountUgeplanReact});await tick()})
  t.after(async()=>{
    await act(async()=>dispose())
    if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow
    if(previousAct===undefined)delete globalThis.IS_REACT_ACT_ENVIRONMENT;else globalThis.IS_REACT_ACT_ENVIRONMENT=previousAct
  })
  const all=tag=>host.querySelectorAll(tag), button=label=>all('button').find(n=>n.textContent===label)
  const click=async label=>{const b=button(label);assert.ok(b,label);await act(async()=>b.click())}
  const fold=()=>all('details').find(n=>n.getAttribute('data-focus')==='week-plan')
  const open=async()=>{await act(async()=>{fold().open=true;fold().dispatch('toggle');await tick()})}
  const select=async day=>{
    const node=all('select').find(n=>n.getAttribute('data-focus')===`week-plan-add-${day}`)
    assert.ok(node)
    const id=node.options[1].getAttribute('value')
    await act(async()=>propsOf(node).onChange({currentTarget:{value:id}}))
  }
  const submit=async (form,name,value)=>act(async()=>propsOf(form).onSubmit({preventDefault(){},currentTarget:{elements:{[name]:{value}}}}))
  return {host,doc,data,writes,backend,controller,all,button,click,open,select,submit}
}

test('R6 real mounted UI: save template, three occurrences, portions, stock above need, ingredient edits and reopen', async t=>{
  const f=await screen(t)
  await f.click('Gem skabelon: Synthetic <bowl>')
  const template=f.controller.weekPlanInputs().templates[0]
  assert.deepEqual(template.ingredients,ingredients)
  await f.open();await f.select(0);await f.select(0);await f.select(2)
  assert.match(f.host.textContent,/Linser: 600 g/);assert.match(f.host.textContent,/Ris: 225 g/)
  assert.match(f.host.textContent,/Tilberedning: kogt/);assert.match(f.host.textContent,/Kilde: synthetic \(test only\)/)
  const stockForm=f.all('form').find(n=>n.querySelectorAll('input').some(i=>i.name==='stock'))
  await f.submit(stockForm,'stock','700')
  assert.match(f.host.textContent,/Bekræftet beholdning: 700 g\.\s+Nettokøb: 0 g/)
  const portionForm=f.all('form').find(n=>n.querySelectorAll('input').some(i=>i.name==='portions'))
  await f.submit(portionForm,'portions','2')
  assert.match(f.host.textContent,/Linser: 800 g/);assert.match(f.host.textContent,/Nettokøb: 100 g/)
  // Edit through the actual template editor, which is reachable even when log choices deduplicate.
  const amount=f.all('input').find(n=>n.getAttribute('data-focus')==='template-ingredients-0-0-quantity')
  assert.ok(amount);amount.value='250';amount.dispatch('input',{target:amount})
  await f.click('Gem ingredienser')
  assert.match(f.host.textContent,/Linser: 1.000 g/)
  assert.match(f.host.textContent,/Bekræftet beholdning: 700 g\.\s+Nettokøb: 300 g/)
  assert.equal(f.controller.weekPlanInputs().templates[0].id,template.id)
  assert.deepEqual(f.backend,[])
  const before=f.writes.length,raw=[...f.data]
  await act(async()=>{f.controller.toggleHistory();await tick()})
  assert.equal(f.writes.length,before);assert.deepEqual([...f.data],raw)
  assert.match(f.host.textContent,/Linser: 1.000 g/)
  assert.ok(f.writes.every(k=>k.includes(':skabeloner:v1:')||k.includes(':ugeplan:v1:')))
})

test('R6 real mounted UI: legacy template is visibly incomplete; explicit entry, invalid edit and removal use actual handlers',async t=>{
  const f=await screen(t,false)
  await f.click('Gem skabelon: Synthetic <bowl>');await f.open();await f.select(0)
  assert.match(f.host.textContent,/Listen er ufuldstændig: 1/)
  assert.match(f.host.textContent,/Ingredienser mangler/)
  assert.ok(f.all('summary').some(n=>n.textContent==='Ugens indkøbsliste · ufuldstændig'))
  assert.ok(f.all('summary').some(n=>n.textContent==='Ingredienser: Synthetic <bowl> · mangler'))
  assert.doesNotMatch(f.host.textContent,/Nettokøb:/)
  await f.click('Tilføj ingrediens')
  for(const [key,value]of Object.entries({name:'Explicit rice',quantity:'0,075',unit:'kg',foodId:'synthetic:rice',preparation:'tør',source:'synthetic input'})){
    const input=f.all('input').find(n=>n.getAttribute('data-focus')===`template-ingredients-0-0-${key}`)
    assert.ok(input,key);input.value=value;input.dispatch('input',{target:input})
  }
  await f.click('Gem ingredienser')
  assert.match(f.host.textContent,/Explicit rice: 75 g/)
  const input=f.all('input').find(n=>n.getAttribute('data-focus')==='template-ingredients-0-0-quantity')
  input.value='-1';input.dispatch('input',{target:input})
  const before=f.writes.length
  await f.click('Gem ingredienser')
  assert.equal(f.writes.length,before)
  assert.match(f.host.textContent,/Ingredienser blev ikke gemt/)
  assert.match(f.host.textContent,/Explicit rice: 75 g/)
  assert.equal(f.all('input').find(n=>n.getAttribute('data-focus')==='template-ingredients-0-0-quantity').value,'-1')
  await f.click('Fjern ingrediens');await f.click('Gem ingredienser')
  assert.match(f.host.textContent,/Listen er ufuldstændig: 1/)
  assert.doesNotMatch(f.host.textContent,/Nettokøb:/)
  assert.deepEqual(f.backend,[])
})
