// Fresh counterexamples run against the exact final modules in src/ layout.
import test from 'node:test'
import assert from 'node:assert/strict'
import { buildProgramOverblik, copenhagenDay, programOverblikEnabled } from './programOverblik.mjs'
import { programOverblikHarness } from './programOverblikHarness.mjs'
import { nodes, text } from './programOverblikRuntime.mjs'
const hook = programOverblikHarness()
const {default: ProgramOverblik} = await import('./dashboard/ProgramOverblikView.mjs')

test('counterexample: undated program precedes no program even when alphabetic order disagrees', () => {
  const athletes = [{id:'none',name:'A'}, {id:'undated',name:'Z'}]
  const result = buildProgramOverblik({athletes,calendarWeeks:{undated:[{start_date:null,exercise_count:2}]},today:'2026-10-29'})
  assert.deepEqual(result.map(r => r.status), ['undated','empty'])
})

test('counterexample: Copenhagen midnight crosses yellow/red boundary on the same UTC date', () => {
  const input = {athletes:[{id:'a',name:'A'}],calendarWeeks:{a:[{start_date:'2026-10-30',exercise_count:1}]}}
  const before = buildProgramOverblik({...input,today:'2026-10-29T22:59:59Z'})[0]
  const after = buildProgramOverblik({...input,today:'2026-10-29T23:00:00Z'})[0]
  assert.equal(before.daysLeft,7); assert.equal(before.urgency,'yellow')
  assert.equal(after.daysLeft,6); assert.equal(after.urgency,'red')
})

test('counterexample: sorted expiry follows civil date, including ISO week year rollover', () => {
  const input = {athletes:[{id:'a',name:'A'}],calendarWeeks:{a:[{week_number:999,start_date:'2026-12-28',exercise_count:1},{week_number:1,start_date:'2027-01-04',exercise_count:1}]},today:'2026-12-28'}
  const result = buildProgramOverblik(input)[0]
  assert.equal(result.lastDate,'2027-01-10')
  assert.deepEqual(result.calendarWeek,{year:2027,week:1})
  assert.equal(copenhagenDay('2026-02-30T00:00:00Z'),null)
})

test('counterexample: no global storage or I/O is needed to render or activate; long names stay text', () => {
  const prior = globalThis.localStorage
  Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw Error('Storage forbidden')}})
  try {
    assert.equal(programOverblikEnabled('?rel1030=1'),true)
    const name = '<script>synthetic only</script>' + 'x'.repeat(100)
    let call
    const tree = ProgramOverblik({athletes:[{id:'a',name}],calendarWeeks:{},today:'2026-10-29',openProfile:(...args) => {call=args}})
    const button = nodes(tree,n => n.type === 'button')[0]
    assert.ok(text(button).includes(name))
    assert.equal(nodes(tree,n => n.type === 'script').length,0)
    assert.equal(button.props.style.overflowWrap,'anywhere')
    button.props.onClick()
    assert.deepEqual(call,[{id:'a',name},'program'])
  } finally {
    delete globalThis.localStorage
    if (prior !== undefined) globalThis.localStorage = prior
  }
})

test.after(() => hook.deregister())
