import test from 'node:test'
import assert from 'node:assert/strict'
import { install } from './hviledageFlagLoader.mjs'
import { expand,nodes,text } from './hviledageFlagDom.mjs'
install()
const {default: BeforeWeek} = await import('./hviledageBeforeWeekCalendar.txt')
const {default: BeforeProgram} = await import('./hviledageBeforeProgramTab.txt')
const week={id:'w',week_number:1,sessions:[{id:'rest',weekday:1,title:'Hvile session',exercises:[]}]}
const weekStart=new Date('2026-10-26T00:00:00')
const list=t=>nodes(t,n=>n.props['aria-label']==='Ugens hviledage')
test('pinned baseline Home calendar renders list with no flag',()=>{
 assert.equal(list(expand(BeforeWeek({week,weekStart,exerciseLogs:[]}))).length,1)
})
test('pinned baseline Program renders list and hides rest session with no flag',()=>{
 const tree=expand(BeforeProgram({allWeeks:[week],currentWeek:week,viewingWeekIdx:0,athlete:{},
 weekStartDate:()=>weekStart,fmtWeekRange:()=>'',exerciseLogs:[],pastLogs:[],readinessLog:{readiness_score:100},
 WEEKDAYS_LONG:[],progOpenSession:null}))
 assert.equal(list(tree).length,1);assert.ok(!text(tree).includes('Hvile session'))
})
