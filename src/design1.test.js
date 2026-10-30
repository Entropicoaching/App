import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import './design1Loader.mjs'
import { reset, render, nodes, text } from './design1Dom.mjs'
const { default: Overview } = await import('./dashboard/ProgramOverblikView.mjs')
const { InboxPanel } = await import('./dashboard/Indbakke2View.mjs')
const { default: Ladder, timerSeconds } = await import('./athlete/WarmupLadderView.mjs')
const { s: coach } = await import('./dashboardShared.js')
const { s: athlete } = await import('./athleteShared.js')

const find = (tree, type) => nodes(tree).filter(n => n.type === type)
const button = (tree, label) => find(tree, 'button').find(n => text(n).replace(/\s+/g, ' ').trim() === label)
const exercises = [{ id: 'synthetic', name: 'Squat top', recommended_weight: 100, sets: 1, reps: '3' }]
const clean = tree => {
  if (!tree || typeof tree !== 'object') return tree
  return { type: tree.type, props: Object.fromEntries(Object.entries(tree.props).filter(([k,v]) => k !== 'style' && v !== undefined).map(([k,v]) => [k, typeof v === 'function' ? '[handler]' : v])), children: tree.children.map(clean) }
}
const fixture = () => {
  const events = []
  const controller = Object.fromEntries(['refresh','select','seen','templates','applyTemplate','draft','send'].map(k => [k, (...args) => events.push([k,...args])]))
  controller.rows = () => [{ athlete: { id: 'a', name: 'Testatlet' }, unread: 1, thread: [{ key: 'm', kind: 'message', at: '2026-10-30', value: { sender_role: 'athlete', content: 'Hej' } }] }]
  return { events, controller, state: { selected: 'a', loaded: true, drafts: { a: 'Svar' }, templates: [{ name: 'Skabelon' }] } }
}

test('overview uses existing page/title/card styles and preserves navigation and hidden athletes', () => {
  const events = [], a = {id:'a',name:'Testatlet'}
  const tree = Overview({ athletes:[a,{id:'hidden',name:'Skjult'}], hiddenAthleteIds:new Set(['hidden']), openProfile:(...v)=>events.push(v), today:'2026-10-30' })
  assert.equal(tree.props.style.textAlign,'left')
  assert.equal(tree.props.style.fontFamily,coach.wrap.fontFamily)
  assert.equal(tree.props.style.padding,coach.page.padding)
  assert.equal(find(tree,'h1')[0].props.style.color, '#edeae2')
  assert.equal(find(tree,'h1')[0].props.style.fontFamily,coach.topbarTitle.fontFamily)
  assert.equal(find(tree,'button')[0].props.style.background,coach.card.background)
  assert.equal(find(tree,'button')[0].props.style.minHeight,44)
  assert.doesNotMatch(text(tree),/Skjult/)
  find(tree,'button')[0].props.onClick(); assert.deepEqual(events,[[a,'program']])
  assert.match(text(Overview({loading:true})),/Henter atleter/)
  assert.match(text(Overview({loadError:true})),/kunne ikke hentes/)
})

test('inbox has light headers, styled controls and cards; all imported handlers still dispatch', () => {
  const f=fixture(), tree=InboxPanel(f)
  assert.equal(tree.props.style.textAlign,'left')
  assert.equal(tree.props.style.fontFamily,coach.wrap.fontFamily)
  for (const h of [...find(tree,'h1'),...find(tree,'h2')]) assert.equal(h.props.style.color,'#edeae2')
  for (const b of find(tree,'button')) { assert.equal(b.props.style.minHeight,44); assert.ok(b.props.style.background); assert.equal(b.props.style.textAlign,'left') }
  assert.equal(find(tree,'li')[0].props.style.background,coach.card.background)
  assert.equal(find(tree,'textarea')[0].props.style.background,coach.fieldInput.background)
  for(const label of ['Opdatér','Testatlet · 1 ulæste','Markér som set','Eksisterende hurtige svar','Skabelon','Send']) button(tree,label).props.onClick()
  find(tree,'textarea')[0].props.onChange({target:{value:'Ny'}})
  assert.deepEqual(f.events,[['refresh'],['select','a'],['seen'],['templates'],['applyTemplate',0],['send'],['draft','Ny']])
  const disabled=InboxPanel({...f,state:{...f.state,busy:true}})
  assert.ok(find(disabled,'button').every(b=>b.props.disabled))
  const unselected=InboxPanel({...f,state:{...f.state,selected:null}})
  const tab=find(unselected,'button')[1]
  assert.equal(tab.props.style.background,coach.btnGhost.background)
  assert.equal(tab.props.style.color,'#edeae2')
})

