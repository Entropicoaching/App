import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { install } from './hjemoevLoader.mjs'
install()
const { compactHomeworkEnabled, renderHomeworkEntry, renderHomeworkHome } = await import('./hjemoevKompakt.mjs')
const { MobilityHomeworkHome, saveHomework } = await import('../mobilityHomework.mjs')
const { createElement:h, mount, nodes, text } = await import('./hjemoevDom.mjs')
const { default:Hjem } = await import('./HjemTab.jsx')
const { default:Mobilitet } = await import('./MobiliseringTab.jsx')
const source = file => readFileSync(new URL(file,import.meta.url),'utf8')
const memory = () => { const data=new Map(); return { getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v) } }
const athleteId='repair-synthetic'
const options={tab:'hjem',enkelOn:false,route:'traening',athleteId,Home:MobilityHomeworkHome}
const show=node=>mount(()=>node,{}).render()
const entries=tree=>nodes(tree,n=>n.type==='button' && n.props['aria-label']?.startsWith('Hjemmeøvelser fra din coach'))

test('repair counterprobe: strict AND gate and compact-only never touches storage',()=>{
 for(const enabled of [undefined,false,null,0,1,'true',true]) for(const flag of [undefined,false,null,0,1,'true',true]) {
  assert.equal(compactHomeworkEnabled(enabled,flag),enabled===true && flag===true)
 }
 const storage={getItem(){assert.fail('disabled read')},setItem(){assert.fail('write')}}
 assert.equal(renderHomeworkHome(h,{...options,compact:true,enabled:false,storage}),null)
 assert.equal(renderHomeworkEntry(h,{enabled:compactHomeworkEnabled(false,true),athleteId,storage}),null)
 const view=source('../AthleteView.jsx')
 assert.match(view,/const compactHomework = compactHomeworkEnabled\(mobilitetHjemme, hjemoevKompakt\)/)
 assert.match(view,/enabled: compactHomework, athleteId: athlete\?\.id/)
 assert.match(view,/compactHomework && tab === 'mobilisering' && mobilityMode === 'hjemmeoevelser'/)
 assert.match(view,/enabled=\{mobilitetHjemme\} athleteId=\{athlete\?\.id\}/)
})

test('repair counterprobe: N0 hidden in actual Home/Mere and Mobilitet trees',()=>{
 const storage=memory(),enabled=compactHomeworkEnabled(true,true)
 const entry=renderHomeworkEntry(h,{enabled,athleteId,storage})
 assert.equal(entry,null)
 assert.equal(renderHomeworkHome(h,{...options,compact:true,enabled:true,storage}),null)
 for(const mereOpen of [false,true]) assert.equal(entries(mount(Hjem,{tab:'hjem',onHoliday:true,athlete:{id:athleteId},mereOpen,homeworkEntry:entry}).render()).length,0)
 assert.equal(entries(mount(Mobilitet,{mobilityMode:null,homeworkEntry:entry}).render()).length,0)
})

test('repair counterprobe: N1 count and shared navigation handler on all entries, no writes',()=>{
 const storage=memory(); saveHomework(athleteId,{problemId:'squat-hip',exerciseIds:['sq-mob-1']},storage)
 const readonly={getItem:storage.getItem,setItem(){assert.fail('entry write')}}
 let mode,tab; const onOpen=()=>{mode='hjemmeoevelser';tab='mobilisering'}
 const entry=renderHomeworkEntry(h,{enabled:true,athleteId,storage:readonly,onOpen})
 const trees=[show(renderHomeworkHome(h,{...options,compact:true,enabled:true,storage:readonly,onOpen})),show(entry),mount(Mobilitet,{mobilityMode:null,homeworkEntry:entry}).render()]
 for(const tree of trees) {const rows=entries(tree);assert.equal(rows.length,1);assert.match(text(rows[0]),/\(1\)/);rows[0].props.onClick();assert.equal(mode,'hjemmeoevelser');assert.equal(tab,'mobilisering')}
 assert.equal(renderHomeworkEntry(h,{enabled:true,athleteId:'foreign',storage:readonly}),null)
})

test('repair counterprobe: source keeps old branch and appends new imports/props',()=>{
 const view=source('../AthleteView.jsx'),app=source('../App.jsx')
 assert.match(view,/\{!compactHomework && \(<>\s*<MobilityHomeworkProgress enabled=\{mobilitetOpfoelgning === true && !coachAthleteId\}/)
 assert.equal((app.match(/componentProps=\{\{ \.\.\.rel3\.athlete[^\n]*, hjemoevKompakt\}\}/g)||[]).length,2)
 assert.ok(app.indexOf("import { hjemoevKompaktEnabled }")>app.indexOf("import { rel1030Mobility }"))
 assert.ok(view.indexOf("import { compactHomeworkEnabled")>view.indexOf("import { tomtIndeks"))
})
