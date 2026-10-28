import test from 'node:test'
import assert from 'node:assert/strict'
import { install } from './nytTestLoader.mjs'
import { mount, nodes, text, button } from './nytTestDom.mjs'
install()
const { default: NytIAppen, nytStorageKey, nytAthleteNavigation, nytCoachNavigation } = await import('./nytIAppen.mjs')
const { nytIAppenText: copy } = await import('./nytIAppenText.mjs')
const memory = () => {
  const values = new Map(), calls = []
  return { values, calls, getItem(key) { calls.push(['read', key]); return values.get(key) ?? null },
    setItem(key, value) { calls.push(['write', key, value]); values.set(key, value) } }
}
const props = (storage, role = 'athlete', profileId = 'synthetic-A') => ({
  search: '?rel1030=1', role, profileId, storage, onNavigate() {},
})
const links = tree => nodes(tree, n => n.type === 'li').map(text)

test('first display is local, with role-relevant placeholders and at most five points', () => {
  for (const role of ['athlete', 'coach']) {
    const storage = memory(), ui = mount(NytIAppen, props(storage, role)), tree = ui.render()
    assert.match(text(tree), /Nyt i appen/)
    assert.match(text(tree), /Kort om det nyeste i appen/)
    assert.deepEqual(links(tree), copy.items.filter(i => i.roles.includes(role)).map(i => i.label))
    assert.ok(links(tree).length <= 5)
    ui.render()
    assert.equal(storage.calls.length, 1)
    assert.equal(storage.calls[0][0], 'read')
  }
})

test('close persists across remount and is isolated by profile and role', () => {
  const storage = memory(), a = props(storage), ui = mount(NytIAppen, a)
  button(ui.render(), copy.close).onClick()
  assert.equal(ui.render(), null)
  assert.equal(mount(NytIAppen, a).render(), null)
  assert.equal(storage.values.get(nytStorageKey('athlete', a.profileId)), 'closed')
  assert.match(text(ui.render(props(storage, 'athlete', 'synthetic-B'))), /Nyt i appen/)
  assert.match(text(ui.render(props(storage, 'coach', a.profileId))), /Nyt i appen/)
  assert.equal(ui.render(a), null)
})

test('athlete links invoke actual navigation handlers for every item', () => {
  const state = {}, go = nytAthleteNavigation({
    setTab: value => { state.tab = value }, setMsgTrack: value => { state.track = value },
    setMobilityMode: value => { state.mode = value },
  })
  const ui = mount(NytIAppen, { ...props(memory()), onNavigate: go })
  const expected = { mobilitet: ['mobilisering', 'fokus'], tidsmarkeringer: ['beskeder', 'teknik'], fremgang: ['fremgang'] }
  for (const item of copy.items.filter(i => i.roles.includes('athlete'))) {
    button(ui.render(), item.label).onClick()
    assert.equal(state.tab, expected[item.id][0])
    if (item.id === 'mobilitet') assert.equal(state.mode, expected[item.id][1])
    if (item.id === 'tidsmarkeringer') assert.equal(state.track, expected[item.id][1])
  }
})

test('coach links select an explicit athlete and open the correct existing screen', () => {
  const a = { id: 'synthetic-A', name: 'Atlet A' }, b = { id: 'synthetic-B', name: 'Atlet B' }
  const state = {}, onNavigate = nytCoachNavigation({
    setView: v => { state.view = v }, setSelectedAthlete: v => { state.selected = v },
    openProfile: (athlete, tab) => { state.athlete = athlete; state.tab = tab },
  })
  const ui = mount(NytIAppen, { ...props(memory(), 'coach'), athletes: [a, b], onNavigate })
  for (const id of ['analyse', 'tidsmarkeringer', 'fremgang']) {
    button(ui.render(), copy.items.find(i => i.id === id).label).onClick()
    assert.match(text(ui.render()), /Vælg atlet/)
    button(ui.render(), b.name).onClick()
    assert.equal(state.athlete, b)
    assert.equal(state.tab, id === 'fremgang' ? 'oversigt' : 'analyse')
    assert.doesNotMatch(text(ui.render()), /Vælg atlet/)
  }
  button(ui.render(), copy.items.find(i => i.id === 'oprydning').label).onClick()
  assert.equal(state.view, 'inbox')
  assert.equal(state.selected, null)
})

