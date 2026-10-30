import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { install } from './hjemoevLoader.mjs'
install()
const { renderHomeworkEntry, renderHomeworkHome }=await import('./hjemoevKompakt.mjs')
const { MobilityHomeworkHome, saveHomework, homeworkLibrary }=await import('../mobilityHomework.mjs')
const { hjemoevKompaktEnabled }=await import('../rel1030.mjs')
const { MobilityHomeworkProgress }=await import('../mobilityAdherence.mjs')
const { createElement:h,mount,nodes,text }=await import('./hjemoevDom.mjs')
const athleteId='synthetic-review'
function store(raw=null) { let value=raw; return {getItem:()=>value,setItem:(k,v)=>{value=v}} }
function render(node){return mount(()=>node,{}).render()}

test('counterprobe: OFF and non-home routes do not read poisoned storage',()=>{
  const storage={getItem(){assert.fail('unexpected read')}}
  assert.equal(renderHomeworkEntry(h,{enabled:false,hideEmpty:true,storage}),null)
  for(const tab of ['program','mobilisering','beskeder']) assert.equal(renderHomeworkHome(h,{compact:true,tab,athleteId,storage}),null)
  for(const route of ['uge','dagsform','mere']) assert.equal(renderHomeworkHome(h,{compact:true,tab:'hjem',enkelOn:true,route,athleteId,storage}),null)
})
test('counterprobe: counts 1 through 4 come only from validated assigned IDs',()=>{
  const storage=store(),exercises=homeworkLibrary()[0].exercises
  for(let n=1;n<=4;n++) {
    assert.equal(saveHomework(athleteId,{problemId:'squat-hip',exerciseIds:exercises.slice(0,n).map(x=>x.id)},storage).error,null)
    const row=renderHomeworkEntry(h,{enabled:true,hideEmpty:true,athleteId,storage})
    assert.equal(row.props['aria-label'],`Hjemmeøvelser fra din coach (${n})`)
    assert.equal(nodes(row,x=>x.type==='button').length,1)
  }
})
test('counterprobe: malformed/foreign storage cannot expose foreign exercise content',()=>{
  for(const raw of ['{',JSON.stringify({version:1,athleteId:'foreign',value:{problemId:'squat-hip',exerciseIds:['sq-mob-1']}}),JSON.stringify({version:1,athleteId,value:{problemId:'squat-hip',exerciseIds:['foreign']}})]) {
    const storage=store(raw)
    const page=mount(MobilityHomeworkHome,{enabled:true,athleteId,storage}).render()
    assert.equal(nodes(page,n=>n.type==='li').length,0)
    assert.match(text(page),/Tildelingen kunne ikke læses/)
  }
})
test('counterprobe: no persistent activation and duplicate query values reject',()=>{
  globalThis.localStorage={getItem(){assert.fail('flag read')},setItem(){assert.fail('flag write')}}
  for(const query of ['?hjemoevKompakt=01','?HJEMOEVKOMPAKT=1','?hjemoevKompakt=1&hjemoevKompakt=0','?rel1030=true']) assert.equal(hjemoevKompaktEnabled(false,query),false)
  assert.equal(hjemoevKompaktEnabled(false,'?hjemoevKompakt=1'),true)
  assert.equal(hjemoevKompaktEnabled(false,''),false)
})
test('counterprobe: own page preserves exercise progress and reminder injection',()=>{
  const storage=store()
  saveHomework(athleteId,{problemId:'squat-hip',exerciseIds:['sq-mob-1']},storage)
  const page=render(h(MobilityHomeworkProgress,{enabled:true,athleteId,clock:()=>new Date('2026-10-30T12:00:00Z')},h(MobilityHomeworkHome,{enabled:true,athleteId,storage})))
  assert.ok(text(page).includes('Lavet i dag:'))
  assert.ok(text(page).includes('Hjalp i dag:'))
  assert.equal(nodes(page,n=>n.type==='ol')[0].props.tabIndex,-1)
})
test('counterprobe: existing assignment, warmup and before-session source bytes preserved',()=>{
  const pins=JSON.parse(readFileSync(new URL('hjemoevProtected.json',import.meta.url),'utf8'))
  for(const [path,hash] of Object.entries(pins)) assert.equal(createHash('sha256').update(readFileSync(new URL(path,import.meta.url),'utf8').replace(/\r\n/g,'\n').replace(/\n/g,'\r\n')).digest('hex'),hash,path)
})
