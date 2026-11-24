// Ordre 2033f (Marc 23. nov.: "film dette set knappen er under alle set"): den store "Film sættet" staar
// kun ved oevelsens foerste saet, der ikke er registreret eller sprunget over. Ved de naeste saet staar et
// lille link i saetlinjen, saa et andet saet stadig kan filmes uden ekstra skaerm. Ny oevelse: stor knap igen.
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
  return { ...f, root, view }
}
const filmButtons = root => root.querySelectorAll('button').filter(n => n.textContent === 'Film sættet')
const big = root => filmButtons(root).filter(n => n.getAttribute('class') === 'film-set')
const small = root => filmButtons(root).filter(n => n.getAttribute('class') === 'film-set-link')
const setLine = root => root.querySelectorAll('p').find(n => /^Sæt \d+ af \d+/.test(n.textContent))
const logSet = async f => { f.root.querySelector('form').dispatch('submit'); await Promise.resolve(); f.view.update() }

test('den store knap staar ved foerste saet af oevelsen; ved de naeste saet er den et lille link i saetlinjen', async t => {
  let filmed = 0
  const f = setup(t, g => { g.p.onFilmSet = () => { filmed++ } })
  assert.equal(big(f.root).length, 1, 'saet 1: een stor knap')
  assert.equal(small(f.root).length, 0)
  await logSet(f)
  assert.equal(f.view.controller.state().next.setNumber, 2)
  assert.equal(big(f.root).length, 0, 'saet 2: ingen stor knap under saettet')
  assert.equal(small(f.root).length, 1, 'saet 2: eet lille link')
  assert.equal(filmButtons(f.root).length, 1, 'knappen staar kun eet sted')
  const link = small(f.root)[0]
  assert.equal(link.parentNode, setLine(f.root).parentNode, 'linket staar ved siden af saetlinjen, ikke under saettet')
  assert.equal(setLine(f.root).textContent, 'Sæt 2 af 3', 'saetlinjens tekst er uaendret')
  assert.equal(link.getAttribute('aria-label'), 'Film sættet, sæt 2')
  link.dispatch('click')
  assert.equal(filmed, 1, 'et andet saet kan stadig filmes uden ekstra skaerm')
  assert.equal(f.view.controller.state().open, false, 'passet lukkes foer videocoachen aabner, som foer')
})

test('et sprunget foerste saet taeller som begyndt; en ny oevelse faar den store knap igen', async t => {
  const f = setup(t, g => { g.p.onFilmSet = () => {}; g.p.onSkipSet = () => {}; g.exercise.sets = 2 })
  const s = f.view.controller.state()
  f.p.exerciseLogs.push({ athlete_id: f.p.athleteId, exercise_id: f.exercise.id, set_number: 1, skipped: true, logged_at: new Date().toISOString() })
  f.view.update()
  assert.equal(f.view.controller.state().next.setNumber, 2, s.key)
  assert.equal(big(f.root).length, 0); assert.equal(small(f.root).length, 1)
  await logSet(f)
  assert.equal(f.view.controller.state().next.exercise.id, f.other.id, 'naeste oevelse')
  assert.equal(big(f.root).length, 1, 'ny oevelse: stor knap igen'); assert.equal(small(f.root).length, 0)
})

test('uden videocoach eller i coachens forhaandsvisning findes hverken knap eller link', async t => {
  const none = setup(t)
  await logSet(none)
  assert.equal(filmButtons(none.root).length, 0)
  const preview = setup(t, g => { g.p.onFilmSet = () => {}; g.p.readOnly = true })
  assert.equal(filmButtons(preview.root).length, 0)
})
