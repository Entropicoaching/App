import test from 'node:test'
import assert from 'node:assert/strict'
import { mountSession } from './sessionView.mjs'
import { setSuggestion } from './sessionModel.mjs'
import { dom, button } from './a11y-dom.mjs'
import { quickSetFixture } from './sessionQuickSetFixture.mjs'

// U11 (ordre 120): atletens daglige vej gået igennem headless 11. nov. De tre største huller, der er bygget.

function setup(t, change = () => {}) {
  const f = quickSetFixture(); change(f)
  const root = dom(), timers = new Set()
  const clock = { Date, setInterval(fn) { timers.add(fn); return fn }, clearInterval(fn) { timers.delete(fn) } }
  const view = mountSession(root, () => f.p, { clock })
  t.after(() => view.dispose())
  view.controller.start()
  const field = name => root.querySelector(`[data-field="${name}"]`)
  return { ...f, root, view, timers, field }
}

test('U11 hul 1: et interval som "4-6" udfylder det laveste tal, så første tryk ikke giver en fejl', async t => {
  const f = setup(t, f => { f.exercise.reps = '4-6'; f.exercise.recommended_weight = 87.5 })
  assert.equal(f.field('reps').value, '4')
  assert.equal(f.field('weight').value, '87,5')
  assert.ok(button(f.root, 'Som planlagt'))
  f.root.querySelector('form').dispatch('submit'); await Promise.resolve()
  assert.equal(f.calls.length, 1); assert.equal(f.calls[0].reps, 4)
  assert.doesNotMatch(f.root.textContent, /Skriv vægt og hele gentagelser/)
  // Mellemrum og lang tankestreg tæller også; tekst som AMRAP og "8 pr. side" kræver stadig indtastning.
  for (const [reps, expected] of [['8 - 10', '8'], ['6–8', '6'], ['AMRAP', ''], ['8 pr. side', ''], ['frit', '']]) {
    const s = setSuggestion(f.p, { exercise: { ...f.exercise, reps }, setNumber: 1 }, [])
    assert.equal(s.reps, expected, reps)
  }
})

test('U11 hul 2: "Film dette sæt" står i passet, lægger passet til side og åbner videocoachen', t => {
  let filmed = 0, openWhenFilmed = null, f
  f = setup(t, g => { g.p.onFilmSet = () => { filmed++; openWhenFilmed = f.view.controller.state().open } })
  const film = button(f.root, 'Film dette sæt')
  assert.ok(film, 'knappen findes i passet')
  film.dispatch('click')
  assert.equal(filmed, 1)
  // Passet er en modal dialog i browserens øverste lag; videocoachen kan kun ses, når den er lukket.
  assert.equal(openWhenFilmed, false, 'passet er lukket, før videocoachen åbner')
  assert.equal(f.root.querySelector('dialog'), null)
  assert.ok(f.view.controller.state().selection, 'passet er gemt og åbnes igen med ét tryk')
  assert.ok(button(f.root, 'Åbn dagens pas'))
  const none = setup(t)
  assert.equal(button(none.root, 'Film dette sæt'), undefined, 'uden videocoach ingen knap')
  const preview = setup(t, f => { f.p.onFilmSet = () => { filmed++ }; f.p.readOnly = true })
  assert.equal(button(preview.root, 'Film dette sæt'), undefined, 'coachens forhåndsvisning filmer ikke')
})

test('U11 hul 3: et sæt i offline-køen starter pausen; et parkeret sæt gør ikke', t => {
  const f = setup(t, f => {
    f.p.onLogSet = (ex, set_number, total, reps, planned, input) => {
      f.calls.push({ set_number })
      f.p.exerciseLogs.push({ athlete_id: f.p.athleteId, exercise_id: ex.id, set_number, weight: Number(input.weight),
        reps_completed: reps, logged_at: new Date().toISOString(), _optimistic: true })
      f.p.pendingSyncKeys = [`${ex.id}_${set_number}`]
      return { phase: 'queued' }
    }
  })
  return (async () => {
    f.root.querySelector('form').dispatch('submit'); await new Promise(r => setTimeout(r, 0)); f.view.update()
    assert.equal(f.calls.length, 1)
    assert.equal(f.timers.size, 1, 'pausen kører, selvom nettet mangler')
    assert.equal(f.root.querySelector('.e2-rest').hidden, false)
    const g = setup(t, g => {
      g.p.exerciseLogs = [{ athlete_id: g.p.athleteId, exercise_id: 'quick-a', set_number: 1, weight: 80, reps_completed: 5,
        logged_at: new Date(Date.now() + 1000).toISOString(), _optimistic: true }]
    })
    g.p.exerciseLogs[0].logged_at = new Date().toISOString()
    g.p.parkedSets = [{ exerciseId: 'quick-a', setNumber: 1 }]; g.p.pendingSyncKeys = ['quick-a_1']; g.view.update()
    assert.equal(g.timers.size, 0, 'parkeret sæt starter ingen pause')
    g.p.parkedSets = []; g.p.pendingSyncKeys = []; g.view.update()
    assert.equal(g.timers.size, 0, 'et optimistisk sæt uden kø venter stadig på serveren')
  })()
})

test('U11 hul 3, som i appen: passets skrivning lægger sættet i atletens kø uden en række, og pausen starter', async t => {
  const store = new Map()
  const storage = { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) }
  const before = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true, writable: true })
  t.after(() => before ? Object.defineProperty(globalThis, 'localStorage', before) : delete globalThis.localStorage)
  const f = setup(t, f => {
    f.p.onLogSet = (ex, set_number, total, reps, planned, input) => {
      f.calls.push({ set_number })
      storage.setItem(`entropi_offline_sets:${f.p.athleteId}`, JSON.stringify({ [`${ex.id}_${set_number}`]: { exerciseId: ex.id, setNumber: set_number,
        payload: { logged_at: new Date().toISOString(), weight: Number(input.weight), reps_completed: reps, skipped: false }, clientId: 'syntetisk' } }))
      f.p.pendingSyncKeys = [`${ex.id}_${set_number}`]
      return { phase: 'queued' }
    }
  })
  f.root.querySelector('form').dispatch('submit'); await new Promise(r => setTimeout(r, 0)); f.view.update()
  assert.equal(f.calls.length, 1); assert.equal(f.p.exerciseLogs.length, 0)
  assert.equal(f.timers.size, 1, 'pausen kører ud fra køen')
  // En anden atlets kø eller en sletning i køen starter intet.
  const g = setup(t)
  storage.setItem(`entropi_offline_sets:${g.p.athleteId}`, JSON.stringify({ 'quick-a_1': { op: 'delete', exerciseId: 'quick-a', setNumber: 1 } }))
  g.p.pendingSyncKeys = ['quick-a_1']; g.view.update()
  assert.equal(g.timers.size, 0)
})
