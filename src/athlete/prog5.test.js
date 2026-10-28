import test from 'node:test'
import assert from 'node:assert/strict'
import { install } from './prog5Loader.mjs'
import { mount, nodes, text } from './prog5Dom.mjs'
install()
const { default: Program } = await import('./ProgramTab.jsx')
const { default: Baseline } = await import('./prog5Baseline.jsx')
const { intensityExplanation } = await import('./intensityExplanation.mjs')
const helpers = await import('./ugeHjaelp.js')

function props(intensity, flag = true) {
  const ex = { id: 'synthetic-ex', name: 'Squat', sets: 1, reps: '5', intensity }
  const week = { id: 'w', week_number: 1, start_date: '2026-10-26', sessions: [{id:'s', title:'Pas A', weekday:0, exercises:[ex]}] }
  return { ...helpers, programIntensityHelp: flag, allWeeks:[week], currentWeek:week, viewingWeekIdx:0,
    athlete:{id:'synthetic'}, exerciseLogs:[], pastLogs:[], readinessLog:{readiness_score:90}, progOpenSession:'s',
    sessionRefs:{current:{}}, dismissedFeedback:new Set(), feedbackInputs:{}, logInputs:{}, setConfirm:{},
    lastLogByExerciseName:{}, exerciseHistory:{}, exWarmupExpanded:{}, exWarmupWeightOverride:{}, warmupChecked:{},
    suggestNextWeight:()=>null, calcWarmupSets:()=>[], suggestWarmupOverride:()=>null }
}
const help = tree => nodes(tree,n=>n.type==='button' && n.props['aria-label']?.startsWith('Forklaring af'))
function shape(value) {
  if(typeof value === 'function') return '[handler]'
  if(Array.isArray(value)) return value.map(shape)
  if(value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,shape(v)]))
  return value
}
for(const [kind, values] of [['RPE',[6,7,8,9,10]],['RIR',[0,1,2,3,4]]]) {
  for(const value of values) test(`${kind} ${value}: real program badge opens and closes local placeholder`,()=>{
    const p=props(`${kind} ${value}`), before=structuredClone(p.allWeeks)
    const view=mount(Program,p);let tree=view.render()
    assert.equal(help(tree).length,1);assert.equal(help(tree)[0].props['aria-expanded'],false)
    assert.doesNotMatch(text(tree),/tekst fra Marc/)
    help(tree)[0].props.onClick();tree=view.render()
    assert.equal(help(tree)[0].props['aria-expanded'],true)
    assert.ok(text(tree).includes(intensityExplanation(`${kind} ${value}`)))
    help(tree)[0].props.onClick();tree=view.render()
    assert.doesNotMatch(text(tree),/tekst fra Marc/)
    assert.deepEqual(p.allWeeks,before)
  })
}
test('disabled flags retain exact pinned program tree with a set and RPE picker',()=>{
  for(const flag of [undefined,false,1,'true']) {
    const p=props('RPE 8',flag);if(flag===undefined)delete p.programIntensityHelp
    assert.deepEqual(shape(mount(Program,p).render()),shape(mount(Baseline,p).render()))
  }
})
test('no badge or unsupported prescription stays plain text',()=>{
  for(const value of [undefined,null,'','75%','RPE 5','RPE 11','RIR 5','RPE 8-9','RPE 8.5','RPE 8,5','RPE 8 plus','8']) {
    const tree=mount(Program,props(value)).render()
    assert.equal(help(tree).length,0);assert.doesNotMatch(text(tree),/tekst fra Marc/)
  }
})
test('placeholder mapping is explicit and Danish',()=>{
  for(const [value,word] of [[6,'fire'],[7,'tre'],[8,'to'],[9,'én'],[10,'ingen']]) {
    assert.match(intensityExplanation(`RPE ${value}`),new RegExp(word+' gentagelse'))
    assert.match(intensityExplanation(`RIR ${10-value}`),new RegExp(word+' gentagelse'))
  }
})
