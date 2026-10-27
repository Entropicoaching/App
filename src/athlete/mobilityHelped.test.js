import test from 'node:test'
import assert from 'node:assert/strict'
import { install, moduleURL } from './mob4Loader.mjs'
import { mount, text, nodes, button } from './mob4Dom.mjs'
install(process.argv.includes('--crlf') ? '\r\n' : '\n')
const { MobilityHelped, MobilityHelpedProfile, readHelped, toggleHelped, DEFAULT_MOBILITY_HELPED } = await import(moduleURL('mobilityHelped.mjs'))
const { default: MobiliseringTab } = await import('./MobiliseringTab.jsx')
const { default: MobilitetFokus } = await import('./MobilitetFokus.jsx')
const { default: ProfilHoved } = await import(moduleURL('ProfilHoved.jsx'))
const { WARMUP_BASE } = await import('./mobilityCatalog.mjs')
function memory() {
  const data = new Map()
  return { data, reads: 0, writes: 0, getItem(k) { this.reads++; return data.get(k) ?? null }, setItem(k, v) { this.writes++; data.set(k, v) } }
}
const ex = { id: 'sq-mob-1', name: 'Hoftecirkler' }
const date = '2026-10-27'
test('strict default OFF has no DOM or storage effects', () => {
  assert.equal(DEFAULT_MOBILITY_HELPED, false)
  const storage = memory()
  for (const enabled of [undefined, false, 'true', 1]) {
    assert.equal(mount(MobilityHelped, { enabled, athleteId: 'a', date, exercises: [ex], storage }).render(), null)
    assert.equal(mount(MobilityHelpedProfile, { enabled, athleteId: 'a', storage }).render(), null)
  }
  assert.equal(storage.reads + storage.writes, 0)
})
test('real click persists, survives remount, toggles off and appears in local coach panel', () => {
  const storage = memory()
  const props = { enabled: true, athleteId: 'a', date, exercises: [ex], storage }
  const view = mount(MobilityHelped, props)
  let tree = view.render()
  assert.match(text(tree), /Ikke sendt til coach/)
  button(tree, 'Hjalp: Hoftecirkler').props.onClick()
  assert.equal(button(view.render(), 'Hjalp: Hoftecirkler').props['aria-pressed'], true)
  assert.equal(button(mount(MobilityHelped, props).render(), 'Hjalp: Hoftecirkler').props['aria-pressed'], true)
  const coach = mount(MobilityHelpedProfile, { enabled: true, athleteId: 'a', storage })
  assert.match(text(coach.render()), /2026-10-27: Hoftecirkler/)
  button(view.render(), 'Hjalp: Hoftecirkler').props.onClick()
  button(coach.render(), 'Genindlæs lokale markeringer').props.onClick()
  assert.match(text(coach.render()), /Ingen lokale markeringer tilgængelige/)
})
test('athlete and date changes cannot reuse another selection or profile', () => {
  const storage = memory()
  toggleHelped('a', ex, date, storage)
  const view = mount(MobilityHelped, {})
  const props = { enabled: true, athleteId: 'a', date, exercises: [ex], storage }
  assert.equal(button(view.render(props), 'Hjalp: Hoftecirkler').props['aria-pressed'], true)
  for (const change of [{ athleteId: 'b' }, { date: '2026-10-28' }])
    assert.equal(button(view.render({ ...props, ...change }), 'Hjalp: Hoftecirkler').props['aria-pressed'], false)
  const coach = mount(MobilityHelpedProfile, { enabled: true, athleteId: 'a', storage })
  assert.match(text(coach.render()), /Hoftecirkler/)
  assert.doesNotMatch(text(coach.render({ enabled: true, athleteId: 'b', storage })), /Hoftecirkler/)
  assert.doesNotMatch(text(mount(MobilityHelpedProfile, { enabled: true, athleteId: 'a', storage: memory() }).render()), /Hoftecirkler/)
})
test('read and write failures stay visible and never claim a saved selection', () => {
  const storage = memory()
  storage.setItem = () => { throw Error('quota') }
  const view = mount(MobilityHelped, { enabled: true, athleteId: 'a', date, exercises: [ex], storage })
  button(view.render(), 'Hjalp: Hoftecirkler').props.onClick()
  assert.match(text(view.render()), /kunne ikke gemmes/)
  assert.equal(button(view.render(), 'Hjalp: Hoftecirkler').props['aria-pressed'], false)
  const broken = { getItem() { throw Error('blocked') } }
  assert.match(readHelped('a', broken).error, /kunne ikke læses/)
})
test('corrupt, foreign, duplicate and oversized rows cannot be overwritten', () => {
  for (const value of ['{', JSON.stringify({ version: 1, athleteId: 'b', rows: [] }),
    JSON.stringify({ version: 1, athleteId: 'a', rows: [{ ...ex, date }, { ...ex, date }] }),
    JSON.stringify({ version: 1, athleteId: 'a', rows: [{ ...ex, date: '2026-02-30' }] }), 'x'.repeat(100001)]) {
    const storage = { getItem: () => value, setItem() { assert.fail('corrupt data overwritten') } }
    assert.ok(toggleHelped('a', ex, date, storage).error)
  }
})
test('same day updates preserve other exercises and bound retention to 100', () => {
  const storage = memory()
  for (let i = 0; i < 105; i++) assert.equal(toggleHelped('a', { id: String(i), name: 'Øvelse ' + i }, date, storage).error, null)
  const result = readHelped('a', storage)
  assert.equal(result.rows.length, 100)
  assert.equal(result.rows[0].id, '104')
  assert.equal(result.rows.at(-1).id, '5')
})
const noop = () => {}
const baseProps = { currentWeek: null, mobilityMode: null, warmupTemplates: [], warmupProblems: [], warmupExercises: [], warmupChoice: {},
  setMobilityMode: noop, setTab: noop, mobilitetHjalp: true, athleteId: 'a', mobilityDate: date }
