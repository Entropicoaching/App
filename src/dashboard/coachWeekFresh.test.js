import './coachWeekTestLoader.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { element } from './syntheticDom.mjs'
const { weekRows, renderWeekOverview, selectOverviewWeek } = await import('./coachWeekOverview.mjs')
const a = {id:'a',name:'Samme'}
const e = {athlete:a,current:{id:'new',week_number:1,planned_sets:8}}

test('fresh counterexample: incomplete prescription overrides legacy reassuring zero', () => {
  const row = weekRows([{...e,current:{...e.current,planned_sets:0,coachWeekPlannedSets:null}}],{})[0]
  assert.equal(row.deviation,null)
  assert.equal(row.planned,null)
})

test('fresh counterexample: equal name and equal magnitude retain deterministic athlete identity', () => {
  const b={...e,athlete:{id:'b',name:'Samme'}}
  const completion={a:{'id:new':{coachWeekSets:2}},b:{'id:new':{coachWeekSets:14}}}
  for (const entries of [[b,e],[e,b]]) {
    const opened=[]
    const dom=renderWeekOverview(element,{enabled:true,profileTab:'log',entries,completion,status:{plan:'ready',logs:'ready'},openProfile:(...args)=>opened.push(args)})
    dom.queryAll('button')[0].click()
    assert.equal(opened[0][0],a); assert.equal(opened[0][1],'log')
  }
})

test('fresh counterexample: reused number never borrows other athlete or old program totals', () => {
  const row=weekRows([e],{a:{1:{coachWeekSets:100},'id:old':{coachWeekSets:8}},b:{'id:new':{coachWeekSets:8}}})[0]
  assert.equal(row.logged,0); assert.equal(row.deviation,8)
})

test('fresh counterexample: invalid and overlapping dated plans never look completed', () => {
  for (const weeks of [[{...e.current,start_date:'invalid'}],[{...e.current,start_date:'2026-10-26'},{...e.current,id:'overlap',start_date:'2026-10-27'}]]) {
    assert.equal(selectOverviewWeek(weeks,e.current,'2026-10-27'),undefined)
  }
})
