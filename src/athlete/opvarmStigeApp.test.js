import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { install } from './opvarmStigeLoader.mjs'
import { mount, nodes, text, button } from './opvarmStigeDom.mjs'
const hooks = install()
const { default: Stige, timerSeconds } = await import('./WarmupLadderView.mjs')
const { default: Program } = await import('./ProgramTab.jsx')
const { default: Baseline } = await import('./opvarmStigeBaseline.txt')
const exercise = (name = 'Squat top', weight = 100) => ({ id: 'ex', name, recommended_weight: weight, sets: 1, reps: '3' })
const checks = tree => nodes(tree, node => node.type === 'input' && node.props.type === 'checkbox')
const timer = tree => nodes(tree, node => node.props.role === 'timer')[0]
const shape = value => typeof value === 'function' ? '[handler]' : Array.isArray(value) ? value.map(shape) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, shape(item)])) : value

test('actual component OFF and incomplete data render no ladder', () => {
  for (const enabled of [undefined, false, null, 1, 'true']) assert.equal(mount(Stige, { enabled, exercises: [exercise()] }).render(), null)
  for (const exercises of [[], [{name:'Squat'}], [exercise('Squat', 15)], [exercise('Leg press')]]) assert.equal(mount(Stige, { enabled: true, exercises }).render(), null)
})
test('actual checkbox, timer start/stop/completion, deadline drift and keyed resets without IO', t => {
  t.mock.timers.enable({ apis: ['Date', 'setInterval'], now: 1000 })
  const saved = {}
  for (const name of ['fetch', 'localStorage', 'sessionStorage']) {
    saved[name] = Object.getOwnPropertyDescriptor(globalThis, name)
    Object.defineProperty(globalThis, name, { configurable: true, get() { throw Error('Forbidden IO: ' + name) } })
  }
  const p = { enabled: true, scope: 'athlete|week|session', exercises: [exercise()] }
  const app = mount(Stige, p)
  try {
    let tree = app.render()
    assert.match(text(tree), /Ankel-vægstræk/)
    assert.match(text(tree), /90\/90 hofterotation/)
    assert.equal(nodes(tree,n=>n.type==='strong' && text(n).endsWith('60 sekunder')).length, 2)
    assert.ok(text(tree).indexOf('2 minutters mobilitet') < text(tree).indexOf('20 kg ×'))
    assert.match(text(tree), /Pr. side: 1 × 25 kg \+ 1 × 10 kg/)
    checks(tree)[0].props.onChange({target:{checked:true}})
    tree = app.render(); assert.equal(checks(tree)[0].props.checked, true)
    button(tree, 'Start 60 sekunders pause').props.onClick()
    tree = app.render(); assert.equal(text(timer(tree)), '60 sekunder')
    t.mock.timers.tick(17500); tree = app.render(); assert.equal(text(timer(tree)), '43 sekunder')
    button(tree, 'Stop timer').props.onClick()
    tree = app.render(); assert.equal(text(timer(tree)), '0 sekunder')
    button(tree, 'Start 2 minutters mobilitet').props.onClick()
    tree = app.render(); assert.equal(text(timer(tree)), '120 sekunder')
    t.mock.timers.tick(120000); tree = app.render(); assert.equal(text(timer(tree)), '0 sekunder')
    checks(tree)[0].props.onChange({target:{checked:false}})
    tree = app.render(); assert.equal(checks(tree)[0].props.checked, false)
    checks(tree)[0].props.onChange({target:{checked:true}})
    button(tree, 'Start 60 sekunders pause').props.onClick(); app.render()
    tree = app.render({...p,scope:'other-session'})
    assert.equal(checks(tree)[0].props.checked, false)
    assert.equal(text(timer(tree)), '0 sekunder')
    tree = app.render({...p,exercises:[exercise('Bænkpres top',80)]})
    assert.match(text(tree), /Bryststræk mod væg/)
    assert.doesNotMatch(text(tree), /Ankel-vægstræk/)
    assert.equal(app.render({...p,enabled:false}), null)
    tree = app.render(p); assert.equal(checks(tree)[0].props.checked,false)
    assert.equal(timerSeconds(10000, 7999), 3)
    assert.equal(timerSeconds(10000, 12000), 0)
    assert.equal(timerSeconds(null, 12000), 0)
  } finally {
    app.unmount()
    for (const name of Object.keys(saved)) {
      if (saved[name]) Object.defineProperty(globalThis, name, saved[name]); else delete globalThis[name]
    }
  }
})
test('all four lifts use exact descriptions from the pinned existing catalog', async () => {
  const { WARMUP_BASE } = await import('./mobilityCatalog.mjs')
  const expected = {
    'Squat top': ['sq-mob-2','sq-mob-3'], 'Bænkpres top': ['bp-mob-1','bp-mob-2'],
    'Dødløft top': ['dk-mob-1','dk-mob-3'], 'Sumo dødløft top': ['ds-mob-1','ds-mob-2'],
  }
  const catalog = Object.values(WARMUP_BASE).flatMap(slots => slots.flatMap(slot => slot.options))
  for (const [name, ids] of Object.entries(expected)) {
    const app = mount(Stige, {enabled:true,exercises:[exercise(name)]}), tree = app.render()
    for (const id of ids) { const ex = catalog.find(item => item.id === id); assert.ok(text(tree).includes(ex.name)); assert.ok(text(tree).includes(ex.desc)) }
    app.unmount()
  }
})
function programProps(flag) {
  const week = {id:'week',week_number:1,sessions:[{id:'session',title:'Dagens pas',exercises:[exercise()]}]}
  return {
    opvarmStige:flag,allWeeks:[week],currentWeek:week,viewingWeekIdx:0,computeActiveWeekIdx:()=>0,
    athlete:{id:'synthetic'},exerciseLogs:[],pastLogs:[],progOpenSession:'session',
    readinessLog:{readiness_score:90},sessionRefs:{current:{}},dismissedFeedback:new Set(),
    feedbackInputs:{},logInputs:{},setConfirm:{},exWarmupExpanded:new Set(),warmupChecked:{},exWarmupWeightOverride:{},
    exerciseHistory:{},lastLogByExerciseName:{},fmtWeekRange:()=>'',weekStartDate:()=> '2026-10-26',
    suggestWarmupOverride:()=>null,calcWarmupSets:()=>[{weight:20,reps:5}],parsePlannedRpe:()=>null,
  }
}
test('actual ProgramTab keeps exact OFF tree and legacy warmup; ON mounts one ladder', () => {
  for (const flag of [undefined,false,null,1,'true']) {
    const p = programProps(flag), app = mount(Program,p), base = mount(Baseline,p)
    assert.deepEqual(shape(app.render()),shape(base.render()))
    app.unmount(); base.unmount()
  }
  const app = mount(Program,programProps(true)), tree = app.render()
  assert.equal(nodes(tree,n=>n.props['aria-label']==='Opvarmningsstige').length,1)
  assert.match(text(tree),/Opvarmning/)
  app.unmount()
})
test('actual ProgramTab excludes other weeks and closed sessions', () => {
  const p = programProps(true)
  p.allWeeks.push({...p.currentWeek,id:'future',week_number:2})
  for (const next of [{...p,viewingWeekIdx:1},{...p,progOpenSession:null}]) {
    const app=mount(Program,next),tree=app.render()
    assert.equal(nodes(tree,n=>n.props['aria-label']==='Opvarmningsstige').length,0)
    app.unmount()
  }
})
test('root passes strict flag through both athlete paths and ProgramTab', () => {
  const app = readFileSync(new URL('../App.jsx',import.meta.url),'utf8')
  const athlete = readFileSync(new URL('../AthleteView.jsx',import.meta.url),'utf8')
  assert.match(app,/opvarmStige = false/)
  assert.match(app,/opvarmStige = opvarmStigeEnabled\(opvarmStige,/)
  assert.equal((app.match(/componentProps=\{\{ \.\.\.rel3\.athlete, hviledageListe,[^\n]*opvarmStige, programIntensityHelp:/g)||[]).length,2)
  assert.match(athlete,/opvarmStige = false/)
  assert.match(athlete,/fetchProgramBlockLogs, vaerdF6, opvarmStige,/)
})
test('R1 counterprobe: two mounted ladders never share checks or timer state', t => {
  t.mock.timers.enable({ apis: ['Date', 'setInterval'], now: 1000 })
  const exercises = Object.freeze([Object.freeze(exercise())])
  const left = mount(Stige, { enabled: true, scope: 'left', exercises })
  const right = mount(Stige, { enabled: true, scope: 'right', exercises })
  try {
    const first = left.render()
    right.render()
    checks(first)[0].props.onChange({ target: { checked: true } })
    button(first, 'Start 60 sekunders pause').props.onClick()
    left.render()
    assert.equal(checks(left.render())[0].props.checked, true)
    assert.equal(checks(right.render())[0].props.checked, false)
    assert.equal(text(timer(right.render())), '0 sekunder')
    button(right.render(), 'Start 2 minutters mobilitet').props.onClick()
    right.render()
    t.mock.timers.tick(10000)
    assert.equal(text(timer(left.render())), '50 sekunder')
    assert.equal(text(timer(right.render())), '110 sekunder')
    button(left.render(), 'Stop timer').props.onClick()
    left.render()
    t.mock.timers.tick(10000)
    assert.equal(text(timer(left.render())), '0 sekunder')
    assert.equal(text(timer(right.render())), '100 sekunder')
  } finally { left.unmount(); right.unmount() }
})
test('R1 counterprobe: changed or missing prescription clears same-session state', t => {
  t.mock.timers.enable({ apis: ['Date', 'setInterval'], now: 1000 })
  const props = { enabled: true, scope: 'same-session', exercises: [exercise()] }
  const app = mount(Stige, props)
  try {
    let tree = app.render()
    checks(tree)[0].props.onChange({ target: { checked: true } })
    button(tree, 'Start 60 sekunders pause').props.onClick()
    app.render()
    tree = app.render({ ...props, exercises: [exercise('Squat top', 140)] })
    assert.equal(checks(tree)[0].props.checked, false)
    assert.equal(text(timer(tree)), '0 sekunder')
    button(tree, 'Start 2 minutters mobilitet').props.onClick()
    app.render()
    assert.equal(app.render({ ...props, exercises: [exercise('Squat top', null)] }), null)
    t.mock.timers.tick(130000)
    tree = app.render(props)
    assert.equal(checks(tree)[0].props.checked, false)
    assert.equal(text(timer(tree)), '0 sekunder')
  } finally { app.unmount() }
})
test.after(()=>hooks.deregister())
