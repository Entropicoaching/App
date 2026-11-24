// Ordre 2033f (Marc 23. nov.: timeren kan tilvaelges skjult): med p.restTimerHidden vises hverken
// passets eget ur (.e2-rest) eller linjen "Pause: N sekunder". Pausen registreres stadig (uret koerer).
import test from 'node:test'
import assert from 'node:assert/strict'
import { mountSession } from './sessionView.mjs'
import { dom } from './a11y-dom.mjs'
import { quickSetFixture } from './sessionQuickSetFixture.mjs'

function setup(t, change = () => {}) {
  const f = quickSetFixture(); change(f)
  const root = dom(), timers = new Set()
  const clock = { Date, setInterval(fn) { timers.add(fn); return fn }, clearInterval(fn) { timers.delete(fn) } }
  const view = mountSession(root, () => f.p, { clock })
  t.after(() => view.dispose())
  view.controller.start()
  return { ...f, root, view, timers }
}
const queuedWriter = f => (ex, set_number, total, reps, planned, input) => {
  f.calls.push({ set_number })
  f.p.exerciseLogs.push({ athlete_id: f.p.athleteId, exercise_id: ex.id, set_number, weight: Number(input.weight),
    reps_completed: reps, logged_at: new Date().toISOString(), _optimistic: true })
  f.p.pendingSyncKeys = [`${ex.id}_${set_number}`]
  return { phase: 'queued' }
}
const logSet = async f => { f.root.querySelector('form').dispatch('submit'); await new Promise(r => setTimeout(r, 0)); f.view.update() }

test('skjult: uret og pauselinjen er skjult, men pausen koerer og saettet er registreret', async t => {
  const f = setup(t, g => { g.p.restTimerHidden = true; g.p.onLogSet = queuedWriter(g) })
  await logSet(f)
  assert.equal(f.calls.length, 1, 'saettet er registreret')
  assert.equal(f.root.querySelector('.e2-rest').hidden, true, 'uret vises ikke')
  assert.equal(f.timers.size, 0, 'intet ur taeller synligt')
  f.p.restPause = { startedAt: Date.now(), durationSeconds: 60 }; f.view.update()
  const line = f.root.querySelectorAll('p').find(n => n.getAttribute('aria-label') === 'Pause mellem sæt')
  assert.equal(line.hidden, true, 'pauselinjen vises heller ikke')
  // Valget slaas til igen: pausen var registreret imens, saa uret staar og taeller uden ny registrering.
  f.p.restTimerHidden = false; f.view.update()
  assert.equal(f.root.querySelector('.e2-rest').hidden, false)
  assert.ok(f.timers.size >= 1, 'pausen blev registreret, mens uret var skjult, og taeller nu')
  assert.match(f.root.querySelector('.e2-rest').textContent, /Efter Løft A/)
  assert.match(f.root.querySelector('.e2-rest [role="timer"]').textContent, /^\d+:\d\d$/)
  assert.equal(f.calls.length, 1)
})

test('standard (ingen prop) viser uret som foer', async t => {
  const f = setup(t, g => { g.p.onLogSet = queuedWriter(g) })
  await logSet(f)
  assert.equal(f.root.querySelector('.e2-rest').hidden, false)
})
