import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { weekRows, renderWeekOverview, addWeekRpe } from './coachWeekOverview.mjs'
import { readerFixture } from './coachWeekReaderFixture.mjs'
import { element } from './syntheticDom.mjs'
const source = name => {
  const local = new URL(name, import.meta.url)
  return readFileSync(existsSync(local) ? local : new URL('../'+name, import.meta.url), 'utf8').replace(/\r\n/g,'\n')
}
const entry = { athlete: { id:'one', name:'En atlet' }, current:{week_number:4,planned_sets:6} }

test('counterexample: no log is not a missed set and no RPE is not zero', () => {
  const [row] = weekRows([entry],{})
  assert.equal(row.missed,0); assert.equal(row.remaining,6); assert.equal(row.rpe,null)
})

test('counterexample: balanced signed RPE is shown as measured zero with coverage', () => {
  const c = {}; addWeekRpe(c,{rpe_actual:8,rpe_planned:7}); addWeekRpe(c,{rpe_actual:6,rpe_planned:7})
  const dom=renderWeekOverview(element,{enabled:true,profileTab:'log', entries:[entry], completion:{one:{4:c}},status:{plan:'ready',logs:'ready'}})
  assert.ok(dom.textContent.includes('RPE: 0,0 (2 sæt)'))
})

test('counterexample: unknown current program cannot borrow another week or athlete', () => {
  const [row] = weekRows([{athlete:entry.athlete}],{one:{4:{sets:6,rpeCount:2,rpeDeltaSum:4}}})
  assert.equal(row.week,null); assert.equal(row.planned,null); assert.equal(row.rpe,null); assert.equal(row.logged,0)
})

test('counterexample: reader failure with cached values still suppresses totals', async () => {
  const f = await readerFixture({}, {fail:true})
  await f.reader.fetchCalendarProgress(['one'])
  const dom=renderWeekOverview(element,{enabled:true,profileTab:'log', entries:[entry], completion:{one:{4:{sets:6}}},status:{plan:'ready',...f.statuses}})
  assert.ok(dom.textContent.includes('kunne ikke indlæses')); assert.equal(dom.queryAll('button').length,0)
})

test('final wiring: coach-only flag, source visibility scope, same selected program week and no truncation', () => {
  const dashboard=source('Dashboard.jsx'), home=source('ForsideView.jsx'), reader=source('laesninger.js')
  assert.ok(dashboard.includes("coachWeekFlag(typeof window === 'undefined' ? '' : window.location.search)"))
  assert.ok(dashboard.includes('coachWeekEnabled, setCoachWeekDataStatus,'))
  assert.ok(dashboard.includes('coachWeekEnabled, coachWeekDataStatus,'))
  assert.ok(home.includes('enabled: coachWeekEnabled, entries: athletesWithAfvigelse'))
  assert.ok(home.includes('.filter(ath => !hiddenAthleteIds.has(ath.id))'))
  assert.ok(home.includes('athleteWeeks.find(week => week.week_number === currentNo)'))
  assert.ok(home.includes('completion: athleteWeekCompletion, status: coachWeekDataStatus, loading, loadError, openProfile'))
  assert.ok(reader.includes("(coachWeekEnabled ? 'rpe_actual, rpe_planned, ' : '')"))
  assert.ok(!source('coachWeekOverview.mjs').includes('localStorage'))
})
