import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { mountFridaPortal } from './frida55.normal.fixture.mjs'
import { memoryStorage } from './portal.fixture.mjs'
import { draftKey, openPortalPlan } from './portalModel.mjs'
import { syntheticTables, tableNames } from './activation.fixture.mjs'

const trace = []
const hook = registerHooks({ load(url, context, next) {
  if (/frida55Extended(?:\.data)?\.mjs$/.test(url)) trace.push(url)
  return next(url, context)
} })
const launch = 'Åbn kostplan med 120 Frida-fødevarer'
const props = { enabled: true, today: '2026-11-08', athlete: { id: 'extended-athlete', age: 35, bodyweight: 80, goal: 'maintain' },
  session: { user: { id: 'extended-coach' } }, client: { from() { throw Error('Synthetic offline') } } }
const field = (ui, name) => ui.host.querySelectorAll('input,textarea,select').find(n => (n.name ?? n.getAttribute('name')) === name)
const change = (ui, name, value) => ui.invoke(field(ui, name), 'onChange', { currentTarget: { value } })
const fold = ui => ui.host.querySelectorAll('details').find(n => n.querySelector('summary')?.textContent === 'Kostplan')
const toggle = (ui, open) => ui.invoke(fold(ui), 'onToggle', { currentTarget: { open } })
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b }); return { promise, resolve, reject } }
const catalog = async () => (await import('../foedevarer/frida55ExtendedLoader.mjs')).loadExtendedCoachFoods()
const open = async ui => { await ui.click(launch); await ui.wait(() => field(ui, 'draft-food-0-0')) }
const writes = s => s.calls.filter(([op]) => op === 'set')
const preview = ui => ui.host.querySelectorAll('input').filter(n => (n.name ?? n.getAttribute('name') ?? '').startsWith('grams-'))
const build = async (ui, id) => {
  await change(ui, 'draft-name-0', 'Udvidet frokost')
  await change(ui, 'draft-time-0', '12:35')
  await change(ui, 'draft-food-0-0', id)
  await change(ui, 'draft-grams-0-0', '137,125')
}

test('cold StrictMode ordinary200 and old240 never evaluate new80; extended120 is an explicit pre-editor choice', async () => {
  try {
    assert.deepEqual(trace, [])
    await mountFridaPortal(memoryStorage(), props, async ui => {
      assert.equal(ui.host.querySelectorAll('input,select,form').length, 0)
      const retained = ui.handler(ui.find('button', launch), 'onClick')
      assert.ok(Number.parseFloat(ui.find('button', launch).style.minHeight) >= 44)
      await ui.openRaw()
      assert.equal(field(ui, 'draft-food-0-0').querySelectorAll('option').length, 201)
      await change(ui, 'draft-name-0', 'Bevar almindelig kladde')
      await ui.act(() => retained())
      assert.equal(field(ui, 'draft-name-0').value, 'Bevar almindelig kladde')
      assert.deepEqual(trace, [])
    })
    await mountFridaPortal(memoryStorage(), props, async ui => {
      await ui.open()
      assert.equal(field(ui, 'draft-food-0-0').querySelectorAll('option').length, 241)
      assert.deepEqual(trace, [])
    })
    const s = memoryStorage()
    await mountFridaPortal(s, props, async ui => {
      await open(ui)
      const { FRIDA_FOODS } = await import('../foedevarer/frida55.mjs')
      const { ADDITIONAL_FRIDA_FOODS } = await import('../foedevarer/frida55Extended.mjs')
      const options = field(ui, 'draft-food-0-0').querySelectorAll('option').slice(1)
      assert.deepEqual(options.map(n => n.getAttribute('value')), [...FRIDA_FOODS, ...ADDITIONAL_FRIDA_FOODS].map(f => f.id))
      assert.equal(options.length, 120); assert.ok(trace.length >= 2)
      assert.equal(writes(s).length, 0)
    })
  } finally { hook.deregister() }
})

