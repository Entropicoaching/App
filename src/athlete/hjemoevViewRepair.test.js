import test from 'node:test'
import assert from 'node:assert/strict'
import { install } from './hjemoevLoader.mjs'
import { installView,stateNames } from './hjemoevViewLoader.mjs'
import { reset,begin,state } from './hjemoevViewRuntime.mjs'
const nodes=(tree,predicate)=>!tree?.props?[]:[...(predicate(tree)?[tree]:[]),...(tree.props.children||[]).flatMap(child=>nodes(child,predicate))]
install();installView()
const {default:View}=await import('../AthleteView.jsx')
const {saveHomework}=await import('../mobilityHomework.mjs')
const rows=tree=>nodes(tree,n=>n.type==='button' && n.props['aria-label']?.startsWith('Hjemmeøvelser fra din coach'))
const render=props=>{begin();return View({role:'athlete',session:{user:{id:'synthetic'}},...props})}
test('actual AthleteView: scope gate, N0 all entries, real open/back handlers and separate page',()=>{
 const values=new Map();globalThis.localStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)}
 for(const [home,compact] of [[false,false],[false,true],[true,false],[true,true]]) {
  reset(stateNames);const tree=render({mobilitetHjemme:home,hjemoevKompakt:compact})
  assert.equal(rows(tree).length,0)
  for(const element of nodes(tree,n=>Object.hasOwn(n.props,'homeworkEntry')))assert.equal(element.props.homeworkEntry,null)
 }
 saveHomework('view-synthetic',{problemId:'squat-hip',exerciseIds:['sq-mob-1']},globalThis.localStorage)
 reset(stateNames)
 let tree=render({mobilitetHjemme:false,hjemoevKompakt:true});assert.equal(rows(tree).length,0)
 tree=render({mobilitetHjemme:true,hjemoevKompakt:true})
 const entry=rows(tree);assert.equal(entry.length,1)
 const home=nodes(tree,n=>n.props.homeworkEntry)[0];assert.equal(home.props.homeworkEntry.props.onClick,entry[0].props.onClick)
 entry[0].props.onClick();assert.equal(state().requestedTab,'mobilisering');assert.equal(state().mobilityMode,'hjemmeoevelser')
 tree=render({mobilitetHjemme:true,hjemoevKompakt:true})
 assert.equal(nodes(tree,n=>n.type==='section' && n.props['aria-label']==='Dine hjemmeøvelser').length,1)
 assert.equal(nodes(tree,n=>n.props.label==='Mobilitet').length,0)
 const back=nodes(tree,n=>n.type==='button' && n.props.children.includes('← Til Mobilitet'))[0];back.props.onClick()
 tree=render({mobilitetHjemme:true,hjemoevKompakt:true});assert.equal(nodes(tree,n=>n.props.label==='Mobilitet').length,1)
 assert.equal(nodes(tree,n=>n.props.label==='Mobilitet')[0].props.componentProps.homeworkEntry.props['aria-label'],'Hjemmeøvelser fra din coach (1)')
 tree=render({mobilitetHjemme:false,hjemoevKompakt:true});assert.equal(nodes(tree,n=>n.props.label==='Mobilitet')[0].props.componentProps.homeworkEntry,null)
})
