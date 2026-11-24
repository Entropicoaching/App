// Ordre 2033f: valget "Vis pausetimeren mellem sæt" staar under Mig, er slaaet til som standard og huskes pr. atlet.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ProfilePage } from './ProfilePage.mjs'
import { PausetimerValg } from './PausetimerValg.mjs'
import { isRestTimerHidden, setRestTimerHidden } from '../../restTimerVisning.js'

const fakeStorage = () => {
  const map = new Map()
  return { getItem: k => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: k => map.delete(k), map }
}

test('Mig viser valget, slaaet til som standard', () => {
  const html = renderToStaticMarkup(h(ProfilePage, { enabled: true, ownerId: 'fixture-user', athlete: {
    id: 'fixture-athlete', user_id: 'fixture-user', name: 'Testatlet' },
    onClose() {}, client: { from() { assert.fail('render must not read') } } }))
  assert.match(html, /Pausetimer i dagens pas/)
  assert.match(html, /<input type="checkbox"[^>]*data-pausetimer-vis=""[^>]*checked=""/)
  assert.match(html, /Vis pausetimeren mellem sæt/)
  assert.match(html, /Pausen registreres stadig/)
})

test('et gemt valg vises som slaaet fra, og et tryk gemmer pr. atlet', () => {
  const storage = fakeStorage()
  storage.setItem('entropi_rest_timer_skjult:a', '1')
  const off = renderToStaticMarkup(h(PausetimerValg, { athleteId: 'a', storage }))
  assert.match(off, /<input type="checkbox"(?:(?!checked)[^>])*\/>/)
  assert.match(off, /uret vises ikke i passet/)
  const on = renderToStaticMarkup(h(PausetimerValg, { athleteId: 'b', storage }))
  assert.match(on, /<input type="checkbox"[^>]*checked=""/)
  // Selve trykket: samme skriver som komponenten bruger.
  setRestTimerHidden('b', true, storage)
  assert.equal(isRestTimerHidden('b', storage), true)
  assert.equal(isRestTimerHidden('c', storage), false)
})
