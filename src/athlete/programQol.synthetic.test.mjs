import test from 'node:test'
import assert from 'node:assert/strict'
import { install } from './prog3Loader.mjs'
import { mount, nodes, text, enableEffects, flushEffects } from './prog3Dom.mjs'
import { programQolFixture, lastWeekKey } from './programQolFixture.mjs'
install()
const { default: Program } = await import('./ProgramTab.jsx')
const next = tree => nodes(tree, n => n.props['data-program-next'] !== undefined)[0]
const history = tree => nodes(tree, n => n.props['data-program-history'])[0]
const button = (tree, label) => nodes(tree, n => n.type === 'button' && text(n) === label)[0]
const storageOwners = new WeakSet()
function mockStorage(t, value) {
  if (!storageOwners.has(t)) {
    storageOwners.add(t)
    const before = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
    t.after(() => { if (before) Object.defineProperty(globalThis, 'localStorage', before); else delete globalThis.localStorage })
  }
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, writable: true, value })
}
function storage() {
  const data = new Map(), writes = [], reads = []
  return { data, writes, reads, getItem(k) { reads.push(k); return data.get(k) ?? null },
    setItem(k, v) { writes.push([k, v]); data.set(k, v) } }
}
function app(extra = {}) {
  let props = programQolFixture(extra)
  const calls = []
  Object.assign(props, {
    setViewingWeekIdx: i => { props = { ...props, viewingWeekIdx: i }; calls.push(['week', i]) },
    setProgOpenSession: id => { props = { ...props, progOpenSession: id }; calls.push(['session', id]) },
    setPastLogs: logs => { props = { ...props, pastLogs: logs } },
    fetchPastLogs: (week, id) => calls.push(['past', week.id, id]),
  })
  const view = mount(Program, props)
  return { calls, get props() { return props }, update(extra) { props = { ...props, ...extra } },
    render() { return view.render(props) } }
}

test('next uses exact set identities, skips closed passes and ignores the browsed historical week', () => {
  const props = programQolFixture({ viewingWeekIdx: 0 })
  let tree = mount(Program, props).render()
  assert.match(text(next(tree)), /Pas 1-0/)
  for (const skipped of [false, true]) {
    tree = mount(Program, { ...props, exerciseLogs: [{ exercise_id: 'ex-1-0', set_number: 1, skipped }] }).render()
    assert.match(text(next(tree)), /Pas 1-1/)
  }
  props.exerciseLogs = [{ exercise_id: 'ex-1-0', set_number: 2 }]
  assert.match(text(next(mount(Program, props).render())), /Pas 1-0/)
})

test('unknown evidence, empty program, errors and strict OFF have no suggested target', () => {
  for (const extra of [{ programError: true }, { allWeeks: [] }, ...[false, null, 0, 1, 'true'].map(entropi2 => ({ entropi2 }))]) {
    const tree = mount(Program, programQolFixture(extra)).render()
    assert.equal(next(tree), undefined)
    if (extra.entropi2 !== undefined) assert.equal(history(tree), undefined)
  }
  for (const sets of [null, undefined, '', ' ', -1, 1.5, 'unknown']) {
    const props = programQolFixture()
    props.allWeeks[1].sessions[0].exercises[0].sets = sets
    assert.equal(next(mount(Program, props).render()), undefined)
  }
  const props = programQolFixture()
  props.allWeeks[1].readEvidence = { complete: false }
  assert.equal(next(mount(Program, props).render()), undefined)
})

test('historical navigation is closed, unique across blocks, and never contains the set logger', () => {
  const props = programQolFixture({ progOpenSession: 'session-1-0' })
  props.allWeeks[0].block_name = 'Tidligere blok'
  const tree = mount(Program, props).render(), fold = history(tree)
  assert.equal(fold.props.open, undefined)
  assert.match(text(fold), /^Vis tidligere uger/)
  assert.equal(nodes(tree, n => n.type === 'button' && /^Uge 0/.test(text(n))).length, 1)
  assert.equal(nodes(fold, n => n.type === 'input').length, 0)
  assert.ok(nodes(tree, n => n.type === 'input' && n.props['aria-label'] === 'Vægt, sæt 1').length)
})

