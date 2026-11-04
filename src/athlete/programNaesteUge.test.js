import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, nodes, text, button } from './prog2Dom.mjs'
import { Program as ProgramUtenFlag, Baseline, helpers, model } from './prog2Loader.mjs'
const Program = p => ProgramUtenFlag({ entropi2: false, hviledageListe: true, ...p })

function props(index = 1, count = 6) {
  const weeks = ['2026-10-19','2026-10-26','2026-11-02'].map((start_date, i) => ({
    id: `w${i}`, week_number: i + 1, start_date,
    sessions: [{ id: `s${i}`, title: `Pas ${i}`, weekday: 0,
      exercises: Array.from({ length: count }, (_, n) => ({ id: `e${n}`, name: `Løft ${n}`, sets: 3, reps: '4-6' })) },
      { id: `rest${i}`, title: 'Pause', weekday: 2, exercises: [] }],
  }))
  const p = { ...helpers, programNaesteUge: true, allWeeks: weeks, currentWeek: weeks[0], viewingWeekIdx: index,
    athlete: { id: 'synthetic' }, exerciseLogs: [], pastLogs: [], progOpenSession: null,
    readinessLog: { readiness_score: 90 }, sessionRefs: { current: {} }, dismissedFeedback: new Set(),
    feedbackInputs: {}, logInputs: {}, exWarmupExpanded: {}, warmupChecked: {},
  }
  p.openSession = id => { p.progOpenSession = id }
  p.askConfirm = (_, callback) => callback()
  p.skipRemainingSets = session => { p.skipped = session.id }
  p.autoCompleteSession = session => { p.filled = session.id }
  return p
}
const render = p => mount(Program, p).render()
const previews = tree => nodes(tree, n => n.props['data-program-day-preview'])
function shape(v) {
  if (typeof v === 'function') return '[handler]'
  if (Array.isArray(v)) return v.map(shape)
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k,x]) => [k,shape(x)]))
  return v
}
function freeze(t, at = '2026-10-25T12:00:00Z') { t.mock.timers.enable({ apis: ['Date'], now: Date.parse(at) }) }

test('defaultOFF matches pinned baseline for all week positions and nonboolean flags', t => {
  freeze(t)
  for (const flag of [undefined,false,null,1,'true']) for (const i of [0,1,2]) {
    const p = { ...props(i), programNaesteUge: flag }
    assert.deepEqual(shape(render(p)), shape(mount(Baseline,p).render()))
  }
})
test('next week closed day shows four prescriptions and correct remaining count plus rest day', t => {
  freeze(t)
  const p = props(), tree = render(p), cards = previews(tree)
  assert.equal(cards.length,1)
  assert.equal(nodes(tree, n => n.props['data-hviledag'] !== undefined).length, 6)
  assert.equal(nodes(cards[0], n => n.type === 'li').length,4)
  for (let i=0;i<4;i++) assert.ok(text(cards[0]).includes(`Løft ${i}: 3 x 4-6`))
  assert.match(text(cards[0]), /\+2 flere/)
  assert.ok(!text(cards[0]).includes('Løft 4'))
  assert.ok(nodes(tree, n => n.props['data-hviledag'] === 2).every(n => text(n).includes('Hviledag') && !nodes(n, x => x.props.onClick).length))
  assert.ok(!text(tree).includes('Spring resten over'))
  assert.ok(!text(tree).includes('Auto-udfyld'))
  const header = nodes(tree,n => n.type === 'div' && n.props.onClick && text(n).includes('Pas 1'))[0]
  header.props.onClick()
  assert.equal(p.progOpenSession,'s1')
})
test('active week keeps buttons, handlers and baseline DOM', t => {
  freeze(t)
  const p = props(0), tree = render(p)
  assert.deepEqual(shape(tree),shape(mount(Baseline,p).render()))
  button(tree,'Spring resten over').props.onClick({stopPropagation(){}})
  button(tree,'Auto-udfyld').props.onClick({stopPropagation(){}})
  assert.equal(p.skipped,'s0');assert.equal(p.filled,'s0')
})
test('future anchored as active still hides bulk actions',t => {
  freeze(t)
  const p=props();p.currentWeek=p.allWeeks[1]
  const tree=render(p)
  assert.equal(previews(tree).length,1)
  assert.equal(nodes(tree, n => n.props['data-hviledag'] !== undefined).length,6)
  assert.ok(!text(tree).includes('Auto-udfyld'))
})
test('zero through five rows obey cap with no invented extra count',t => {
  freeze(t)
  for(let n=0;n<=5;n++) {
    const tree=previews(render(props(1,n)))[0]
    assert.equal(previews(render(props(1,n))).length, n === 0 ? 0 : 1)
    assert.equal(nodes(tree,x=>x.type==='li').length,Math.min(n,4))
    assert.equal(text(tree).includes('+1 flere'),n===5)
  }
})
test('Copenhagen DST Sundays switch at calendar Monday, not after 168 hours',t => {
  for(const [before,after,start] of [
    ['2026-03-29T21:59:59Z','2026-03-29T22:00:00Z','2026-03-30'],
    ['2026-10-25T22:59:59Z','2026-10-25T23:00:00Z','2026-10-26'],
  ]) {
    assert.equal(model.upcomingProgramWeek(start,false,new Date(before)),true)
    assert.equal(model.upcomingProgramWeek(start,true,new Date(after)),false)
  }
})
test('inferred dates, missing dates and far future respect scope',t => {
  freeze(t)
  const p=props(2);delete p.allWeeks[2].start_date
  assert.equal(previews(render(p)).length,1)
  assert.equal(model.upcomingProgramWeek(null,true),true)
  assert.equal(model.upcomingProgramWeek(null,false),false)
  assert.deepEqual(model.programDayPreview([{ name:'A\n B',sets:0,reps:'AMRAP' }]),{lines:['A B: 0 x AMRAP'],more:0})
})
