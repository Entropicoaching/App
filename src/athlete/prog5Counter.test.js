import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { install } from './prog5Loader.mjs'
import { mount, nodes, text, io } from './prog5Dom.mjs'
install()
const { default: Program } = await import('./ProgramTab.jsx')
const { intensityExplanation } = await import('./intensityExplanation.mjs')
const helpers = await import('./ugeHjaelp.js')
function fixture() {
  const exercises=[{id:'a', name:'Squat',sets:1,reps:'5',intensity:'RPE 8'}, {id:'b',name:'Bænkpres',sets:1,reps:'3',intensity:'RIR 0'}]
  const week={id:'w',week_number:1,start_date:'2026-10-26',sessions:[{id:'s',title:'Pas',weekday:0,exercises}]}
  const calls=[]
  const p={...helpers,programIntensityHelp:true,allWeeks:[week],currentWeek:week,viewingWeekIdx:0,
    athlete:{id:'synthetic'}, exerciseLogs:[],pastLogs:[],readinessLog:{readiness_score:90},progOpenSession:'s',
    sessionRefs:{current:{}},dismissedFeedback:new Set(),feedbackInputs:{},logInputs:{},setConfirm:{},
    lastLogByExerciseName:{},exerciseHistory:{},exWarmupExpanded:{},exWarmupWeightOverride:{},warmupChecked:{},
    suggestNextWeight:()=>null,calcWarmupSets:()=>[],suggestWarmupOverride:()=>null,
    logSet:(...args)=>calls.push(['log',...args]),skipSet:(...args)=>calls.push(['skip',...args]),
    setOpenRpePicker:value=>{p.openRpePicker=value},setLogInputs:update=>{p.logInputs=update(p.logInputs)}}
  return {p,calls}
}
const badges=tree=>nodes(tree,n=>n.type==='button' && n.props['aria-label']?.startsWith('Forklaring af'))
test('counter: two explanations have independent state and perform no backend access',()=>{
  const {p,calls}=fixture(),view=mount(Program,p)
  badges(view.render())[0].props.onClick();let tree=view.render()
  assert.match(text(tree),/RPE 8: du kunne have taget to gentagelser mere/)
  assert.doesNotMatch(text(tree),/RIR 0: du kunne/)
  badges(tree)[1].props.onClick();tree=view.render()
  assert.match(text(tree),/RIR 0: du kunne have taget ingen gentagelser mere/)
  assert.deepEqual(calls,[]);assert.equal(io.rpc,0)
})
test('counter: actual logging, skipping and RPE picker retain original arguments',()=>{
  const {p,calls}=fixture(),view=mount(Program,p)
  badges(view.render())[0].props.onClick();let tree=view.render()
  const log=nodes(tree,n=>n.type==='button' && text(n)==='Log')[0]
  assert.ok(log,'existing log handler exists');log.props.onClick()
  const skip=nodes(tree,n=>n.type==='button' && text(n)==='Spring over')[0]
  assert.ok(skip);skip.props.onClick()
  assert.deepEqual(calls,[['log','a',1,1,'5',8],['skip','a',1,8]])
  const picker=nodes(tree,n=>n.type==='button' && text(n)==='RPE 8' && !n.props['aria-label'])[0]
  picker.props.onClick();tree=view.render()
  nodes(tree,n=>n.type==='button'&&text(n)==='9')[0].props.onClick()
  assert.equal(p.logInputs.a_1.rpe,'9');assert.equal(p.openRpePicker,null)
})
test('counter: historical and future prescriptions also expose the correct local badge',()=>{
  for(const idx of [0,2]) {
    const {p}=fixture(),week=p.currentWeek
    p.allWeeks=[{...week,id:'past',week_number:1}, {...week,id:'now',week_number:2},{...week,id:'future',week_number:3}]
    p.currentWeek=p.allWeeks[1];p.viewingWeekIdx=idx
    const view=mount(Program,p);assert.equal(badges(view.render()).length,2)
    badges(view.render())[1].props.onClick();assert.match(text(view.render()),/tekst fra Marc/)
  }
})
test('counter: unsupported mixed ranges and misleading numbers never get a guessed explanation',()=>{
  for(const x of ['RPE 60','RPE -8','RIR -1','RPE 08','RPE 8/9','RPE 8 RIR 2','RPE 8%','RIR 4.5',{},8])assert.equal(intensityExplanation(x),null)
})
test('counter: flag wiring exists on both App athlete branches and AthleteView prop handoff',()=>{
  const app=readFileSync(new URL('../App.jsx',import.meta.url),'utf8')
  const athlete=readFileSync(new URL('../AthleteView.jsx',import.meta.url),'utf8')
  assert.match(app,/programIntensityHelp = false/)
  assert.equal(app.split('programIntensityHelp: programIntensityHelp === true').length-1,2)
  assert.match(athlete,/programIntensityHelp = false/)
  assert.match(athlete,/weekStartDate, programIntensityHelp, programUgeFoerst/)
})