test('actual legacy mobility completion handler exposes chosen exercises only after completion', () => {
  globalThis.localStorage = memory()
  let phase = 'guide'
  const props = { ...baseProps, mobilityMode: 'mobilitet', mobilityPhase: phase, mobilitySlots: [{ area: 'ankel', choiceIdx: 1 }], mobilityStep: 0,
    setMobilityPhase: value => { phase = value }, setTimerActive: noop, setTimerDone: noop, setTimerSeconds: noop }
  const view = mount(MobiliseringTab, props)
  let tree = view.render()
  assert.equal(nodes(tree, n => n.props['aria-label'] === 'Hvad hjalp efter passet?').length, 0)
  const next = nodes(tree, n => n.type === 'button' && text(n) === 'Afslut ✓')
  assert.equal(next.length, 1)
  next[0].props.onClick()
  assert.equal(phase, 'done')
  tree = view.render({ ...props, mobilityPhase: phase })
  button(tree, 'Hjalp: Knælende lægstræk').props.onClick()
  assert.equal(readHelped('a').rows[0].id, 'mob-ankel-2')
  assert.equal(nodes(tree, n => n.props['aria-pressed'] !== undefined).length, 1)
  assert.doesNotMatch(text(view.render({ ...props, mobilityPhase: 'done', mobilitetHjalp: false })), /Hjalp:/)
})
test('actual warmup completion uses the selected option', () => {
  globalThis.localStorage = memory()
  const slots = WARMUP_BASE.Squat.slice(0, 1)
  const tree = mount(MobiliseringTab, { ...baseProps, mobilityMode: 'opvarmning', warmupPhase: 'done', warmupFocus: 'Squat', warmupExercises: slots, warmupChoice: { 0: 1 } }).render()
  button(tree, 'Hjalp: ' + slots[0].options[1].name).props.onClick()
  assert.equal(readHelped('a').rows[0].id, slots[0].options[1].id)
})
test('actual focus routine completion and actual coach profile show the local mark', () => {
  globalThis.localStorage = memory()
  const view = mount(MobiliseringTab, { ...baseProps, mobilitetFokus: true, mobilityMode: 'fokus' })
  button(view.render(), 'Start min rutine').props.onClick()
  for (let i = 0; i < 2; i++) button(view.render(), 'Næste øvelse').props.onClick()
  button(view.render(), 'Afslut rutinen').props.onClick()
  const choices = nodes(view.render(), n => n.type === 'button' && text(n).startsWith('Hjalp:'))
  assert.equal(choices.length, 3)
  choices[0].props.onClick()
  const profile = mount(ProfilHoved, { mobilitetHjalp: true, a: { id: 'a', name: 'Testatlet', status: 'active' }, profilesLastSeen: {}, unreadCounts: {} })
  assert.match(text(profile.render()), new RegExp(readHelped('a').rows[0].name))
  assert.match(text(profile.render()), /Modtagelse hos coach: ukendt/)
})
