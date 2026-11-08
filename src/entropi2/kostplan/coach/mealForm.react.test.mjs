import test from 'node:test'
import assert from 'node:assert/strict'
import * as vm from 'node:vm'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
if (!vm.SourceTextModule) {
 test('meal form mounted StrictMode controls (serial isolated realm child)',{timeout:180000},()=>{
  const r=spawnSync(process.execPath,['--experimental-vm-modules','--test','--test-concurrency=1',fileURLToPath(import.meta.url)],{encoding:'utf8',timeout:170000,env:{}})
  assert.equal(r.status,0,r.stdout+r.stderr)
 })
} else {
 const { mountFormPortal }=await import('./mealFormReact.fixture.mjs')
 const { memoryStorage }=await import('./portal.fixture.mjs')
 const { scope,profile,names,withDatabase }=await import('./generatorSql.fixture.mjs')
 const { createCoachPlan }=await import('./controller.mjs')
 const { openPortalPlan,draftKey }=await import('./portalModel.mjs')
 const { FOODS }=await import('../foedevarer/index.mjs')
 const p=client=>({enabled:true,athlete:profile,today:scope.date,session:{user:{id:scope.coachId}},client})
 const unavailable={from(){throw Error('synthetic unavailable')}}
 const key=draftKey(scope.coachId,profile.id,scope.date)
 const node=(ui,name)=>ui.host.querySelectorAll('input,select,textarea').find(n=>(n.name??n.getAttribute('name'))===name)
 const form=ui=>ui.host.querySelectorAll('form').find(n=>n.textContent.includes('Formularkladde · navngivne måltider'))
 const preview=ui=>ui.host.querySelectorAll('input').filter(n=>(n.name??n.getAttribute('name')??'').startsWith('grams-')).map(n=>Number(n.value))
 const change=(ui,name,value)=>ui.invoke(node(ui,name),'onChange',{currentTarget:{value}})
 const apply=ui=>ui.submit('Formularkladde · navngivne måltider')
 const saved=storage=>JSON.parse(storage.data.get(key))
 const compact=meals=>meals.map(m=>({id:m.id,name:m.name,items:m.items.map(i=>({foodId:i.food.id,grams:i.grams}))}))
 const writes=f=>f.calls.filter(c=>c.payload)
 const counts=async f=>{const c=[];for(const n of names)c.push(Number((await f.db.query(`select count(*) n from public.${n}`)).rows[0].n));return c}
 const menu=()=>['Morgenmad','Pause','Frokost','Før træning','Aftensmad','Aften'].map((name,i)=>({name,time:`${String(6+i*3).padStart(2,'0')}:15`,items:[0,1,2].map(j=>({foodId:FOODS[12+i*3+j].id,grams:63.123456789+i*11+j*7.25}))}))
 const build=async(ui,data=menu())=>{
  for(let mi=0;mi<data.length;mi++){
   if(mi)await ui.click('Tilføj måltid')
   await change(ui,`draft-name-${mi}`,data[mi].name);await change(ui,`draft-time-${mi}`,data[mi].time)
   for(let ii=0;ii<data[mi].items.length;ii++){
    if(ii)await ui.click(`Tilføj fødevare til måltid ${mi+1}`)
    await change(ui,`draft-food-${mi}-${ii}`,data[mi].items[ii].foodId)
    await change(ui,`draft-grams-${mi}-${ii}`,String(data[mi].items[ii].grams).replace('.',','))
   }
  }
 }
 const expectedMeals=data=>data.map(m=>({name:`${m.time} ${m.name}`,portions:m.items.map(i=>({grams:i.grams,food:Object.fromEntries(['id','name','preparation','basisGrams','nutrientsPer100g','source'].map(k=>[k,FOODS.find(f=>f.id===i.foodId)[k]]))}))}))
 const expectedTotals=data=>{
  const result={kcal:0,protein:0,carb:0,fat:0}
  for(const m of data)for(const i of m.items){const n=FOODS.find(f=>f.id===i.foodId).nutrientsPer100g
   result.kcal+=n.energyKcal*i.grams/100;result.protein+=n.proteinG*i.grams/100;result.carb+=n.carbohydrateG*i.grams/100;result.fat+=n.fatG*i.grams/100
  }return result
 }
 test('StrictMode actual PortalPlan: six named meals, 18 comma quantities, exact snapshot -> explicit save -> original adapter/SQL approval; repeat/reopen no extra approval',{timeout:60000},async t=>{
  // SQL approval time belongs to this historical scenario. The mounted React
  // consumer keeps its isolated realm; only the host database clock is mocked.
  // TestContext restores Date automatically, including callback/fixture failure.
  t.mock.timers.enable({apis:['Date'],now:Date.parse(`${scope.date}T12:00:00Z`)})
  return withDatabase(async f=>{
  const storage=memoryStorage(),data=menu(),original=structuredClone(profile)
  let immutable,stored
  await mountFormPortal(storage,p(f.client),async ui=>{
   await ui.open()
   const advanced=ui.host.querySelectorAll('details').find(n=>n.querySelector('summary')?.textContent==='Avanceret indlæsning')
   assert.ok(advanced);assert.equal(advanced.getAttribute('open'),null)
   const option=node(ui,'draft-food-0-0').querySelectorAll('option').find(n=>n.getAttribute('value')===FOODS[12].id)
   assert.equal(option.textContent,`${FOODS[12].name} · ${FOODS[12].preparation}`)
   await build(ui,data)
   assert.deepEqual(preview(ui),[]);assert.equal(storage.data.size,0);assert.equal(writes(f).length,0)
   await apply(ui)
   assert.deepEqual(preview(ui),data.flatMap(m=>m.items.map(i=>i.grams)))
   for(const m of data)assert.ok(ui.host.querySelectorAll('legend').some(n=>n.textContent===`${m.time} ${m.name}`))
   assert.equal(storage.data.size,0);assert.equal(writes(f).length,0)
   const submit=ui.host.querySelectorAll('button').find(n=>n.textContent==='Anvend måltidskladde')
   assert.equal(submit.style.minHeight,'44px')
   await ui.click('Gem som kladde');stored=saved(storage)
   assert.deepEqual(compact(stored.plan.meals).map(({name,items})=>({name,items})),data.map(m=>({name:`${m.time} ${m.name}`,items:m.items})))
   assert.equal(new Set(stored.plan.meals.map(m=>m.id)).size,6)
   const c=openPortalPlan({enabled:true,...scope,athlete:profile,storage:()=>storage}).controller
   const sums=expectedTotals(data);for(const k of Object.keys(sums))assert.ok(Math.abs(c.snapshot().totals[k]-sums[k])<1e-8)
   await ui.wait(()=>ui.find('button','Aktivér for atleten')?.getAttribute('disabled')===null)
   await ui.click('Aktivér for atleten');await ui.wait(()=>ui.host.textContent.includes('bekræftede aktive plan'))
   assert.deepEqual(await counts(f),[1,1,1]);immutable=(await f.db.query('select * from public.kostplan_v1_versions')).rows[0]
   assert.deepEqual(immutable.meals,expectedMeals(data))
   await apply(ui);await ui.click('Gem som kladde')
   assert.equal(saved(storage).clientVersion,stored.clientVersion);assert.deepEqual(await counts(f),[1,1,1])
  })
  await mountFormPortal(storage,p(f.client),async ui=>{
   await ui.open();await ui.wait(()=>ui.host.textContent.includes('bekræftede aktive plan'))
   assert.equal(node(ui,'draft-name-0').value,'')
   await ui.click('Hent planens måltider til formular');assert.equal(node(ui,'draft-name-0').value,'')
   await ui.click('Erstat formular med planens måltider')
   assert.equal(node(ui,'draft-name-0').value,data[0].name)
   await apply(ui);await ui.click('Gem som kladde')
   assert.equal(saved(storage).clientVersion,stored.clientVersion)
   assert.deepEqual(saved(storage).plan.meals,stored.plan.meals)
   assert.deepEqual(await counts(f),[1,1,1]);assert.notEqual(ui.find('button','Aktivér for atleten').getAttribute('disabled'),null)
  })
  assert.deepEqual((await f.db.query('select * from public.kostplan_v1_versions where id=$1',[immutable.id])).rows[0],immutable)
  assert.equal(Number((await f.db.query('select count(*) n from public.meal_logs')).rows[0].n),0)
  assert.deepEqual(profile,original)
 })
 })
 test('mounted raw errors preserve every field and original plan; add/remove uses stable IDs and duplicate names stay valid',async()=>{
  const storage=memoryStorage()
  await mountFormPortal(storage,p(unavailable),async ui=>{
   await ui.open();await build(ui,menu().slice(0,1));await apply(ui);const before=preview(ui)
   for(const [field,value,pattern] of [['draft-grams-0-0','1/2',/gram over 0/],['draft-food-0-0','unknown',/kendt fødevare/],['draft-name-0','',/Angiv et navn/],['draft-name-0','x'.repeat(201),/200 tegn/],['draft-name-0','bad\u0001name',/kontroltegn/]]){
    await change(ui,field,value);await apply(ui);if(field.startsWith('draft-food'))assert.equal(node(ui,field).querySelectorAll('option').find(n=>n.value===value)?.selected,true);else assert.equal(node(ui,field).value,value);assert.match(ui.host.textContent,pattern);assert.deepEqual(preview(ui),before)
    const alert=ui.host.querySelectorAll('div').find(n=>n.getAttribute('role')==='alert'&&n.getAttribute('tabindex')==='-1');assert.ok(alert);assert.equal(alert.ownerDocument.activeElement,alert)
   }
   await change(ui,'draft-name-0','Morgenmad');await change(ui,'draft-food-0-0',menu()[0].items[0].foodId);await change(ui,'draft-grams-0-0','81,125')
   await change(ui,'draft-food-0-1',menu()[0].items[0].foodId);await apply(ui);assert.match(ui.host.textContent,/én gang/)
   await ui.click('Fjern fødevare 2 fra måltid 1');await ui.click('Fjern fødevare 2 fra måltid 1');await ui.click('Fjern fødevare 1 fra måltid 1')
   await apply(ui);assert.match(ui.host.textContent,/1–30/);assert.deepEqual(preview(ui),before)
   await ui.click('Tilføj fødevare til måltid 1');await change(ui,'draft-food-0-0',FOODS[0].id);await change(ui,'draft-grams-0-0','20,125');await apply(ui)
   await ui.click('Gem som kladde');const id=saved(storage).plan.meals[0].id
   await ui.click('Tilføj måltid');await change(ui,'draft-name-1','Morgenmad');await change(ui,'draft-time-1','06:15');await change(ui,'draft-food-1-0',FOODS[0].id);await change(ui,'draft-grams-1-0','15')
   await apply(ui);await ui.click('Gem som kladde');assert.equal(saved(storage).plan.meals[0].id,id);assert.notEqual(saved(storage).plan.meals[1].id,id)
   await ui.click('Fjern måltid 1');await apply(ui);await ui.click('Gem som kladde');assert.notEqual(saved(storage).plan.meals[0].id,id)
  })
 })
 test('late snapshot/receipt refresh retains typed fields; explicit load confirms replacement; stale form edits/submits, owner/date/OFF/unmount are inert',async()=>{
  const storage=memoryStorage();let retained
  await mountFormPortal(storage,p(unavailable),async ui=>{
   await ui.open();await build(ui,menu().slice(0,1));await apply(ui)
   await change(ui,'draft-name-0','Usendt navn');await ui.render({...p(unavailable),nutritionRead:{state:'loading'}})
   assert.equal(node(ui,'draft-name-0').value,'Usendt navn')
   await ui.click('Kontrollér aktivering igen');assert.equal(node(ui,'draft-name-0').value,'Usendt navn')
   await ui.click('Hent planens måltider til formular');await ui.click('Behold formular');assert.equal(node(ui,'draft-name-0').value,'Usendt navn')
   await ui.click('Hent planens måltider til formular');await ui.click('Erstat formular med planens måltider');assert.equal(node(ui,'draft-name-0').value,'Morgenmad')
   const oldSubmit=ui.handler(form(ui),'onSubmit'),oldEdit=ui.handler(node(ui,'draft-name-0'),'onChange')
   await change(ui,'draft-name-0','Ny tekst');await ui.act(()=>{oldSubmit({preventDefault(){}});oldEdit({currentTarget:{value:'stale'}})})
   assert.equal(node(ui,'draft-name-0').value,'Ny tekst')
   for(const patch of [{today:'2026-11-08'},{athlete:{...profile,id:'synthetic-other'}},{session:{user:{id:'synthetic-other-coach'}}}]){
    retained=ui.handler(form(ui),'onSubmit');const edit=ui.handler(node(ui,'draft-name-0'),'onChange')
    await ui.render({...p(unavailable),...patch});await ui.act(()=>{retained({preventDefault(){}});edit({currentTarget:{value:'stale owner'}})})
    await ui.open();assert.equal(node(ui,'draft-name-0').value,'');assert.deepEqual(preview(ui),[])
   }
   retained=ui.handler(form(ui),'onSubmit');await ui.render({enabled:false});await ui.act(()=>retained({preventDefault(){}}));assert.equal(ui.host.textContent,'');assert.equal(storage.data.size,0)
  })
  retained({preventDefault(){}});assert.equal(storage.data.size,0)
 })
 test('same-scope controller replacement retires old callbacks and draft; version switch rejects stale submit before React refresh',async()=>{
  const make=()=>openPortalPlan({enabled:true,...scope,athlete:profile,storage:()=>memoryStorage()}).controller
  const c1=make(),c2=make()
  const props=c=>({controller:c,snapshot:c.snapshot(),coachId:scope.coachId})
  await mountFormPortal(memoryStorage(),props(c1),async ui=>{
   await build(ui,menu().slice(0,1));const submit=ui.handler(form(ui),'onSubmit'),edit=ui.handler(node(ui,'draft-name-0'),'onChange')
   c1.set('goal','bulk');await ui.act(()=>submit({preventDefault(){}}));assert.equal(c1.snapshot().meals.length,0)
   await ui.render(props(c2));assert.equal(node(ui,'draft-name-0').value,'')
   await ui.act(()=>{submit({preventDefault(){}});edit({currentTarget:{value:'old'}})})
   assert.equal(node(ui,'draft-name-0').value,'');assert.equal(c1.snapshot().meals.length,0);assert.equal(c2.snapshot().meals.length,0)
   await ui.render(props(c1));await ui.act(()=>submit({preventDefault(){}}));assert.equal(node(ui,'draft-name-0').value,'')
  },'./MealDraftImport.mjs')
 })
 test('mounted activation reservation blocks retained form and edits and preserves original 18-line immutable payload',{timeout:60000},async()=>withDatabase(async f=>{
  const storage=memoryStorage();let release,entered=false;const held=new Promise(r=>{release=r})
  const client={from(table){const q=f.client.from(table);let inserting=false;const proxy=new Proxy(q,{get(target,k){
   if(k==='then')return(resolve,reject)=>(async()=>{if(inserting){entered=true;await held}return await target})().then(resolve,reject)
   if(typeof target[k]==='function')return(...args)=>{if(k==='insert')inserting=true;target[k](...args);return proxy};return target[k]
  }});return proxy}}
  await mountFormPortal(storage,p(client),async ui=>{
   await ui.open();await build(ui);await apply(ui);await ui.click('Gem som kladde')
   await change(ui,'draft-grams-0-0','999,25');const retained=ui.handler(form(ui),'onSubmit'),edit=ui.handler(node(ui,'draft-grams-0-0'),'onChange')
   await ui.wait(()=>ui.find('button','Aktivér for atleten')?.getAttribute('disabled')===null)
   let activation;await ui.act(()=>{activation=ui.handler(ui.find('button','Aktivér for atleten'),'onClick')()})
   await ui.wait(()=>entered)
   try{
    assert.equal(saved(storage).activationPending,true);const bytes=storage.data.get(key),before=preview(ui)
    await ui.act(()=>{retained({preventDefault(){}});edit({currentTarget:{value:'1234'}})})
    assert.equal(node(ui,'draft-grams-0-0').value,'999,25');assert.deepEqual(preview(ui),before);assert.equal(storage.data.get(key),bytes)
   }finally{release();await ui.act(()=>activation)}
   await ui.wait(()=>ui.host.textContent.includes('bekræftede aktive plan'))
   assert.deepEqual((await f.db.query('select * from public.kostplan_v1_versions')).rows[0].meals,expectedMeals(menu()));assert.deepEqual(await counts(f),[1,1,1])
  })
 }))
 test('mounted normal form enforces 12 / 30 / 100 controls with stale add callbacks; advanced JSON and automatic generator stay available',async()=>{
  await mountFormPortal(memoryStorage(),p(unavailable),async ui=>{
   await ui.open();const oldAdd=ui.handler(ui.find('button','Tilføj måltid'),'onClick')
   for(let n=1;n<12;n++)await ui.click('Tilføj måltid')
   assert.notEqual(ui.find('button','Tilføj måltid').getAttribute('disabled'),null)
   await ui.act(()=>oldAdd());assert.equal(ui.host.querySelectorAll('input').filter(n=>(n.name??n.getAttribute('name')??'').startsWith('draft-name-')).length,12)
   for(let n=1;n<30;n++)await ui.click('Tilføj fødevare til måltid 1')
   assert.notEqual(ui.find('button','Tilføj fødevare til måltid 1').getAttribute('disabled'),null)
   for(let mi=2;mi<=4;mi++)for(let n=1;n<(mi===4?2:30);n++)await ui.click(`Tilføj fødevare til måltid ${mi}`)
   assert.match(ui.host.textContent,/100 af 100/)
   for(let mi=1;mi<=12;mi++)assert.notEqual(ui.find('button',`Tilføj fødevare til måltid ${mi}`).getAttribute('disabled'),null)
   const raw={schema:'entropi2:meal-draft:v1',...scope,meals:[{id:'json-original',name:'JSON meal',items:[{foodId:FOODS[0].id,grams:42.125}]}]}
   await change(ui,'meal-draft-json',JSON.stringify(raw));await ui.submit('Manuel måltidskladde');assert.deepEqual(preview(ui),[42.125])
   await change(ui,'meal-draft-json','{');await ui.submit('Manuel måltidskladde');assert.equal(node(ui,'meal-draft-json').value,'{');assert.match(ui.host.textContent,/Ugyldig måltidskladde/);assert.deepEqual(preview(ui),[42.125])
   const gen=ui.host.querySelectorAll('form').find(n=>n.textContent.includes('Dagens mål'));await ui.invoke(gen,'onSubmit')
   for(const name of ['Morgenmad','Frokost','Aftensmad'])assert.ok(ui.host.querySelectorAll('legend').some(n=>n.textContent===name))
  })
 })
 test('unconfirmed activation locks form across reopen; retained handlers cannot replace the reserved original',{timeout:60000},async()=>withDatabase(async f=>{
  const storage=memoryStorage();let callback
  await mountFormPortal(storage,p(f.client),async ui=>{
   await ui.open();await build(ui,menu().slice(0,1));await apply(ui);await ui.click('Gem som kladde')
   await change(ui,'draft-grams-0-0','999');callback=ui.handler(form(ui),'onSubmit')
   await ui.wait(()=>ui.find('button','Aktivér for atleten')?.getAttribute('disabled')===null)
   await ui.click('Aktivér for atleten');assert.equal(saved(storage).activationPending,true)
   const bytes=storage.data.get(key),before=preview(ui);await ui.act(()=>callback({preventDefault(){}}))
   assert.deepEqual(preview(ui),before);assert.equal(storage.data.get(key),bytes)
  })
  const bytes=storage.data.get(key),before=JSON.parse(bytes).plan.meals
  await mountFormPortal(storage,p(f.client),async ui=>{
   await ui.open();const edit=ui.handler(node(ui,'draft-name-0'),'onChange'),submit=ui.handler(form(ui),'onSubmit')
   await ui.act(()=>{callback({preventDefault(){}});edit({currentTarget:{value:'forbidden'}});submit({preventDefault(){}})})
   assert.equal(node(ui,'draft-name-0').value,'');assert.equal(storage.data.get(key),bytes)
   assert.deepEqual(saved(storage).plan.meals,before)
   assert.notEqual(ui.find('button','Hent planens måltider til formular').getAttribute('disabled'),null)
  })
 },{lost:names[1]}))

 test('busy local save rejects retained form callbacks against the actual controller snapshot',async()=>{
  let release,request;const held=new Promise(r=>{release=r})
  const c=createCoachPlan({enabled:true,localDraftOnly:true,...scope,athlete:profile,catalog:FOODS,
   basis:{...scope,maintenanceKcal:2400,protein:150,fat:60},saveDraft:async r=>{request=r;await held;return{ok:true,namespace:r.namespace,...scope,planId:'synthetic-plan',revision:'synthetic-r1',clientVersion:r.clientVersion,status:'draft'}}})
  const props=()=>({controller:c,snapshot:c.snapshot(),coachId:scope.coachId})
  await mountFormPortal(memoryStorage(),props(),async ui=>{
   await build(ui,menu().slice(0,1));await apply(ui)
   await ui.render(props());await change(ui,'draft-name-0','Not yet applied')
   const submit=ui.handler(form(ui),'onSubmit'),edit=ui.handler(node(ui,'draft-name-0'),'onChange'),before=compact(c.snapshot().meals)
   const saving=c.save()
   try{
    assert.equal(c.snapshot().busy,'save');await ui.act(()=>{submit({preventDefault(){}});edit({currentTarget:{value:'stale'}})})
    assert.equal(node(ui,'draft-name-0').value,'Not yet applied');assert.deepEqual(compact(c.snapshot().meals),before);assert.deepEqual(compact(request.plan.meals),before)
   }finally{release();await saving}
  },'./MealDraftImport.mjs')
 })

}
