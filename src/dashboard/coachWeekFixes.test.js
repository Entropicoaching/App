import test from 'node:test'
import assert from 'node:assert/strict'
import { readerFixture } from './readerFixture.mjs'
import { effectFixture } from './effectFixture.mjs'
import { weekRows, renderWeekOverview } from './coachWeekOverview.mjs'
import * as overview from './coachWeekOverview.mjs'
import { element } from './syntheticDom.mjs'

test('F1: actual reader imports under plain node --test', async () => {
  const f = await readerFixture({})
  await f.reader.fetchCalendarWeeks(['a'])
  assert.equal(f.statuses.plan, 'ready')
})

test('F2: two periods with the same week number stay separate including skips and RPE', async () => {
  const log = (id, skipped, rpe_actual) => ({ athlete_id:'a', skipped, rpe_actual, rpe_planned:7,
    exercises:{ sessions:{ id:id+'session', weeks:{id,week_number:3} } } })
  const f = await readerFixture({exercise_logs:[log('new',false,8),log('old',false,10),log('old',true,10)]})
  await f.reader.fetchCalendarProgress(['a'])
  const entries = [{athlete:{id:'a',name:'A'},current:{id:'new',week_number:3,planned_sets:4}}]
  const [row] = weekRows(entries,f.values.AthleteWeekCompletion)
  assert.equal(row.logged,1); assert.equal(row.missed,0); assert.equal(row.remaining,3); assert.equal(row.rpe,1)
  assert.ok(f.calls[0].select[0].includes('weeks(id, week_number)'))
  const dom = renderWeekOverview(element,{enabled:true,entries,completion:f.values.AthleteWeekCompletion,
    status:f.statuses.plan ? f.statuses : {plan:'ready',...f.statuses}})
  assert.ok(dom.textContent.includes('Logget: 1 sæt'))
  assert.ok(dom.textContent.includes('Endnu ikke logget: 3 sæt'))
})

test('F4: enabled calendar effect ignores metadata-only athlete changes but refreshes membership and view', async () => {
  const render = await effectFixture()
  const calls = []
  const props = {coachWeekEnabled:true,view:'list',athletes:[{id:'a',name:'A'}],
    fetchCalendarWeeks:ids=>calls.push(['plan',ids]),fetchCalendarProgress:ids=>calls.push(['logs',ids])}
  render(props)
  render({...props,athletes:[{id:'a',name:'Renamed',snooze_until:'2026-11-01'}]})
  assert.equal(calls.length,2)
  render({...props,athletes:[{id:'a'},{id:'b'}]})
  assert.equal(calls.length,4)
  render({...props,view:'calendar'})
  assert.equal(calls.length,6)
})

test('counterexample: flag off retains athlete-object refresh behavior', async () => {
  const render = await effectFixture(), calls=[]
  const props={view:'list',athletes:[{id:'a'}],fetchCalendarWeeks:ids=>calls.push(ids),fetchCalendarProgress:()=>{}}
  render(props); render({...props,athletes:[{id:'a',name:'Changed'}]})
  assert.equal(calls.length,2)
})

test('counterexample: a known week ID cannot borrow legacy or unknown-ID totals', () => {
  const [row]=weekRows([{athlete:{id:'a'},current:{id:'new',week_number:3,planned_sets:4}}],{a:{3:{sets:30},'id:old':{sets:10}}})
  assert.equal(row.logged,0); assert.equal(row.remaining,4)
})

test('counterexample: reused week number selects the dated current plan and refuses ambiguity', () => {
  const old={id:'old',week_number:3,start_date:'2026-05-04',planned_sets:30}
  const current={id:'new',week_number:3,start_date:'2026-10-26',planned_sets:4}
  const today=new Date('2026-10-27T12:00:00')
  assert.equal(overview.selectOverviewWeek([old,current],old,today),current)
  assert.equal(overview.selectOverviewWeek([old,{...current,start_date:null}],old,today),undefined)
  assert.equal(overview.selectOverviewWeek([old,current,{...current,id:'duplicate'}],old,today),undefined)
})
