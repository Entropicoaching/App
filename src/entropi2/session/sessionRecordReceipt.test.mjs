import test from 'node:test'
import assert from 'node:assert/strict'
import { mountSession } from './sessionView.mjs'
import { dom, button } from './a11y-dom.mjs'
import { quickSetFixture } from './sessionQuickSetFixture.mjs'

function setup(t) {
  const f = quickSetFixture(), root = dom(), timers = new Set()
  const view = mountSession(root, () => f.p, { clock: {
    Date: { now: () => Date.parse('2026-11-03T12:00:00Z') },
    setInterval(fn) { timers.add(fn); return fn }, clearInterval(fn) { timers.delete(fn) }
  } })
  t.after(() => { view.dispose(); assert.equal(timers.size, 0) })
  view.controller.start()
  return { ...f, root, view }
}
const receipts = f => f.root.querySelectorAll('[data-rekord-fejring]')
const row = f => ({ id: 'synthetic-row', athlete_id: f.p.athleteId, exercise_id: f.exercise.id,
  set_number: 1, weight: 82.5, reps_completed: 5 })
const receipt = () => ({ key: 'quick-a_1', id: 'quick-a_1:82.5:5', tekst: 'Ny rekord: 82,5 kg × 5' })

test('one existing receipt names its confirmed set and survives progression and final summary', t => {
  const f = setup(t)
  assert.equal(receipts(f).length, 0)
  f.p.exerciseLogs = [row(f)]; f.p.rekordFejring = receipt(); f.view.update()
  assert.equal(f.view.controller.state().key, 'quick-a_2')
  assert.equal(receipts(f).length, 1)
  assert.equal(receipts(f)[0].textContent, 'Løft A · Sæt 1: Ny rekord: 82,5 kg × 5')
  assert.equal(receipts(f)[0].getAttribute('role'), 'status')
  assert.ok(!f.root.querySelector('[data-detail="history"]').contains(receipts(f)[0]))
  f.view.controller.finish(); assert.equal(receipts(f).length, 1)
  assert.ok(f.root.querySelector('[data-session-summary]'))
  assert.equal(f.calls.length, 0)
})

test('missing, malformed, expired, undone or corrected receipt cannot claim a record', t => {
  for (const change of [
    f => { f.p.rekordFejring = null },
    f => { f.p.rekordFejring = { key: 'quick-a_1', tekst: 'Rekord' } },
    f => { f.p.rekordFejring.tekst = ' ' },
    f => { f.p.rekordFejring.key = 'quick-b_1' },
    f => { f.p.exerciseLogs = [] },
    f => { f.p.exerciseLogs[0].weight = 80 },
    f => { f.p.exerciseLogs[0].skipped = true },
    f => { f.p.exerciseLogs[0].athlete_id = 'different-athlete' },
    f => { f.p.exerciseLogsError = true },
    f => { f.p.exerciseLogsLoading = true }
  ]) {
    const f = setup(t)
    f.p.exerciseLogs = [row(f)]; f.p.rekordFejring = receipt(); f.view.update()
    assert.equal(receipts(f).length, 1)
    change(f); f.view.update(); assert.equal(receipts(f).length, 0)
    assert.equal(f.calls.length, 0)
  }
})

test('queued, parked, optimistic, foreign-session, read-only and OFF sets never celebrate', t => {
  for (const change of [
    f => { f.p.pendingSyncKeys = ['quick-a_1'] },
    f => { f.p.parkedSets = [{ exerciseId: 'quick-a', setNumber: 1 }] },
    f => { f.p.exerciseLogs[0]._optimistic = true },
    f => { f.p.exerciseLogs[0].exercise_id = 'foreign-exercise' },
    f => { f.p.readOnly = true },
    f => { f.p.enabled = false }
  ]) {
    const f = setup(t)
    f.p.exerciseLogs = [row(f)]; f.p.rekordFejring = receipt()
    change(f); f.view.update(); assert.equal(receipts(f).length, 0)
    assert.equal(f.calls.length, 0)
  }
})

test('receipt is plain text and updates without moving focused step or hiding save status', t => {
  const f = setup(t)
  const step = () => f.root.querySelector('[data-step="weight-up"]')
  step().focus(); f.p.rekordFejring = receipt(); f.view.update()
  assert.ok(f.root.ownerDocument.activeElement === step())
  f.p.exerciseLogs = [row(f)]; f.p.rekordFejring.tekst = '<strong>Rekord</strong>'
  f.view.update(); step().focus(); f.view.update()
  assert.equal(receipts(f).length, 1); assert.equal(receipts(f)[0].children.length, 0)
  assert.match(receipts(f)[0].textContent, /<strong>Rekord<\/strong>/)
  assert.ok(f.root.ownerDocument.activeElement === step())
  const progress = f.root.querySelector('[data-announce]')
  assert.match(progress.textContent, /1 af 4 sæt bekræftet/)
  f.p.rekordFejring = null; f.view.update()
  assert.equal(receipts(f).length, 0); assert.ok(f.root.ownerDocument.activeElement === step())
  button(f.root, 'Luk pas').click(); assert.equal(receipts(f).length, 0)
})
