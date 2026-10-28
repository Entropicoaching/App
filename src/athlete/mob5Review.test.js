import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { install, moduleURL } from './mob5Loader.mjs'
install(process.argv.includes('--crlf') ? '\r\n' : '\n')
const { mount, nodes, text, button } = await import('./mob4Dom.mjs')
const { default: Notes } = await import(moduleURL('NoterTab.jsx'))
const { CoachMobilityEditor, CoachMobilitySummary } = await import('./CoachMobility.jsx')
const { coachNotes, readCoachChoices, saveCoachChoices } = await import('./coachMobility.mjs')
const { WARMUP_BASE } = await import('./mobilityCatalog.mjs')
const athlete = {id:'a',coach_id:'c',notes:'Syntetisk fritekst'}
const choices = { Squat: { need:'Mere dybde',ids:['sq-mob-2'] } }
const stored = {...athlete,notes:coachNotes('a',athlete.notes,choices,WARMUP_BASE)}
function fake(result) {
  const calls=[]
  const q={update: value=>{calls.push(['update',value]);return q},eq:(...v)=>{calls.push(['eq',...v]);return q},is:(...v)=>{calls.push(['is',...v]);return q},select:()=>q,single:async()=>result}
  return {calls,from:()=>q}
}
test('counterexample 1: normal notes editor hides metadata and preserves choices on actual save',async()=>{
  let edited,updated
  const nextNotes=coachNotes('a','Ny fritekst',choices,WARMUP_BASE)
  const client=fake({data:{...stored,notes:nextNotes},error:null})
  const app=mount(Notes,{a:stored,editData:{notes:'Ny fritekst'},editing:null,mobilitetCoach:true,mobilityCoachId:'c',mobilityClient:client,
    onMobilitySaved:value=>{updated=value},setSaving(){},showFlash(){assert.fail('unexpected error')},setEditing(){},startEdit:(key,value)=>{edited=value}})
  let tree=app.render();assert.ok(!text(tree).includes('HARA-MOBILITY'))
  button(tree,'Rediger').props.onClick();assert.equal(edited.notes,athlete.notes)
  tree=app.render({...{a:stored,editData:{notes:'Ny fritekst'},editing:'notes',mobilitetCoach:true,mobilityCoachId:'c',mobilityClient:client,onMobilitySaved:value=>{updated=value},setSaving(){},showFlash(){assert.fail('unexpected error')},setEditing(){}}})
  await button(tree,'Gem').props.onClick()
  assert.deepEqual(readCoachChoices(true,'a',updated.notes,WARMUP_BASE).choices,choices)
  assert.ok(updated.notes.startsWith('Ny fritekst'))
})
test('counterexample 2: failed actual editor save stays visible, preserves draft and never claims success',async()=>{
  const client=fake({data:null,error:{message:'synthetic conflict'}})
  const app=mount(CoachMobilityEditor,{enabled:true,athlete:stored,coachId:'c',client,onSaved(){assert.fail('false success')}})
  let tree=app.render();await button(tree,'Gem mobilitetsvalg').props.onClick();tree=app.render()
  assert.ok(text(tree).includes('Valget blev ikke gemt'))
  assert.ok(!text(tree).includes('Mobilitetsvalg gemt.'))
  assert.ok(nodes(tree,n=>n.type==='button'&&n.props['aria-pressed']===true).length)
})
test('counterexample 3: empty note save compares SQL NULL and never stringifies it',async()=>{
  const row={...athlete,notes:null},target=coachNotes('a',null,choices,WARMUP_BASE)
  const client=fake({data:{...row,notes:target},error:null})
  assert.equal((await saveCoachChoices({enabled:true,client,coachId:'c',athlete:row,choices,library:WARMUP_BASE})).error,null)
  assert.ok(client.calls.some(row=>row[0]==='is'&&row[1]==='notes'&&row[2]===null))
})
test('counterexample 4: truthy strings and foreign coach never enable editor or summary',()=>{
  for(const enabled of [undefined,false,'true',1,{}]) {
    assert.equal(CoachMobilityEditor({enabled,athlete:stored,coachId:'c'}),null)
    assert.equal(CoachMobilitySummary({enabled,athleteId:'a',notes:stored.notes}),null)
  }
  assert.equal(CoachMobilityEditor({enabled:true,athlete:stored,coachId:'other'}),null)
})
test('counterexample 5: corrupt and foreign payloads cannot overwrite existing note text',async()=>{
  for(const notes of [stored.notes.replace('sq-mob-2','unknown'),stored.notes.replace('"athleteId":"a"','"athleteId":"b"'),stored.notes+'\n[/HARA-MOBILITY-V1]']) {
    const client={from(){assert.fail('corrupt write')}}
    assert.ok((await saveCoachChoices({enabled:true,client,coachId:'c',athlete:{...stored,notes},choices,library:WARMUP_BASE})).error)
  }
})
test('counterexample 6: actual root wiring keeps new flag strict and out of Friday opt-in',()=>{
  const app=readFileSync(moduleURL('App.jsx') || new URL('../App.jsx',import.meta.url),'utf8')
  assert.match(app,/mobilitetCoach = false/)
  assert.equal((app.match(/mobilitetCoach: mobilitetCoach === true/g)||[]).length,3)
  assert.ok(!/mobilitetCoach:\s*mobilitetCoach === true\s*\|\|/.test(app))
  const dashboard=readFileSync(moduleURL('Dashboard.jsx') || new URL('../Dashboard.jsx',import.meta.url),'utf8')
  assert.match(dashboard,/previous\?\.id === updated.id \? updated : previous/)
})
test('counterexample 7: new module dependencies cannot escape synthetic import allowlist',async t=>{
  for (const loader of ['mob5Loader.mjs','mob3Loader.mjs','mob4Loader.mjs','mobilityTestLoader.mjs','fridayHermeticLoader.mjs','coachRydHarness.mjs']) {
    const loaderURL = ['./', '../', '../../e2e/'].map(prefix => new URL(prefix + loader, import.meta.url)).find(existsSync)
    await t.test(loader, { skip: loader === 'fridayHermeticLoader.mjs' && !loaderURL ? 'Not pinned: e2e/fridayHermeticLoader.mjs on a10e1041' : false }, () => {
    assert.ok(loaderURL, 'Missing synthetic loader: ' + loader)
    const custom = loader === 'coachRydHarness.mjs'
    const script=`import assert from 'node:assert/strict';import {registerHooks} from 'node:module';
      const loader=await import(${JSON.stringify(loaderURL.href)});
      ${custom ? "const load=await loader.app();" : "loader.install();"}
      ${custom ? "await load('coachMobility.mjs');" : "await import('./coachMobility.mjs');"}
    `
    const normal=spawnSync(process.execPath,['--input-type=module','-e',script],{cwd:new URL('./',import.meta.url),encoding:'utf8',timeout:10000})
    assert.equal(normal.status,0,loader+normal.stdout+normal.stderr)
    const mutated=script.replace(custom ? "await load('coachMobility.mjs');" : "await import('./coachMobility.mjs');", `
      registerHooks({load(url,context,next){if(url.endsWith('/coachMobility.mjs'))return {format:'module',shortCircuit:true,source:'import "node:fs";'};return next(url,context)}});
      await assert.rejects(${custom ? "load('coachMobility.mjs')" : "import('./coachMobility.mjs')"},/Forbidden synthetic import: node:fs|Ukendt hermetisk import: node:fs|Unapproved dependency: node:fs/);`)
    const result=spawnSync(process.execPath,['--input-type=module','-e',mutated],{cwd:new URL('./',import.meta.url),encoding:'utf8',timeout:10000})
    assert.equal(result.status,0,loader+result.stdout+result.stderr)
    })
  }
})
