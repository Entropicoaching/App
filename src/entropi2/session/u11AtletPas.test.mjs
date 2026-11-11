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

test('U11 hul 2: "Film dette sæt" står i passet og åbner videocoachen uden at lukke passet', t => {
  let filmed = 0
  const f = setup(t, f => { f.p.onFilmSet = () => { filmed++ } })
  const film = button(f.root, 'Film dette sæt')
  assert.ok(film, 'knappen findes i passet')
  film.dispatch('click')
  assert.equal(filmed, 1)
  assert.equal(f.view.controller.state().open, true)
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
