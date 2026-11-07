import test from 'node:test'
import assert from 'node:assert/strict'
import { createMealTemplates } from '../skabeloner/model.mjs'
import { createWeekPlan } from './model.mjs'
import { ingredientKey } from '../indkoeb/ingredients.mjs'
const athleteId = 'synthetic:r6', date = '2026-11-04'
const ingredients = [{ foodId: 'lentils', name: 'Linser', preparation: 'kogt', source: 'synthetic', quantity: 200, unit: 'g' },
  { foodId: 'rice', name: 'Ris', preparation: 'tør', source: 'synthetic', quantity: 75, unit: 'g' }]
function fixture() {
  const data = new Map(), writes = []
  const storage = { getItem: k => data.get(k) ?? null, setItem(k,v) { writes.push([k,v]); data.set(k,v) } }
  const rows = ['a','b','c'].map(id => ({ id, athlete_id: athleteId, date, meal: 'Synthetic bowl', kcal: 400, protein: 20, carb: 60, fat: 10, ingredients }))
  const library = createMealTemplates({ enabled:true, athleteId,date,storage,rows })
  const id = library.snapshot().suggestions[0].id; assert.equal(library.accept(id),true)
  const options = { enabled:true,athleteId,date,storage,templates:library.snapshot().templates }
  const plan = createWeekPlan(options)
  return { options, plan, library, id, data, writes, storage }
}

test('R6: accepted real template -> week -> shopping retains cooked lentils/dry rice through three occurrences', () => {
  const f = fixture(); f.plan.add(0,f.id); f.plan.add(0,f.id); f.plan.add(2,f.id)
  const s = f.plan.snapshot()
  assert.equal(s.shopping.selectedCount,3)
  assert.deepEqual(s.shopping.items.map(i => [i.name,i.quantity,i.preparation,i.confirmedStock,i.netPurchase]),
    [['Linser',600,'kogt',null,600],['Ris',225,'tør',null,225]])
  assert.equal(s.shopping.missingMeals.length,0)
  const readsBefore = [...f.data], writesBefore = f.writes.length
  assert.deepEqual(createWeekPlan(f.options).snapshot(), s)
  f.plan.snapshot(); f.plan.snapshot()
  assert.deepEqual([...f.data],readsBefore); assert.equal(f.writes.length,writesBefore)
})

test('R6: portions scale gross needs and macro totals; editing/removing each occurrence survives reload', () => {
  const f = fixture(); f.plan.add(0,f.id); f.plan.add(0,f.id); f.plan.add(2,f.id)
  assert.equal(f.plan.setPortions(0,0,'1,5'),true)
  let s = f.plan.snapshot()
  assert.equal(s.days[0].totals.kcal,1000)
  assert.equal(s.days[0].totals.protein,50)
  assert.equal(s.shopping.items[0].quantity,700)
  assert.equal(s.shopping.items[1].quantity,262.5)
  assert.deepEqual(createWeekPlan(f.options).snapshot(),s)
  const stored = JSON.parse(f.data.get(f.writes.at(-1)[0]))
  assert.deepEqual(stored.days[0],[f.id,f.id])
  assert.deepEqual(stored.portions,[[1.5,1],[],[1],[],[],[],[]])
  assert.equal(f.plan.remove(0,1),true)
  assert.equal(f.plan.snapshot().shopping.items[0].quantity,500)
  assert.equal(f.plan.add(6,f.id,'2'),true)
  assert.equal(f.plan.snapshot().shopping.items[0].quantity,900)
  const before = [...f.data]
  for (const value of [0,-1,'',null,true,Infinity,'1e2',1001]) assert.equal(f.plan.setPortions(0,0,value),false)
  assert.deepEqual([...f.data],before)
  assert.equal(f.plan.setPortions(0,0,1),true)
  assert.equal(typeof JSON.parse(f.data.get(f.writes.at(-1)[0])).days[0][0],'string')
})