test('warmup keeps strict default OFF; cards, buttons, check labels and timer handlers work', () => {
  for(const enabled of [undefined,false,'true',1,null]) assert.equal(Ladder({enabled,exercises}),null)
  reset()
  const props={enabled:true,exercises,scope:'synthetic'}
  let tree=render(Ladder,props)
  assert.equal(tree.props.style.background,athlete.card.background)
  assert.equal(tree.props.style.fontFamily,athlete.wrap.fontFamily)
  assert.equal(tree.props.style.textAlign,'left')
  for(const b of find(tree,'button')) { assert.equal(b.props.style.background,athlete.btnPrimary.background); assert.equal(b.props.style.maxWidth,'100%'); assert.equal(b.props.style.minHeight,44) }
  const check=find(tree,'input')[0]
  assert.equal(check.props.style.accentColor,'#c8923a'); assert.equal(check.props.style.width,20)
  assert.equal(find(tree,'label')[0].props.style.minHeight,44)
  check.props.onChange({target:{checked:true}})
  tree=render(Ladder,props); assert.equal(find(tree,'input')[0].props.checked,true)
  button(tree,'Start 2 minutters mobilitet').props.onClick()
  tree=render(Ladder,props); assert.match(text(tree),/120 sekunder/)
  button(tree,'Start 60 sekunders pause').props.onClick()
  tree=render(Ladder,props); assert.match(text(tree),/60 sekunder/)
  button(tree,'Stop timer').props.onClick()
  tree=render(Ladder,props); assert.equal(text(nodes(tree).find(n=>n.props.role==='timer')),'0 sekunder')
  assert.equal(timerSeconds(2000,1001),1); assert.equal(timerSeconds(2000,3000),0)
})

test('baseline/final rendered text, structure, non-style props and disabled states match', () => {
  const expected = JSON.parse(readFileSync(new URL('./design1Baseline.json', import.meta.url), 'utf8'))
  const actual = []
  const overview={athletes:[{id:'a',name:'Testatlet'}],today:'2026-10-30'}
  actual.push(clean(Overview(overview)))
  for(const state of [{},{loading:true},{busy:true},{error:'Fejl',status:'Status'},{selected:null}]) {
    const f=fixture(); f.state={...f.state,...state}
    actual.push(clean(InboxPanel(f)))
  }
  for(const enabled of [true,false,undefined]) {
    reset(); actual.push(clean(render(Ladder,{enabled,exercises})))
  }
  assert.deepEqual(actual,expected)
})


test('closed test registry explicitly admits only the two coach style imports', async () => {
  const { createRegistry } = await import('./testModuleRegistry.mjs')
  const data = JSON.parse(readFileSync(new URL('./testModuleRegistry.json',import.meta.url),'utf8'))
  const root = new URL('../',import.meta.url)
  const registry = createRegistry(data,root)
  for(const [loader,view,shared] of [
    ['src/indbakke2Loader.mjs','src/dashboard/Indbakke2View.mjs','dashboardShared.js'],
    ['src/indbakke2Loader.mjs','src/dashboard/ProgramOverblikView.mjs','dashboardShared.js'],
  ]) {
    const result=registry.lookup(loader,'../'+shared,new URL(view,root).href)
    assert.equal(result?.url,new URL('src/'+shared,root).href)
    assert.equal(registry.lookup(loader,'../unlistedStyles.js',new URL(view,root).href),null)
  }
  assert.equal(registry.lookup('src/athlete/opvarmStigeLoader.mjs','../athleteShared.js',new URL('src/athlete/WarmupLadderView.mjs',root).href),null)
  for(const name of ['Indbakke2View.mjs','ProgramOverblikView.mjs']) {
    const entry=data.modules.find(m=>m.module===name)
    const shared='dashboardShared.js'
    assert.equal(entry.imports['../'+shared],'src/'+shared)
  }
})
