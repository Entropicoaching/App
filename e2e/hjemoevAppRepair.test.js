import test from 'node:test'
import assert from 'node:assert/strict'
import { install } from './rel1030Harness.mjs'
import { reset } from './rel1030Runtime.mjs'
const hooks=install()
const { default:App }=await import('../src/App.jsx')
hooks.deregister()
const props=(search,role,preview,input={})=>{
 globalThis.window={location:{search,href:'https://synthetic.invalid/'+search}}
 reset(role,preview)
 return App(input).props.children[0].props.componentProps
}
test('actual App: normal and preview keep mobility OFF for compact-only and resolve both flags',()=>{
 for(const [role,preview] of [['athlete',false],['coach',true]]) {
  let p=props('?hjemoevKompakt=1',role,preview);assert.equal(p.hjemoevKompakt,true);assert.equal(p.mobilitetHjemme,false)
  p=props('',role,preview);assert.equal(p.hjemoevKompakt,false);assert.equal(p.mobilitetHjemme,false)
  p=props('?rel1030=1',role,preview);assert.equal(p.hjemoevKompakt,true);assert.equal(p.mobilitetHjemme,true)
  p=props('',role,preview,{hjemoevKompakt:true,mobilitetHjemme:true});assert.equal(p.hjemoevKompakt,true);assert.equal(p.mobilitetHjemme,true)
  p=props('?hjemoevKompakt=1&hjemoevKompakt=1',role,preview);assert.equal(p.hjemoevKompakt,false)
 }
 assert.equal(Object.hasOwn(props('?hjemoevKompakt=1','coach',false),'hjemoevKompakt'),false)
})
