import test from 'node:test'
import assert from 'node:assert/strict'
import { install, moduleURL } from './mob5Loader.mjs'
install(process.argv.includes('--crlf') ? '\r\n' : '\n')
const { readCoachChoices, coachNotes, saveCoachChoices, coachCatalog, DEFAULT_COACH_MOBILITY } = await import('./coachMobility.mjs')
const { WARMUP_BASE } = await import('./mobilityCatalog.mjs')
const { CoachMobilityEditor, CoachMobilitySummary } = await import('./CoachMobility.jsx')
const { default: Fokus } = await import('./MobilitetFokus.jsx')
const { default: Tab } = await import('./MobiliseringTab.jsx')
const { default: Profile } = await import(moduleURL('ProfilHoved.jsx'))
const { renderMobilityShortcut } = await import('./mobilityFocus.mjs')
const { createElement: h, mount, nodes, text, button } = await import('./mob4Dom.mjs')
const athlete = { id: 'synthetic-a', coach_id: 'synthetic-coach', notes: 'Bevar denne note', name: 'Test Atlet', status: 'active' }
const choices = { Squat: { need: 'Plads til knæene', ids: ['sq-mob-3','sq-mob-2'] }, 'Bænkpres': { need: 'Skulderposition', ids: ['bp-mob-2'] } }
const savedNotes = coachNotes(athlete.id, athlete.notes, choices, WARMUP_BASE)
const props = { mobilitetCoach: true, athleteId: athlete.id, coachNotes: savedNotes, library: WARMUP_BASE, warmupTemplates: [], onExit() {} }
function select(tree, index, value) { nodes(tree, n => n.type === 'select')[index].props.onChange({ target: { value } }) }
function fakeClient(mode = 'ok') {
  const calls = []
  let notes
  const query = { update(value) { calls.push(['update',value]); notes = value.notes; return query },
    eq(...args) { calls.push(['eq',...args]); return query }, is(...args) { calls.push(['is',...args]); return query },
    select(value) { calls.push(['select',value]); return query }, async single() {
      calls.push(['single'])
      if (mode === 'throw') throw Error('synthetic transport failure')
      return mode === 'ok' ? { data: { ...athlete, notes }, error: null } : { data: null, error: { message: 'conflict' } }
    } }
  return { calls, from(table) { assert.equal(table,'athletes'); calls.push(['from',table]); return query } }
}
test('default OFF has no view, notes parsing, storage or transport work', async () => {
  globalThis.localStorage = { getItem() { assert.fail('storage read') }, setItem() { assert.fail('storage write') } }
  assert.equal(DEFAULT_COACH_MOBILITY,false)
  const poison = { toString() { assert.fail('OFF parse') } }
  assert.deepEqual(readCoachChoices(false,'a',poison,WARMUP_BASE),{ choices:{},error:null })
  assert.equal(CoachMobilitySummary({ notes: poison }),null)
  assert.equal(CoachMobilityEditor({ athlete }),null)
  const client = { from() { assert.fail('OFF write') } }
  assert.ok((await saveCoachChoices({ client })).error)
  assert.equal(renderMobilityShortcut(h, { enabled:false }),null)
  const baseline = mount(Fokus,{ ...props,mobilitetCoach:false }).render()
  assert.ok(!text(baseline).includes('Brug coachens fokus'))
})
test('existing note text round trips and isolation rejects foreign athlete data', () => {
  assert.deepEqual(readCoachChoices(true,athlete.id,savedNotes,WARMUP_BASE).choices,choices)
  assert.equal(coachNotes(athlete.id,savedNotes,{},WARMUP_BASE),athlete.notes)
  assert.deepEqual(readCoachChoices(true,'synthetic-b',savedNotes,WARMUP_BASE).choices,{})
  assert.ok(readCoachChoices(true,'synthetic-b',savedNotes,WARMUP_BASE).error)
  assert.deepEqual(readCoachChoices(true,athlete.id,null,WARMUP_BASE).choices,{})
})
test('reject unknown ID, wrong lift, duplicate, fourth exercise and invalid need', () => {
  const ids = coachCatalog('Squat',WARMUP_BASE).slice(0,4).map(ex => ex.id)
  for (const choice of [{ need:'Plads til knæene',ids:['bad'] },{ need:'Plads til knæene',ids:['bp-mob-2'] },
    { need:'Plads til knæene',ids:['sq-mob-2','sq-mob-2'] },{ need:'Plads til knæene',ids },{ need:'bad',ids:[] }]) {
    assert.throws(() => coachNotes(athlete.id,athlete.notes,{ Squat:choice },WARMUP_BASE))
  }
  assert.equal(coachNotes(athlete.id,'', { Squat: { need:'Mere dybde',ids:ids.slice(0,3) } },WARMUP_BASE).includes(ids[2]),true)
  assert.throws(() => coachNotes(athlete.id,savedNotes+'\n[HARA-MOBILITY-V1]\n',{},WARMUP_BASE))
})
test('actual save handler uses existing notes contract with coach, athlete and old-note predicates', async () => {
  const client = fakeClient()
  const result = await saveCoachChoices({ enabled:true, client, coachId:athlete.coach_id,athlete,choices,library:WARMUP_BASE })
  assert.equal(result.error,null)
  assert.deepEqual(Object.keys(client.calls.find(row => row[0] === 'update')[1]),['notes'])
  for (const row of [['eq','id',athlete.id],['eq','coach_id',athlete.coach_id],['eq','notes',athlete.notes]]) assert.ok(client.calls.some(item => JSON.stringify(item)===JSON.stringify(row)))
  for (const mode of ['conflict','throw']) assert.ok((await saveCoachChoices({ enabled:true,client:fakeClient(mode),coachId:athlete.coach_id,athlete,choices,library:WARMUP_BASE })).error)
  const forbidden = { from() { assert.fail('invalid write') } }
  assert.ok((await saveCoachChoices({ enabled:true,client:forbidden,coachId:'foreign',athlete,choices,library:WARMUP_BASE })).error)
  assert.ok((await saveCoachChoices({ enabled:true,client:forbidden,coachId:athlete.coach_id,athlete,choices:{ Squat:{need:'Mere dybde',ids:['bad']} },library:WARMUP_BASE })).error)
})
test('actual coach DOM select, max3, save and clear use the imported handler', async () => {
  const client = fakeClient(), saved = []
  const app = mount(CoachMobilityEditor,{enabled:true,athlete,coachId:athlete.coach_id,client,onSaved:row=>saved.push(row)})
  let tree=app.render(); select(tree,0,'Plads til knæene'); tree=app.render()
  const catalog=coachCatalog('Squat',WARMUP_BASE)
  for (const ex of catalog.slice(0,3)) { button(tree,ex.name).props.onClick(); tree=app.render() }
  assert.equal(button(tree,catalog[3].name).props.disabled,true)
  const save=button(tree,'Gem mobilitetsvalg').props.onClick
  await Promise.all([save(),save()])
  assert.equal(client.calls.filter(row=>row[0]==='from').length,1)
  assert.equal(saved.length,1)
  assert.equal(Object.keys(readCoachChoices(true,athlete.id,saved[0].notes,WARMUP_BASE).choices).length,1)
  tree=app.render({enabled:true,athlete:saved[0],coachId:athlete.coach_id,client,onSaved:row=>saved.push(row)})
  select(tree,0,''); tree=app.render(); await button(tree,'Gem mobilitetsvalg').props.onClick()
  assert.equal(saved[1].notes,athlete.notes)
})
test('coach selections precede self choices on actual focus DOM; pinned order and own choice work', () => {
  const app=mount(Fokus,props)
  let tree=app.render()
  assert.ok(text(tree).indexOf('Valgt af din coach') < text(tree).indexOf('1. Hvilket løft?'))
  assert.ok(text(tree).includes('Plads til knæene'))
  button(tree,'Start min rutine').props.onClick(); tree=app.render()
  assert.ok(text(tree).includes(coachCatalog('Squat',WARMUP_BASE).find(ex=>ex.id==='sq-mob-3').name))
  assert.ok(text(tree).includes('1 af 2'))
  button(tree,'Ret mit fokus').props.onClick(); tree=app.render()
  button(tree,'Mere dybde').props.onClick(); tree=app.render()
  button(tree,'Start min rutine').props.onClick(); tree=app.render()
  assert.ok(text(tree).includes('1 af 3'))
  button(tree,'Brug coachens fokus: Bænkpres').props.onClick(); tree=app.render()
  button(tree,'Start min rutine').props.onClick(); tree=app.render()
  assert.ok(text(tree).includes('1 af 1'))
})
test('no choice and invalid exercise never render forged coach routine', () => {
  for (const notes of [null,savedNotes.replace('sq-mob-3','unknown-id')]) {
    const tree=mount(Fokus,{...props,coachNotes:notes}).render()
    assert.equal(nodes(tree,n=>n.type==='button' && text(n).startsWith('Brug coachens fokus')).length,0)
    assert.ok(text(tree).includes('Mere dybde') && text(tree).includes('Start min rutine'))
  }
})
test('actual profile and mobility tab integrate editor and athlete-scoped summary; shortcut opens focus', () => {
  const profile=mount(Profile,{ a:athlete,profilesLastSeen:{},unreadCounts:{},mobilitetCoach:true,mobilityCoachId:athlete.coach_id }).render()
  assert.ok(text(profile).includes('Mobilitetsfokus til atleten'))
  const app=mount(Tab,{...props,mobilityMode:'fokus'})
  assert.ok(text(app.render()).includes('Valgt af din coach'))
  const other=app.render({...props,athleteId:'synthetic-b',coachNotes:null,mobilityMode:'fokus'})
  assert.ok(!text(other).includes('Brug coachens fokus'))
  const actions=[]
  const summary=h(CoachMobilitySummary,{enabled:true,athleteId:athlete.id,notes:savedNotes})
  const tree=mount(()=>renderMobilityShortcut(h,{enabled:true,tab:'hjem',enkelOn:false,coachSummary:summary,setMobilityMode:x=>actions.push(x),setTab:x=>actions.push(x)}),{}).render()
  assert.ok(text(tree).includes('Valgt af din coach'))
  button(tree,'Åbn mobilitet').props.onClick(); assert.deepEqual(actions,['fokus','mobilisering'])
})
