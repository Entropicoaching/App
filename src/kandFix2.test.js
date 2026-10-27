import test from 'node:test'
import assert from 'node:assert/strict'
import { assertNoteDependencies, assertPureGraph } from './coachNoteDependencyGuard.mjs'
import { app, source, nodes, text } from './coachNoteTestHelpers.mjs'

const root = 'src/coachNoteSignal.js'
function mutateGraph(leaf) {
  const files = {
    [root]: source(root) + "\nimport './kandFix2Bridge.mjs'\n",
    'src/kandFix2Bridge.mjs': "export * from './kandFix2Leaf.mjs'\n",
    'src/kandFix2Leaf.mjs': leaf,
  }
  return path => Object.hasOwn(files, path) ? files[path] : source(path)
}

test('netmutation: transitive import og reexport afviser host, fetch og skjult URL-kald', () => {
  for (const leaf of [
    "import 'node:https'",
    "import { supabase } from './supabase.js'",
    "export const call = () => fetch('https://synthetic.invalid')",
    "export const url = 'https://synthetic.invalid'; fetch(url)",
    "export const call = () => globalThis['fetch']('synthetic')",
    "export const call = () => f\\u0065tch('synthetic')",
    "export const call = () => import('./supabase.js')",
  ]) assert.throws(() => assertNoteDependencies(mutateGraph(leaf)), /(?:Impure|Unapproved) synthetic dependency/)
})

test('storagemutation: transitive storage afvises, selv naar modulet allerede er harnessgodkendt', () => {
  for (const leaf of [
    "export const read = () => localStorage.getItem('synthetic')",
    "export const read = () => sessionStorage.getItem('synthetic')",
    "export const open = () => indexedDB.open('synthetic')",
    "export const open = () => caches.open('synthetic')",
    "import 'node:fs'",
    "import './dashboard/indbakkeHandlinger.js'",
  ]) assert.throws(() => assertNoteDependencies(mutateGraph(leaf)), /(?:Impure|Unapproved) synthetic dependency/)
})

test('positiv ny purekomponent: faktisk JSX-import, transitivt modul og klik uden navneliste', async () => {
  const load = await app()
  const { default: Component } = await load('src/dashboard/kandFix2PureFixture.jsx')
  const selected = []
  const tree = Component({ select: value => selected.push(value) })
  assert.equal(text(tree), 'Ren komponent')
  nodes(tree).find(node => node.type === 'button').props.onClick()
  assert.deepEqual(selected, ['Ren komponent'])
  assertNoteDependencies(mutateGraph("export const value = 7"))
})

test('ukendte uafhaengige moduler skal ogsaa vaere rene, kan ikke slippe via fakes eller basenavn', async () => {
  for (const code of ["import './supabase.js'", "export const read = () => localStorage.getItem('x')"]) {
    assert.throws(() => assertPureGraph('src/probe.mjs', path => path === 'src/probe.mjs' ? code : source(path)), /(?:Impure|Unapproved) synthetic dependency/)
  }
  const load = await app()
  for (const path of ['node:fs', 'https://synthetic.invalid/x.js', 'src/../outside.js', 'src/fake/coachPriority.js']) {
    assert.throws(() => load(path), /Unapproved synthetic dependency/)
  }
})

test('kaeden kontrolleres paa ny og uafhaengigt af linjeslut, cykler terminerer', () => {
  for (const newline of ['\n', '\r\n']) {
    const read = path => source(path).replace(/\r?\n/g, newline)
    assertNoteDependencies(read)
    const bad = mutateGraph("export const read = () => localStorage.getItem('x')")
    assert.throws(() => assertNoteDependencies(path => bad(path).replace(/\r?\n/g, newline)), /Impure/)
  }
  assertNoteDependencies(mutateGraph("export * from './coachNoteSignal.js'"))
})

test('kombinerede flag: samme atletlaesning leverer baade bloklogs og fireugersstatus', async () => {
  for (const fail of [false, true]) {
    let calls = 0, result
    const row = { id: 'synthetic', athlete_id: 'a' }
    const backend = { from(table) {
      assert.equal(table, 'exercise_logs')
      const query = { select() { return this }, eq(key, id) { assert.equal(key, 'athlete_id'); assert.equal(id, 'a'); return this },
        order() { return this }, async range(from) { calls++; return fail ? { error: Error('syntetisk fejl'), data: null } : { data: from === 0 ? [row] : [], error: null } } }
      return query
    } }
    const load = await app({ backend })
    const { lavLaesninger } = await load('src/dashboard/laesninger.js')
    const events = []
    await lavLaesninger({ blokFremgang: true, fourWeekCapture: event => events.push(event),
      setAthleteLogs: rows => { result = rows } }).fetchAthleteLogs('a')
    assert.deepEqual(result, fail ? [] : [row])
    assert.equal(calls, fail ? 1 : 2)
    assert.deepEqual(events.map(event => [event.athleteId, event.kind, event.status]),
      [['a', 'logs', 'loading'], ['a', 'logs', fail ? 'error' : 'ready']])
    assert.equal(events[0].token, events[1].token)
  }
})
