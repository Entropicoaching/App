import test from 'node:test'
import assert from 'node:assert/strict'
import { install } from './hjemoevLoader.mjs'
install()
const { MobilityHomeworkHome, saveHomework } = await import('../mobilityHomework.mjs')
const { default: Hjem } = await import('./HjemTab.jsx')
const { default: PinnedHome } = await import('./hjemoevBaseHjemTab.txt')
const { mount, text, nodes } = await import('./hjemoevDom.mjs')
const values=new Map(), storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)}
test('pinned baseline OFF homework does not touch storage',()=>{
  assert.equal(mount(MobilityHomeworkHome,{athleteId:'synthetic-base',storage:{getItem(){assert.fail('OFF read')}}}).render(),null)
})
test('pinned baseline uses existing assignment and local notice',()=>{
  assert.equal(saveHomework('synthetic-base',{problemId:'squat-hip',exerciseIds:['sq-mob-1']},storage).error,null)
  const tree=mount(MobilityHomeworkHome,{enabled:true,athleteId:'synthetic-base',storage}).render()
  assert.equal(nodes(tree,n=>n.type==='li').length,1)
  assert.match(text(tree),/Ikke sendt til atletens anden enhed/)
})
test('pinned baseline Hjem holiday DOM equals untouched pinned fixture',()=>{
  const props={tab:'hjem',onHoliday:true,athlete:{id:'synthetic-base'}}
  assert.equal(JSON.stringify(mount(Hjem,props).render()),JSON.stringify(mount(PinnedHome,props).render()))
})
