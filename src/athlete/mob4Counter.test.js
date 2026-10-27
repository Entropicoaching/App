import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { install, moduleURL } from './mob4Loader.mjs'
import { mount, text, button } from './mob4Dom.mjs'
install(process.argv.includes('--crlf') ? '\r\n' : '\n')
const { MobilityHelped, MobilityHelpedProfile, readHelped, toggleHelped } = await import(moduleURL('mobilityHelped.mjs'))
const date = '2026-10-27'
const ex = { id: 'id', name: '<img onerror=attack()>' }
function memory() {
  const map = new Map()
  return { getItem: k => map.get(k) ?? null, setItem: (k, v) => map.set(k, v) }
}
test('counter: flag switched off unmounts state, then reloads a fresh selection', () => {
  const storage = memory(), props = { enabled: true, athleteId: 'a', date, exercises: [ex], storage }
  const view = mount(MobilityHelped, props)
  button(view.render(), 'Hjalp: ' + ex.name).props.onClick()
  assert.equal(view.render({ ...props, enabled: false }), null)
  toggleHelped('a', ex, date, storage)
  assert.equal(button(view.render(props), 'Hjalp: ' + ex.name).props['aria-pressed'], false)
})
test('counter: invalid context and impossible date do not touch storage', () => {
  const storage = { getItem() { assert.fail('read') }, setItem() { assert.fail('write') } }
  for (const athleteId of [undefined, '', 2, 'a'.repeat(201)]) {
    assert.equal(mount(MobilityHelped, { enabled: true, athleteId, date, exercises: [ex], storage }).render(), null)
    assert.ok(toggleHelped(athleteId, ex, date, storage).error)
  }
  assert.equal(mount(MobilityHelped, { enabled: true, athleteId: 'a', date: '2026-02-30', exercises: [ex], storage }).render(), null)
})
test('counter: names stay text nodes and duplicate ids yield a single toggle', () => {
  const storage = memory()
  const view = mount(MobilityHelped, { enabled: true, athleteId: 'a', date, exercises: [ex, ex, null], storage })
  const control = button(view.render(), 'Hjalp: ' + ex.name)
  assert.ok(control.props.children.every(child => typeof child === 'string'))
  assert.equal(control.props.dangerouslySetInnerHTML, undefined)
  assert.ok(control.props.style.minHeight >= 44)
  control.props.onClick()
  assert.equal(readHelped('a', storage).rows.length, 1)
})
test('counter: failed removal retains the saved mark and unrelated rows', () => {
  const storage = memory()
  toggleHelped('a', ex, date, storage)
  toggleHelped('a', { id: 'other', name: 'Other' }, date, storage)
  storage.setItem = () => { throw Error('full') }
  const view = mount(MobilityHelped, { enabled: true, athleteId: 'a', date, exercises: [ex], storage })
  button(view.render(), 'Hjalp: ' + ex.name).props.onClick()
  assert.match(text(view.render()), /kunne ikke gemmes/)
  assert.equal(button(view.render(), 'Hjalp: ' + ex.name).props['aria-pressed'], true)
  assert.equal(readHelped('a', storage).rows.length, 2)
})
test('counter: unavailable storage is reported on both surfaces', () => {
  const storage = { getItem() { throw Error('blocked') } }
  const tree = mount(MobilityHelpedProfile, { enabled: true, athleteId: 'a', storage }).render()
  assert.match(text(tree), /kunne ikke læses/)
  assert.match(text(tree), /ukendt/)
  assert.doesNotMatch(text(tree), /Ingen lokale markeringer tilgængelige/)
})
test('flag wiring uses strict opt-in through existing entry points and disables preview writes', () => {
  const source = name => readFileSync(moduleURL(name) || new URL('./' + name, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
  // These are wiring assertions in addition to the actual component and handler imports above.
  const app = source('App.jsx'), athlete = source('AthleteView.jsx'), dashboard = source('Dashboard.jsx')
  assert.match(app, /mobilitetHjalp = false/)
  assert.equal((app.match(/mobilitetHjalp: mobilitetHjalp === true/g) || []).length, 3)
  assert.match(athlete, /mobilitetHjalp: mobilitetHjalp === true && !coachAthleteId, athleteId: athlete\?\.id, mobilityDate: today\(\)/)
  assert.match(dashboard, /<ProfilHoved \{\.\.\.\{ mobilitetHjalp: mobilitetHjalp === true/)
})
