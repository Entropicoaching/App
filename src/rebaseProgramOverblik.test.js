import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {draw,handlers} from './rebaseHarness.mjs'
import {nodes,normalized} from './coachRyd2Harness.mjs'
const baseline=JSON.parse(readFileSync(new URL('./rebaseProgramOverblikBase.json',import.meta.url),'utf8'))
const plain=tree=>JSON.parse(JSON.stringify(normalized(tree)))

test('repair: OFF trees equal all twelve pinned Dashboard baseline trees',t=>{
  // The twelve immutable trees were captured on this Copenhagen calendar day.
  t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-29T12:00:00Z')})
  assert.equal(baseline.schema,'program-overblik-off-baseline/v1')
  assert.equal(baseline.cases.length,12)
  for(const entry of baseline.cases) {
    for(const suffix of ['', '&programOverblik=0', '&programOverblik=true', '&programOverblik=1&programOverblik=0']) {
      const query=entry.search+(entry.search?suffix:suffix.replace(/^&/,'?'))
      const {tree}=draw(query,entry.width,entry.view??undefined)
      assert.deepEqual(plain(tree),entry.tree,JSON.stringify({...entry,tree:undefined,query}))
      assert.equal(Object.hasOwn(nodes(tree).find(n=>n.type==='Sidebar').props,'programOverblik'),false)
    }
  }
})

test('repair: OFF calendar source and callback identities remain pinned',()=>{
  const addedOnStatus = "              ...(e2 ? { entropi2: true, loading, loadError, calendarStatus: coachActionsStatus.calendar, calendarReady: !!e2ReadContext,\n"
    + "                onRetry: async () => { if (loadError) { setLoading(true); await fetchAthletes() } await refreshCoachInbox() } } : {}),\n"
  const current=readFileSync(new URL('./Dashboard.jsx',import.meta.url),'utf8').replaceAll('\r\n','\n')
  assert.equal(current.split(addedOnStatus).length,2,'exact ON-only status addition; OFF source remains pinned below')
  const source=current.replace(addedOnStatus,'')
  const start=source.indexOf('<KalenderView {...{ coachRyd,',source.indexOf('{/* CALENDAR VIEW */}'))
  assert.ok(start>=0)
  assert.equal(source.slice(start,source.indexOf('}} />',start)+5),baseline.calendar)
  for(const width of [375,1280]) {
    const {tree,calls}=draw('?coachRyd=1',width,'calendar')
    const calendar=nodes(tree).find(n=>n.type==='KalenderView')
    for(const name of ['openProfile','openPlanReview','snoozeAthlete']) {
      assert.equal(calendar.props[name],handlers[name])
      calendar.props[name]({id:'synthetic'},'program')
    }
    assert.deepEqual(calls,['openProfile','openPlanReview','snoozeAthlete'].map(name=>[name,{id:'synthetic'},'program']))
  }
})

test('repair: explicit ON and release ON replace calendar and retain inbox task handlers',()=>{
  for(const width of [375,1280]) for(const search of ['?programOverblik=1','?coachRyd=1&programOverblik=1','?rel1030=1']) {
    const {tree}=draw(search,width,'calendar')
    assert.equal(nodes(tree).some(n=>n.type==='KalenderView'),false)
    assert.ok(nodes(tree).find(n=>n.props['aria-label']==='Programoverblik'))
    assert.equal(nodes(tree).find(n=>n.type==='Sidebar').props.programOverblik,true)
    if(search.includes('coachRyd=1')||search==='?rel1030=1') {
      const inbox=nodes(draw(search,width,'inbox').tree).find(n=>n.type==='LazyBoundary'&&n.props.label==='Indbakke')
      const task=inbox.props.componentProps.calendarTasks
      assert.equal(task.type,'KalenderView')
      assert.equal(task.props.tasksOnly,true)
      for(const name of ['openProfile','openPlanReview','snoozeAthlete']) assert.equal(task.props[name],handlers[name])
    }
  }
})