test('navigation writes only the athlete key; restore handles remount, changed indices and athlete switches', async t => {
  enableEffects()
  const store = storage()
  mockStorage(t, store)
  const first = app()
  let tree = first.render(); await flushEffects(); tree = first.render()
  button(tree, '← Forrige uge').props.onClick()
  assert.deepEqual(store.writes, [[lastWeekKey('synthetic-qol'), '"qol-week-0"']])
  const second = app({ allWeeks: [first.props.allWeeks[2], first.props.allWeeks[0], first.props.allWeeks[1]] })
  second.render(); await flushEffects(); second.render()
  assert.equal(second.props.viewingWeekIdx, 1, 'week identity survives index changes')
  assert.deepEqual(second.calls, [], 'saved week is already open at the changed index')
  const third = app()
  third.render(); await flushEffects(); third.render()
  assert.equal(third.props.viewingWeekIdx, 0)
  assert.ok(third.calls.some(call => call[0] === 'past'))
  third.update({ athlete: { id: 'synthetic-other' }, viewingWeekIdx: 1 })
  third.render(); await flushEffects(); third.render()
  assert.equal(third.props.viewingWeekIdx, 1)
  assert.equal(store.reads.at(-1), lastWeekKey('synthetic-other'))
  assert.equal(store.writes.length, 1, 'restore never overwrites another athlete or the saved week')
})

test('jump opens current or upcoming pass, then scrolls and focuses after its week is rendered', async t => {
  enableEffects()
  const store = storage(); mockStorage(t, store)
  const a = app({ viewingWeekIdx: 0 })
  let tree = a.render(); await flushEffects(); tree = a.render()
  next(tree).props.onClick()
  const effects = []
  a.props.sessionRefs.current['session-1-0'] = { scrollIntoView: () => effects.push('scroll'), focus: () => effects.push('focus') }
  tree = a.render(); await flushEffects()
  assert.equal(a.props.viewingWeekIdx, 1)
  assert.equal(a.props.progOpenSession, 'session-1-0')
  assert.deepEqual(effects, ['scroll', 'focus'])
  assert.ok(nodes(tree, n => n.type === 'input' && n.props['aria-label'] === 'Vægt, sæt 1').length)
  a.update({ exerciseLogs: [0, 1].map(day => ({ exercise_id: `ex-1-${day}`, set_number: 1 })) })
  a.render(); await flushEffects(); tree = a.render()
  assert.match(text(next(tree)), /Pas 2-0/)
  next(tree).props.onClick(); a.render(); await flushEffects()
  assert.equal(a.props.viewingWeekIdx, 2)
  assert.equal(a.props.progOpenSession, 'session-2-0')
})

test('missing, stale, corrupt and unavailable storage preserve navigation; OFF does no storage IO', async t => {
  enableEffects()
  for (const saved of [null, '"deleted-week"', '{broken', '{}']) {
    const store = storage(); if (saved !== null) store.data.set(lastWeekKey('synthetic-qol'), saved)
    mockStorage(t, store)
    const a = app(); a.render(); await flushEffects(); a.render()
    assert.equal(a.props.viewingWeekIdx, 1)
    assert.equal(store.writes.length, 0)
  }
  const blocked = { getItem() { throw Error('blocked') }, setItem() { throw Error('quota') } }
  mockStorage(t, blocked)
  const a = app(); let tree = a.render(); await flushEffects(); tree = a.render()
  assert.doesNotThrow(() => button(tree, 'Næste uge →').props.onClick())
  assert.equal(a.props.viewingWeekIdx, 2)
  const store = storage(); mockStorage(t, store)
  for (const entropi2 of [false, null, 0, 1, 'true']) {
    const a = app({ entropi2 }); const tree = a.render(); await flushEffects()
    button(tree, 'Næste uge →').props.onClick()
  }
  assert.deepEqual(store.reads, []); assert.deepEqual(store.writes, [])
})
