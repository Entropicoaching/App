import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { install } from '../../scripts/restMobilityLoader.mjs'
install()
const { restMobilityText } = await import('./restMobility.mjs')
test('actual helper remains read-only, boolean opt-in and athlete scoped', () => {
 const focus={athleteId:'synthetic-a',lift:'Squat',need:'Mere dybde'}
 const storage={getItem(){throw Error('OFF must not read')},setItem(){assert.fail('write')}}
 for(const enabled of [undefined,false,1,'true']) assert.equal(restMobilityText({enabled,athleteId:'synthetic-a',homeworkEnabled:true,storage,focus}),null)
 assert.equal(restMobilityText({enabled:true,athleteId:'other',focus}),null)
 assert.match(restMobilityText({enabled:true,athleteId:'synthetic-a',focus}),/fem minutter/)
})
// Each legacy loader is exercised in a fresh process in actual src/scripts layout.
for (const loader of ['forenkl6','hvile','prog2','prog5','vaerd5','trin1']) {
 test('native layout and closed new edges: '+loader, () => {
  const path = loader === 'trin1' ? '../trin1Loader.mjs' : './'+loader+'Loader.mjs'
  const parent = new URL('./RestDays.jsx',import.meta.url).href
  const helperParent = new URL('./restMobility.mjs',import.meta.url).href
  const code = `
   import assert from 'node:assert/strict';
   import {registerHooks} from 'node:module';
   const {install}=await import(${JSON.stringify(new URL(path,import.meta.url).href)});
   install();
   registerHooks({resolve(s,c,next){
    if(s.startsWith('probe:')) {const [specifier,parentURL]=JSON.parse(s.slice(6));return next(specifier,{...c,parentURL})}
    return next(s,c);
   }});
   const load=(s,p)=>import('probe:'+JSON.stringify([s,p]));
   const {default:RestDays}=await load('./RestDays.jsx',${JSON.stringify(new URL('./ProgramTab.jsx',import.meta.url).href)});
   assert.equal(typeof RestDays,'function');
   const {restMobilityText}=await load('./restMobility.mjs',${JSON.stringify(parent)});
   assert.equal(restMobilityText(),null);
   for(const s of ['./restMobility','../restMobility.mjs','./x/../restMobility.mjs','./restMobility.mjs?x','./restMobility.mjs#x','./RESTMOBILITY.mjs','./restMobility.MJS','./restMobility%2Emjs','./x'+String.fromCharCode(92)+'..'+String.fromCharCode(92)+'restMobility.mjs'])
    await assert.rejects(load(s,${JSON.stringify(parent)}),/Unapproved|Closed/);
   for(const s of ['node:fs','node:child_process','https://example.invalid/module','./unknown.mjs','./x/../mobilityFocus.mjs','../athlete/mobilityFocus.mjs'])
    await assert.rejects(load(s,${JSON.stringify(helperParent)}),/Unapproved|Closed/);
  `
  const result=spawnSync(process.execPath,['--input-type=module','-e',code],{encoding:'utf8'})
  assert.equal(result.status,0,result.stdout+result.stderr)
 })
}
test('text reader protects rest properties without reversing unrelated source', () => {
 const code=readFileSync(new URL('./reb2HvileCounter.test.js',import.meta.url),'utf8')
 assert.ok(code.includes("assertSourceProperties('program-rest', source('ProgramTab.jsx'))"))
})