test('R6: only confirmed stock reduces purchase, stock above gross clamps to zero without consumption on reads', () => {
  const f = fixture(); f.plan.add(0,f.id); f.plan.add(0,f.id); f.plan.add(2,f.id)
  const key = ingredientKey(f.plan.snapshot().shopping.items[0])
  assert.equal(f.plan.confirmStock(key,'700'),true)
  let s = f.plan.snapshot()
  assert.deepEqual([s.shopping.items[0].quantity,s.shopping.items[0].confirmedStock,s.shopping.items[0].netPurchase],[600,700,0])
  assert.equal(s.shopping.items[1].netPurchase,225)
  const writes = f.writes.length, saved = [...f.data]
  for (let i=0;i<3;i++) assert.deepEqual(createWeekPlan(f.options).snapshot(),s)
  assert.equal(f.writes.length,writes); assert.deepEqual([...f.data],saved)
  assert.equal(f.plan.setPortions(0,0,2),true)
  s = f.plan.snapshot(); assert.deepEqual([s.shopping.items[0].quantity,s.shopping.items[0].confirmedStock,s.shopping.items[0].netPurchase],[800,700,100])
  assert.equal(f.plan.confirmStock(key,0),true)
  assert.equal(f.plan.snapshot().shopping.items[0].netPurchase,800)
  const before = [...f.data]
  for (const bad of ['',null,-1,Infinity,true,'12g']) assert.equal(f.plan.confirmStock(key,bad),false)
  assert.equal(f.plan.confirmStock('foreign-key',10),false)
  assert.deepEqual([...f.data],before)
})

test('R6: stock writes and portions roll back on failure; malformed stored stock/portions fail closed with no writes', () => {
  const f = fixture(); f.plan.add(0,f.id)
  const key = ingredientKey(f.plan.snapshot().shopping.items[0]), original = f.storage.setItem
  f.storage.setItem = () => { throw Error('synthetic quota') }
  assert.equal(f.plan.confirmStock(key,100),false)
  assert.equal(f.plan.setPortions(0,0,2),false)
  assert.equal(f.plan.snapshot().shopping.items[0].confirmedStock,null)
  assert.equal(f.plan.snapshot().days[0].entries[0].portions,1)
  f.storage.setItem = original
  assert.equal(f.plan.confirmStock(key,100),true)
  const weekKey = f.writes.at(-1)[0], originalData = JSON.parse(f.data.get(weekKey))
  for (const change of [
    { stock:[{ key, quantity:100, confirmed:false }] }, { stock:[{ key, quantity:-1, confirmed:true }] },
    { stock:[{ key, quantity:100, confirmed:true },{ key, quantity:100, confirmed:true }] },
    { portions:[[0],[],[],[],[],[],[]] }, { portions:[[],[],[],[],[],[],[]] },
    { portions:[['2'],[],[],[],[],[],[]] }, { portions:[] },
    { days:[[{ templateId:f.id,portions:0 }],[],[],[],[],[],[]] },
    { days:[[{ templateId:f.id,portions:'2' }],[],[],[],[],[],[]] },
  ]) {
    const raw=JSON.stringify({ ...originalData,...change }); f.data.set(weekKey,raw)
    const before = f.writes.length, plan = createWeekPlan(f.options)
    assert.equal(plan.snapshot().readFailed,true)
    assert.equal(plan.add(0,f.id),false)
    assert.equal(f.writes.length,before); assert.equal(f.data.get(weekKey),raw)
  }
})

test('R6: ingredient edits refresh existing planned IDs and isolate stock by owner, week, preparation and source', () => {
  const f=fixture(); f.plan.add(0,f.id)
  const key=ingredientKey(f.plan.snapshot().shopping.items[0])
  f.plan.confirmStock(key,100)
  const edited=structuredClone(ingredients); edited[0].quantity=250
  assert.equal(f.library.setIngredients(f.id,edited),true)
  const same=createWeekPlan({ ...f.options,templates:f.library.snapshot().templates })
  assert.deepEqual([same.snapshot().shopping.items[0].quantity,same.snapshot().shopping.items[0].netPurchase],[250,150])
  for (const patch of [{ preparation:'rå' },{ source:'another source' },{ foodId:'other lentils' }]) {
    const templates=f.library.snapshot().templates; Object.assign(templates[0].ingredients[0],patch)
    const changed=createWeekPlan({ ...f.options,templates })
    assert.equal(changed.snapshot().shopping.items[0].confirmedStock,null)
    assert.equal(changed.snapshot().shopping.items[0].netPurchase,250)
  }
  for (const patch of [{ athleteId:'synthetic:other' },{ date:'2026-11-09' }]) {
    const other=createWeekPlan({ ...f.options,...patch })
    assert.equal(other.snapshot().shopping.items.length,0)
    other.add(0,f.id)
    assert.equal(other.snapshot().shopping.items[0].confirmedStock,null)
    other.confirmStock(key,999)
    assert.equal(same.snapshot().shopping.items[0].confirmedStock,100)
  }
  f.library.setIngredients(f.id,[])
  const missing=createWeekPlan({ ...f.options,templates:f.library.snapshot().templates })
  assert.equal(missing.snapshot().shopping.missingMeals.length,1)
  assert.deepEqual(missing.snapshot().shopping.items,[])
})
