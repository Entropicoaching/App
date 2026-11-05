import test from 'node:test'
import assert from 'node:assert/strict'
import { installCoachTabsFixture, expand, text, nodes, baseProps, ready, service } from './coachTabsFixture.mjs'
import { coachTabsCases } from './coachTabs.cases.mjs'
installCoachTabsFixture()
await coachTabsCases(test, (Component, props) => text(expand(Component(props))))

const {default:Program} = await import('./ProgramTab.jsx')
const {default:Log} = await import('./LogTab.jsx')
const button = (tree, label) => nodes(tree).find(node => node.type === 'button' && text(node.children).includes(label))
test('actual preview handler catches transport errors and never exposes raw details', async () => {
 let draft
 service.invoke=async()=>{throw Error('raw backend detail')}
 const tree=expand(Program(baseProps({weeks:ready([{id:'synthetic-week',week_number:1,sessions:[]}]),setWeekDraft:value=>{draft=value}})))
 await button(tree,'Generér næste uge').props.onClick()
 assert.deepEqual(draft,{error:'Udkastet kunne ikke dannes. Prøv igen.'})
})
test('actual commit failure preserves the whole editable, approved draft', async () => {
 const original={data:{draft:{p_payload:{week:2,sessions:[]}},source_week:{week_number:1},progression:{can_commit:true},changes:[],warnings:[]}}
 let draft=original;const busy=[]
 service.invoke=async()=>({data:null,error:{message:'raw backend detail'}})
 const tree=expand(Program(baseProps({weeks:ready([{id:'synthetic-week',week_number:1,sessions:[]}]),weekDraft:original,
 setWeekDraft:update=>{draft=typeof update==='function'?update(draft):update},setSendingDraft:v=>busy.push(v)})))
 await button(tree,'Send til atleten').props.onClick()
 assert.equal(draft.data,original.data);assert.equal(draft.saveError,'Ugen blev ikke gemt. Prøv igen.');assert.deepEqual(busy,[true,false])
})
test('actual log filter reset retains history and returns to all exercises', () => {
 let filter='Bænkpres'
 const logs=ready([{exercise_id:'synthetic-ex',set_number:1,weight:100,reps_completed:1,logged_at:'2026-11-03T12:00:00Z',exercises:{name:'Squat',session_id:'synthetic-session',sessions:{title:'Pas',weeks:{week_number:1}}}}])
 const tree=expand(Log(baseProps({athleteLogs:logs,logExerciseFilter:filter,setLogExerciseFilter:v=>{filter=v}})))
 button(tree,'Vis alle øvelser').props.onClick();assert.equal(filter,null)
})