test('normal120 search, actual canonical food, citation and four macros, comma grams and local meal application; ready session retains draft', async () => {
  const foods = await catalog(), food = foods[40], s = memoryStorage()
  const { catalogFoods } = await import('./model.mjs')
  assert.equal(catalogFoods((await import('../foedevarer/frida55Extended.mjs')).EXTENDED_COACH_FOODS), null)
  await mountFridaPortal(s, props, async ui => {
    const retired = ui.handler(ui.find('button', launch), 'onClick')
    await open(ui)
    await change(ui, 'draft-search-0-0', food.name)
    assert.ok(field(ui, 'draft-food-0-0').querySelectorAll('option').some(n => n.getAttribute('value') === food.id))
    await build(ui, food.id)
    assert.ok(ui.host.textContent.includes(food.preparation))
    assert.ok(ui.host.textContent.includes(food.source.citation))
    assert.ok(ui.host.textContent.includes('100 g'))
    assert.deepEqual(preview(ui), [])
    await ui.submit('Formularkladde · navngivne måltider')
    assert.deepEqual(preview(ui).map(n => n.value), ['137.125'])
    assert.ok(ui.host.textContent.includes('Udvidet frokost'))
    // Existing food snapshot/portion contract, without saving or activation.
    const c = openPortalPlan({ enabled:true, coachId:props.session.user.id, athlete:props.athlete, date:props.today,
      catalog:foods, storage:() => s }).controller
    const request = { schema:'entropi2:meal-draft:v1', coachId:props.session.user.id, athleteId:props.athlete.id,
      date:props.today, meals:[{ id:'m', name:'12:35 Udvidet frokost', items:[{ foodId:food.id, grams:137.125 }] }] }
    assert.equal(c.importMealDraft(JSON.stringify(request), c.snapshot().version), true)
    const actual = c.snapshot().meals[0].items[0]
    assert.deepEqual(actual.food.nutrition, food)
    for (const [flat, key] of Object.entries({kcal:'energyKcal',protein:'proteinG',carb:'carbohydrateG',fat:'fatG'}))
      assert.equal(c.snapshot().totals[flat], food.nutrientsPer100g[key] * (137.125 / 100))
    await change(ui, 'draft-name-0', 'Ugemt rettelse')
    await toggle(ui, false); await toggle(ui, true)
    await ui.render({ ...props, loadExtendedReferenceFoods: () => { throw Error('Must not reload a ready editor') } })
    await ui.act(() => retired())
    assert.equal(field(ui, 'draft-name-0').value, 'Ugemt rettelse')
    assert.equal(field(ui, 'draft-grams-0-0').value, '137,125')
    assert.equal(writes(s).length, 0)
  })
})

test('close before load, explicit reopen, failure/retry and invalid320 have no partial editor or late replacement', async () => {
  const first = deferred(), second = deferred(), foods = await catalog(), s=memoryStorage(); let calls=0
  const invalid = (await import('../foedevarer/frida55Extended.mjs')).EXTENDED_COACH_FOODS
  await mountFridaPortal(s, { ...props, loadExtendedReferenceFoods:() => {
    calls++; return calls === 1 ? first.promise : calls === 2 ? second.promise : Promise.resolve(calls === 3 ? invalid : foods)
  } }, async ui => {
    await ui.click(launch); assert.equal(calls,1); assert.equal(field(ui,'draft-name-0'),undefined)
    await toggle(ui,false); await ui.act(() => first.resolve(foods))
    assert.equal(field(ui,'draft-name-0'),undefined)
    await toggle(ui,true); assert.equal(calls,2)
    await ui.act(() => second.reject(Error('Synthetic failure')))
    assert.ok(ui.find('button','Prøv 120 Frida-fødevarer igen'))
    await ui.click('Prøv 120 Frida-fødevarer igen')
    await ui.wait(() => ui.find('button','Prøv 120 Frida-fødevarer igen'))
    assert.equal(calls,3)
    assert.equal(field(ui,'draft-name-0'),undefined)
    await ui.click('Prøv 120 Frida-fødevarer igen')
    await ui.wait(() => field(ui,'draft-name-0'))
    assert.equal(calls,4)
    await build(ui,foods[40].id)
    await ui.act(() => first.resolve(foods))
    assert.equal(field(ui,'draft-name-0').value,'Udvidet frokost')
    assert.equal(writes(s).length,0)
  })
})

