import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {helper,draw,handlers} from './rebaseHarness.mjs'
import {nodes,normalized} from './coachRyd2Harness.mjs'
import {rel1030Enabled,rel1030Feature} from './rel1030.mjs'

test('rebase: strict independent flags, combinations and hostile duplicates',()=>{
  const values=['','0','1','true','01','1&VALUE=0','1&VALUE=1']
  for(const ryd of values) for(const release of values) {
    const query=new URLSearchParams()
    if(ryd) for(const value of ryd.split('&VALUE=')) query.append('coachRyd',value)
    if(release) for(const value of release.split('&VALUE=')) query.append('rel1030',value)
    const search='?'+query
    assert.equal(helper.coachRydEnabled(search),ryd==='1'||release==='1',search)
    assert.equal(rel1030Enabled(search),release==='1',search)
    assert.equal(rel1030Feature('coachRyd',search),release==='1',search)
  }
  assert.equal(helper.DEFAULT_COACH_RYD,false)
})

test('rebase: actual Dashboard entry and calendar callbacks for both flags and widths',()=>{
  for(const width of [375,1280]) for(const search of ['','?coach=inbox','?coachRyd=1','?rel1030=1','?coachRyd=1&rel1030=1']) {
    const enabled=helper.coachRydEnabled(search)
    const {tree,entry,calls}=draw(search,width)
    assert.equal(entry,enabled||search==='?coach=inbox'?'inbox':'list')
    const sidebar=nodes(tree).find(n=>n.type==='Sidebar')
    assert.equal(sidebar.props.coachRyd,enabled)
    const boundary=nodes(tree).find(n=>n.type==='LazyBoundary'&&n.props.label==='Indbakke')
    if(entry==='list') {assert.equal(boundary,undefined);continue}
    const props=boundary.props.componentProps
    if(!enabled) {assert.equal(props.calendarTasks,null);continue}
    assert.equal(props.handleCoachBriefingSeen,handlers.handleCoachBriefingSeen)
    const task=props.calendarTasks
    assert.equal(task.type,'KalenderView');assert.equal(task.props.tasksOnly,true)
    const calendarTree=draw(search,width,'calendar').tree
    const calendar=nodes(calendarTree).find(n=>n.type==='KalenderView')
    // rel1030 intentionally replaces only the calendar route with Programoverblik.
    // Inbox calendar tasks retain their original callbacks in either mode.
    if(rel1030Feature('programOverblik',search)) {
      assert.equal(calendar,undefined)
      assert.ok(nodes(calendarTree).find(n=>n.props['aria-label']==='Programoverblik'))
      for(const name of ['openProfile','openPlanReview','snoozeAthlete']) assert.equal(task.props[name],handlers[name])
    } else {
      for(const name of ['openProfile','openPlanReview','snoozeAthlete']) {
        assert.equal(task.props[name],calendar.props[name]);assert.equal(task.props[name],handlers[name])
      }
    }
    task.props.openProfile({id:'synthetic-a'},'program')
    assert.deepEqual(calls,[['openProfile',{id:'synthetic-a'},'program']])
  }
})

test('rebase: malformed flags retain the exact default Dashboard tree',()=>{
  for(const width of [375,1280]) {
    const expected=normalized(draw('',width).tree)
    for(const search of ['?coachRyd=0','?rel1030=true','?coachRyd=1&coachRyd=0','?rel1030=1&rel1030=1']) assert.deepEqual(normalized(draw(search,width).tree),expected)
  }
})

test('rebase: unknown imports remain closed in both synthetic loaders',async()=>{
  for(const path of ['ORDER.md','../supabase.js','./dashboard/unknown.jsx','https://invalid.test/code.js']) await assert.rejects(import('rebasedash://final/'+path),/Unapproved dashboard/)
  await assert.rejects(import('coachryd-test://1/not-approved.mjs'),/Unapproved dependency/)
})

test('rebase: helper retains every pinned base byte except the ordered entry function',()=>{
  const final=readFileSync(new URL('./coachRyd.mjs',import.meta.url),'utf8')
  const base=readFileSync(new URL('./rebaseBaseCoachRyd.txt',import.meta.url),'utf8')
  const eol=final.includes('\r\n')?'\r\n':'\n'
  const addition="export function coachRydEntryView(enabled, originalView) {\n  return enabled === true ? 'inbox' : originalView\n}\n".replace(/\n/g,eol)
  const lf=v=>v.replace(/\r\n/g,'\n')
  assert.equal(lf(final).replace(lf(addition),''),lf(base))
})
