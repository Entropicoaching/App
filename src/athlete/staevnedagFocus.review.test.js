import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { install } from './staevneLoader.mjs'
import { mount, nodes, text, button, io } from './staevneDom.mjs'
install()
const { default: Tab } = await import('./StaevnedagTab.jsx')
const today = new Date()
const localDate = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0'), String(today.getDate()).padStart(2, '0')].join('-')
function make(extra = {}) {
  return { athlete: { id: 'review', competition_date: localDate }, meetType: 'bench', hasMeetPlan: true,
    meetAttempts: { bench: [{ w: '100', r: null }, { w: '', r: null }, { w: '', r: null }] },
    meetResults: [], coachAthleteId: 'synthetic-review', staevnedagFokus: true, ...extra }
}
const isFocus = n => n.props['aria-label'] === 'Det vigtigste på stævnedagen'
test('review: local time edits survive opener rerenders and reset only on a new opener key', () => {
  const props = make(), app = mount(Tab, props)
  let tree = app.render()
  nodes(tree, n => n.type === 'input' && n.props.type === 'time')[0].props.onChange({target:{value:'12:00'}})
  assert.match(text(app.render()), /11:35/)
  assert.match(text(app.render({...props, meetPlanNotes:'Changed note'})), /11:35/)
  const changed = {...props, meetAttempts:{bench:[{w:'110'}, {w:''}, {w:''}]}}
  tree = app.render(changed)
  assert.equal(nodes(tree,n=>n.type==='input' && n.props.type==='time')[0].props.value,'')
  assert.match(text(nodes(tree,isFocus)[0]), /110 kg/)
})
test('review: malformed and empty openers have explicit missing state and no invented times', () => {
  for (const w of ['', null, true, 'NaN', Infinity, '-20', '1001']) {
    const tree = mount(Tab, make({meetAttempts:{bench:[{w}]}})).render()
    assert.match(text(nodes(tree,isFocus)[0]), /Åbner mangler/)
    assert.equal(nodes(tree,n=>n.type==='input' && n.props.type==='time').length,0)
    assert.doesNotMatch(text(tree), /NaN kg|Infinity kg/)
  }
})
test('review: invalid warmup edits remain local with an error and can be cancelled', () => {
  const props=make(), before=JSON.stringify(props), app=mount(Tab,props)
  button(app.render(),'Rediger med coach').props.onClick()
  const weight=nodes(app.render(),n=>n.type==='input' && n.props.type==='number' && n.props.min===20)[0]
  weight.props.onChange({target:{value:'200'}})
  button(app.render(),'Brug i denne visning').props.onClick()
  assert.equal(nodes(app.render(),n=>n.props.role==='alert').length,1)
  button(app.render(),'Annuller').props.onClick()
  assert.equal(nodes(app.render(),n=>n.props.role==='alert').length,0)
  assert.equal(JSON.stringify(props),before)
  assert.equal(io.rpc,0)
})
test('review: folded attempt editor retains actual handlers and updates immutably', async () => {
  const props=make(), before=JSON.stringify(props.meetAttempts)
  let state=props.meetAttempts
  props.setMeetAttempts=fn=>{ state=typeof fn==='function' ? fn(state) : fn }
  const tree=mount(Tab,props).render()
  const rest=nodes(tree,n=>n.type==='details' && text(n).startsWith('Forsøg, coachnoter'))[0]
  assert.ok(rest && !rest.props.open)
  nodes(rest,n=>n.type==='input' && n.props.placeholder==='kg')[0].props.onChange({target:{value:'105'}})
  assert.equal(state.bench[0].w,'105')
  assert.equal(JSON.stringify(props.meetAttempts),before)
  const good=nodes(rest,n=>n.type==='button' && text(n)==='✓')[0]
  await good.props.onClick()
  assert.equal(state.bench[0].r,'good')
  assert.equal(io.rpc,0)
})
test('review: focus disappears after calendar-date change and no extra plan is mounted', () => {
  const props=make(), app=mount(Tab,props)
  assert.equal(nodes(app.render(),n=>n.type==='fieldset').length,1)
  const after=app.render({...props,athlete:{...props.athlete,competition_date:'2001-01-01'}})
  assert.equal(nodes(after,isFocus).length,0)
  assert.equal(nodes(after,n=>n.type==='fieldset').length,1)
  assert.equal(nodes(after,n=>n.type==='details').length,0)
})
test('review: parent flag defaults OFF and is forwarded only to meet-tab props', () => {
  const flat=new URL('./AthleteView.jsx',import.meta.url)
  const source=readFileSync(existsSync(flat) ? flat : new URL('../AthleteView.jsx',import.meta.url),'utf8')
  assert.match(source,/staevnedagFokus = false/)
  assert.match(source,/factory=\{staevnedagFactory\}[\s\S]*?componentProps=\{\{[\s\S]*?showFlash, staevnedagFokus,/)
  assert.equal((source.match(/staevnedagFokus/g)||[]).length,2)
})