for (const replacement of ['owner','coach','day','OFF','client','unmount']) {
  test('pending120 and retained launch retire on '+replacement, async () => {
    const gate=deferred(), foods=await catalog(), s=memoryStorage()
    const p={ ...props, loadExtendedReferenceFoods:() => gate.promise }
    await mountFridaPortal(s,p,async ui => {
      const retired=ui.handler(ui.find('button',launch),'onClick')
      await ui.click(launch)
      const patch = replacement==='owner' ? {athlete:{...props.athlete,id:'other'}}
        : replacement==='coach' ? {session:{user:{id:'other'}}} : replacement==='day' ? {today:'2026-11-09'}
          : replacement==='OFF' ? {enabled:false} : replacement==='client' ? {client:{from(){throw Error('other')}}} : null
      if (replacement==='unmount') await ui.render({enabled:false}); else await ui.render({...p,...patch})
      await ui.act(() => { gate.resolve(foods); retired() })
      if (replacement !== 'client') assert.equal(field(ui,'draft-name-0'),undefined)
      // Client changes retire the old load; the new request is allowed its own result.
      assert.equal(writes(s).length,0)
    })
  })
}

test('same scoped reserved local plan keeps busy/date/manual import guards under120', async () => {
  const foods=await catalog(), s=memoryStorage(), id=props.session.user.id
  const c=openPortalPlan({ enabled:true, coachId:id, athlete:props.athlete, date:props.today,catalog:foods,storage:()=>s }).controller
  const raw={schema:'entropi2:meal-draft:v1',coachId:id,athleteId:props.athlete.id,date:props.today,
    meals:[{id:'m',name:'Reserved',items:[{foodId:foods[40].id,grams:60.25}]}]}
  assert.equal(c.importMealDraft(JSON.stringify(raw),c.snapshot().version),true)
  assert.equal(await c.save(),true)
  const key=draftKey(id,props.athlete.id,props.today), stored=JSON.parse(s.data.get(key))
  stored.activationPending=true; s.data.set(key,JSON.stringify(stored))
  const before=s.data.get(key)
  await mountFridaPortal(s,props,async ui => {
    await open(ui)
    assert.ok(ui.host.textContent.includes('uafklaret aktivering'))
    assert.notEqual(field(ui,'plan-date').getAttribute('disabled'),null)
    const retained=ui.handler(field(ui,'draft-name-0'),'onChange')
    await ui.act(()=>retained({currentTarget:{value:'Must refuse'}}))
    assert.equal(field(ui,'draft-name-0').value,'')
    await change(ui,'plan-date','2026-11-09')
    assert.equal(field(ui,'plan-date').value,props.today)
    assert.equal(s.data.get(key),before)
  })
})

test('normal120 actual adapter intent boundary uses only synthetic tables; busy reservation rejects retained date and meal handlers',async t=>{
  t.mock.timers.enable({apis:['Date'],now:Date.parse(props.today+'T12:00:00Z')})
  const gate=deferred(), f=syntheticTables({before:call=>call.action==='insert'?gate.promise:undefined})
  const foods=await catalog(),food=foods[40],s=memoryStorage()
  await mountFridaPortal(s,{...props,client:f.client},async ui=>{
    await open(ui);await build(ui,food.id);await ui.submit('Formularkladde · navngivne måltider')
    assert.equal(f.writes().length,0)
    await ui.click('Gem som kladde');assert.equal(f.writes().length,0)
    await ui.wait(()=>ui.find('button','Aktivér for atleten')?.getAttribute('disabled')===null)
    const dateChange=ui.handler(field(ui,'plan-date'),'onChange')
    const draftChange=ui.handler(field(ui,'draft-name-0'),'onChange')
    const submit=ui.handler(ui.host.querySelectorAll('form').find(n=>n.textContent.includes('Formularkladde · navngivne måltider')),'onSubmit')
    const activate=ui.handler(ui.find('button','Aktivér for atleten'),'onClick')
    let pending
    await ui.act(()=>{pending=activate()})
    assert.notEqual(field(ui,'plan-date').getAttribute('disabled'),null)
    await ui.act(()=>{dateChange({currentTarget:{value:'2026-11-09'}});draftChange({currentTarget:{value:'Stale'}});submit({preventDefault(){}})})
    assert.equal(field(ui,'plan-date').value,props.today)
    assert.equal(field(ui,'draft-name-0').value,'Udvidet frokost')
    await ui.act(async()=>{gate.resolve();await pending})
    await ui.wait(()=>f.data[tableNames[2]].length===1)
    assert.equal(f.writes().length,3)
    const portion=f.data[tableNames[1]][0].meals[0].portions[0]
    assert.equal(portion.grams,137.125)
    assert.deepEqual(portion.food,food)
    assert.equal(f.data[tableNames[0]][0].athlete_id,props.athlete.id)
  })
})
