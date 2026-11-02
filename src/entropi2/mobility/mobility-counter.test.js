import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { install } from './mobility-loader.mjs'
import { dom, button, nodes, fakeClock } from './synthetic-dom.mjs'
const hooks = install()
const { mobilityModel } = await import('./mobility-model.mjs')
const { mountMobility } = await import('./mobility-screen.mjs')
const { coachNotes } = await import('./public-coachMobility.mjs')
const { WARMUP_BASE } = await import('./public-mobilityCatalog.mjs')
const s = (id, weekday = 0) => ({ id, weekday, exercises: [{ id: id + '-ex', name: 'Squat', sets: 1 }] })
const a = { id: 'a', week_number: 1, start_date: '2026-12-28', sessions: [] }
const b = { id: 'b', week_number: 2, start_date: '2027-01-04', sessions: [s('next')] }
const p = changes => ({ enabled: true, athlete: { id: 'a' }, allWeeks: [a, b], currentWeek: a,
  exerciseLogs: [], now: new Date('2027-01-03T12:00Z'), ...changes })

test('counter: year boundary, undated/flexible future and unordered weeks', () => {
  for (const next of [b, { ...b, start_date: null }, { ...b, sessions: [s('next', null)] }]) {
    const m = mobilityModel(p({ allWeeks: [next, a] }))
    assert.equal(m.selected.session.id, 'next')
    assert.equal(m.selected.date, next.sessions[0].weekday === null ? null : '2027-01-04')
    assert.equal(m.routine.length, 2)
  }
})
test('counter: null week or missing session identity fails closed', () => {
  for (const allWeeks of [[null], [{ ...b, id: null }], [a, { ...b, sessions: [{ ...s('next'), id: undefined }] }]]) {
    assert.equal(mobilityModel(p({ allWeeks })).routine.length, 0)
  }
})
test('counter: fully skipped future session cannot hide later actual bench session', () => {
  const later = { ...s('bench', 2), exercises: [{ id: 'bench-ex', name: 'Bench press', sets: 2 }] }
  const m = mobilityModel(p({ allWeeks: [a, { ...b, sessions: [s('next'), later] }],
    exerciseLogs: [{ exercise_id: 'next-ex', set_number: 1, skipped: true }] }))
  assert.equal(m.selected.session.id, 'bench'); assert.equal(m.lift, 'Bænkpres')
})
test('counter: coach focus with no explicit IDs renders existing focus content and dose', () => {
  const notes = coachNotes('a', 'Untouched note', { Squat: { need: 'Mere dybde', ids: [] } }, WARMUP_BASE)
  const model = mobilityModel(p({ athlete: { id: 'a', notes }, coachEnabled: true }))
  assert.equal(model.choices[0].exercises.length, 3)
  assert.equal(model.choices[0].exercises[0].label, '10 reps pr. side')
})
test('counter: timer unmount then remount cannot mutate another athlete screen', () => {
  const root = dom(), clock = fakeClock()
  const stop = mountMobility(root, p({ clock }))
  button(root, 'Start mobilitet').click(); button(root, 'Næste øvelse').click()
  button(root, 'Start sidetimer').click(); const stale = clock.history.at(-1)
  stop(); const dispose = mountMobility(root, p({ clock, athlete: { id: 'b' } }))
  const before = root.textContent; stale(); clock.advance(100000)
  assert.equal(root.textContent, before); assert.equal(clock.count, 0); dispose()
})
test('counter: absent navigation callback does not leave a dead navigation control', () => {
  const root = dom(); mountMobility(root, p())
  assert.equal(nodes(root, 'button').some(n => n.textContent === 'Til programmet'), false)
  button(root, 'Start mobilitet').click()
  assert.equal(nodes(root, 'button').some(n => n.textContent === 'Til programmet'), false)
})
test('counter: closed synthetic imports reject backend/FS edges from actual module', async () => {
  const probe = registerHooks({ resolve(specifier, context, next) {
    if (specifier === 'synthetic-forbidden-probe') return next('node:fs', {
      ...context, parentURL: new URL('./mobility-model.mjs', import.meta.url).href })
    return next(specifier, context)
  } })
  try { await assert.rejects(import('synthetic-forbidden-probe'), /Closed synthetic import: node:fs/) }
  finally { probe.deregister() }
})
test.after(() => hooks.deregister())
