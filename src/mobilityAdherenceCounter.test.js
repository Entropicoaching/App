import test from 'node:test'
import assert from 'node:assert/strict'
import { install, allowedImport, memory, mount, button, text } from './mob7Synthetic.mjs'
install()
const { readDone, toggleDone, HomeworkExerciseProgress, MobilityAdherenceProfile } = await import('./mobilityAdherence.mjs')
const ex = { id: 'sq-mob-1', name: 'Syntetisk hofte' }, day = '2026-10-29', clock = () => new Date(2026, 9, 29, 12)

test('counter: reject corrupt, foreign, duplicate and oversized storage without overwriting', () => {
  for (const data of [{ version: 1, athleteId: 'b', rows: [] }, { version: 2, athleteId: 'a', rows: [] },
    { version: 1, athleteId: 'a', rows: [{ ...ex, date: '2026-02-30' }] },
    { version: 1, athleteId: 'a', rows: [{ ...ex, date: day }, { ...ex, date: day }] },
    { version: 1, athleteId: 'a', rows: Array(401).fill({ ...ex, date: day }) }, 'x'.repeat(200001)]) {
    let raw = JSON.stringify(data), writes = 0
    const storage = { getItem: () => raw, setItem() { writes++ } }
    assert.ok(readDone('a', storage).error); assert.ok(toggleDone('a', ex, day, storage).error); assert.equal(writes, 0)
    const tree = mount(MobilityAdherenceProfile, { enabled: true, athleteId: 'a', storage, clock }).render()
    assert.match(text(tree), /kunne ikke læses/); assert.doesNotMatch(text(tree), /0 af 14 dage/)
  }
})

test('counter: failed write never claims saved and previous rows remain intact', () => {
  const store = memory(); toggleDone('a', ex, '2026-10-28', store)
  const before = [...store.data], storage = { getItem: store.getItem, setItem() { throw Error('quota') } }
  const view = mount(HomeworkExerciseProgress, { enabled: true, athleteId: 'a', exercise: ex, storage, clock })
  button(view.render(), `Lavet i dag: ${ex.name}`).props.onClick()
  assert.match(text(view.render()), /kunne ikke gemmes/)
  assert.equal(button(view.render(), `Lavet i dag: ${ex.name}`).props['aria-pressed'], false)
  assert.deepEqual([...store.data], before)
  view.unmount()
})

test('counter: athlete and exercise remounts do not leak pressed state', () => {
  const storage = memory(), props = { enabled: true, athleteId: 'a', exercise: ex, storage, clock }
  const view = mount(HomeworkExerciseProgress, props)
  button(view.render(), `Lavet i dag: ${ex.name}`).props.onClick()
  assert.equal(button(view.render({ ...props, athleteId: 'b' }), `Lavet i dag: ${ex.name}`).props['aria-pressed'], false)
  assert.equal(readDone('a', storage).rows.length, 1); assert.equal(readDone('b', storage).rows.length, 0)
  const other = { id: 'other', name: 'Anden' }
  assert.equal(button(view.render({ ...props, exercise: other }), 'Lavet i dag: Anden').props['aria-pressed'], false)
  view.unmount()
})

test('counter: validation rejects bad input and read failures without writes', () => {
  const storage = memory()
  for (const [id, exercise, date] of [['', ex, day], ['a', {}, day], ['a', ex, '2026-02-30'], ['a', null, day]]) assert.ok(toggleDone(id, exercise, date, storage).error)
  assert.equal(storage.data.size, 0)
  const failed = { getItem() { throw Error('denied') }, setItem() { assert.fail('write after failed read') } }
  assert.ok(toggleDone('a', ex, day, failed).error)
  assert.equal(mount(HomeworkExerciseProgress, { enabled: true, athleteId: 'a', exercise: null, storage }).render(), null)
})

test('counter: synthetic import boundary denies FS, backend, network and nested unexpected dependencies', () => {
  for (const path of ['./mobilityAdherence.mjs','./mobilityHelped.mjs','./mobilityHomework.mjs','./athlete/mobilityCatalog.mjs'])
    for (const dependency of ['node:fs','node:child_process','../supabase.js','https://example.invalid/code.mjs','./unexpected.mjs'])
      assert.throws(() => allowedImport(dependency, new URL(path, import.meta.url).href), /Forbidden synthetic import/)
})
