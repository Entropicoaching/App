import test from 'node:test'
import assert from 'node:assert/strict'
import { install, stateNames } from '../homeRo2Loader.mjs'
import { reset as resetView, begin, state } from '../homeRo2ViewRuntime.mjs'
const reset = names => resetView(names, { athlete: { id: 'view-synthetic' } })
const nodes=(tree,predicate)=>!tree?.props?[]:[...(predicate(tree)?[tree]:[]),...(tree.props.children||[]).flatMap(child=>nodes(child,predicate))]
install()
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
 for (const enkelPrototype of [false, true]) {
  reset(stateNames)
  const before = [...values]
  tree=render({mobilitetHjemme:true,hjemoevKompakt:true,rel1101:true,enkelPrototype})
  assert.equal(rows(tree).length,0,'RO2 removes the Home entry only')
  for(const element of nodes(tree,n=>Object.hasOwn(n.props,'homeworkEntry'))) assert.equal(element.props.homeworkEntry,null)
  resetView(stateNames,{athlete:{id:'view-synthetic'},requestedTab:'mobilisering'})
  tree=render({mobilitetHjemme:true,hjemoevKompakt:true,rel1101:true,enkelPrototype})
  const mobility=nodes(tree,n=>n.props.label==='Mobilitet')[0]
  assert.ok(mobility.props.componentProps.homeworkEntry)
  mobility.props.componentProps.homeworkEntry.props.onClick()
  assert.equal(state().requestedTab,'mobilisering');assert.equal(state().mobilityMode,'hjemmeoevelser')
  tree=render({mobilitetHjemme:true,hjemoevKompakt:true,rel1101:true,enkelPrototype})
  assert.equal(nodes(tree,n=>n.type==='section' && n.props['aria-label']==='Dine hjemmeøvelser').length,1)
  const back=nodes(tree,n=>n.type==='button' && n.props.children.includes('← Til Mobilitet'))[0]
  back.props.onClick();assert.equal(state().mobilityMode,null)
  assert.deepEqual([...values],before,'RO2 never changes saved assignments')
 }

})
