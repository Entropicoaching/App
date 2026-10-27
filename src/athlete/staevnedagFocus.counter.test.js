import test from 'node:test'
import assert from 'node:assert/strict'
import { install } from './staevneLoader.mjs'
import { mount, nodes, button, text, io } from './staevneDom.mjs'
install()
const { default: Tab } = await import('./StaevnedagTab.jsx')
const now = new Date()
const date = [now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-')
function props() { return {athlete:{id:'counter-a',competition_date:date},meetAttempts:{bench:[{w:'100'},{w:''},{w:''}]},
  meetType:'bench',hasMeetPlan:true,meetResults:[],staevnedagFokus:true,coachAthleteId:null} }
const time = tree => nodes(tree,n=>n.type==='input' && n.props.type==='time')[0]
test('own counterexample: changing athlete or preview context clears local planner edits',()=>{
  for (const change of [p=>({...p,athlete:{...p.athlete,id:'counter-b'}}),p=>({...p,coachAthleteId:'preview-b'})]) {
    const p=props(), app=mount(Tab,p)
    time(app.render()).props.onChange({target:{value:'13:00'}})
    assert.equal(time(app.render()).props.value,'13:00')
    assert.equal(time(app.render(change(p))).props.value,'')
  }
})
test('own counterexample: missing and zero openers never become invented warmup times',()=>{
  for (const w of ['0',0,'20','',false,'1e2']) {
    const p=props(); p.meetAttempts.bench[0].w=w
    const tree=mount(Tab,p).render()
    assert.equal(nodes(tree,n=>n.type==='input' && n.props.type==='time').length,0)
    assert.match(text(tree),/Angiv en åbner over 20 kg/)
  }
})
test('own counterexample: removing every warmup stays local and reopening restores suggestions',()=>{
  const p=props(), before=JSON.stringify(p), app=mount(Tab,p)
  button(app.render(),'Rediger med coach').props.onClick()
  while (nodes(app.render(),n=>n.type==='button' && text(n)==='Fjern sæt 1').length) {
    button(app.render(),'Fjern sæt 1').props.onClick()
  }
  button(app.render(),'Brug i denne visning').props.onClick()
  assert.match(text(app.render()),/Alle sæt er fjernet lokalt/)
  assert.doesNotMatch(text(mount(Tab,p).render()),/Alle sæt er fjernet lokalt/)
  assert.equal(JSON.stringify(p),before)
  assert.equal(io.rpc,0)
})
