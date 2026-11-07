import test from 'node:test'
import assert from 'node:assert/strict'
import { createNutritionController } from '../controller.mjs'

test('R6: template ingredient bridge preserves pending/disposed guards and never sends ingredient fields to backend',async()=>{
  const athleteId='synthetic:guards',date='2026-11-04',data=new Map(),writes=[],saves=[]
  const meal={meal:'Guarded synthetic',kcal:200,protein:10,carb:25,fat:4}
  const rows=['a','b','c'].map(id=>({...meal,id,athlete_id:athleteId,date}))
  let release
  const pending=new Promise(resolve=>{release=resolve})
  const c=createNutritionController({enabled:true,athlete:{id:athleteId},date,
    storage:{getItem:k=>data.get(k)??null,setItem(k,v){data.set(k,v);writes.push(k)}},
    contracts:{load:async()=>rows,save:async value=>{saves.push(value);return pending}}})
  await c.load()
  const id=c.snapshot().mealTemplates.suggestions[0].id;c.acceptTemplate(id)
  const logging=c.logTemplate(id,'synthetic:log')
  const before=[...data],count=writes.length
  const ingredients=[{name:'Explicit only',quantity:25,unit:'g'}]
  assert.equal(c.setTemplateIngredients(id,ingredients),false)
  assert.deepEqual([...data],before);assert.equal(writes.length,count)
  release(true);assert.equal(await logging,true)
  assert.equal(c.setTemplateIngredients(id,ingredients),true)
  assert.equal(saves.length,1);assert.deepEqual(saves[0],{...meal,athlete_id:athleteId,date})
  const saved=[...data];c.dispose()
  assert.equal(c.setTemplateIngredients(id,[]),false)
  assert.deepEqual([...data],saved)
})
