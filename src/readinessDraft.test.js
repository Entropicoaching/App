import { test } from 'node:test'
import assert from 'node:assert/strict'
import { saveReadinessDraft, loadReadinessDraft, clearReadinessDraft, isEmptyReadinessDraft } from './readinessDraft.js'

// In-memory fake af localStorage's API-flade (getItem/setItem/removeItem) —
// nok til at teste den rene logik uden en rigtig browser.
function fakeStorage() {
  const map = new Map()
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)) },
    removeItem: (k) => { map.delete(k) },
  }
}

const INPUT = { sleep: '7.5', energy: '4', motivation: '3', stress: '2', soreness: '3', soreZones: ['lænd'] }

test('G12 — skriv, luk, genåbn: udkastet er der stadig', () => {
  const storage = fakeStorage()
  saveReadinessDraft('athlete-1', '2026-09-07', INPUT, storage)
  // "luk fanen" = intet i denne test rører storage ind imellem — "genåbn":
  const restored = loadReadinessDraft('athlete-1', '2026-09-07', storage)
  assert.deepEqual(restored, INPUT)
})

test('G12 — gem (log gemt) rydder udkastet: genåbning viser det væk', () => {
  const storage = fakeStorage()
  saveReadinessDraft('athlete-1', '2026-09-07', INPUT, storage)
  clearReadinessDraft('athlete-1', '2026-09-07', storage) // spejler AthleteView.jsx's saveReadiness efter et bekræftet insert
  const restored = loadReadinessDraft('athlete-1', '2026-09-07', storage)
  assert.equal(restored, null)
})

test('udkastet er pr. atlet og dato — en anden atlet eller en anden dag ser det ikke', () => {
  const storage = fakeStorage()
  saveReadinessDraft('athlete-1', '2026-09-07', INPUT, storage)
  assert.equal(loadReadinessDraft('athlete-2', '2026-09-07', storage), null)
  assert.equal(loadReadinessDraft('athlete-1', '2026-09-08', storage), null)
})

test('isEmptyReadinessDraft: alle felter tomme/null er tomt', () => {
  assert.equal(isEmptyReadinessDraft(null), true)
  assert.equal(isEmptyReadinessDraft({ sleep: '', energy: null, motivation: null, stress: null, soreness: null, soreZones: [] }), true)
})

test('isEmptyReadinessDraft: ét udfyldt felt gør udkastet ikke-tomt', () => {
  assert.equal(isEmptyReadinessDraft({ sleep: '', energy: '4', motivation: null, stress: null, soreness: null, soreZones: [] }), false)
  assert.equal(isEmptyReadinessDraft({ sleep: '', energy: null, motivation: null, stress: null, soreness: null, soreZones: ['skulder'] }), false)
})

test('manglende storage (fx privat vindue der kaster) vælter ikke — saveReadinessDraft returnerer false', () => {
  const throwingStorage = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') }, removeItem: () => { throw new Error('blocked') } }
  assert.equal(saveReadinessDraft('athlete-1', '2026-09-07', INPUT, throwingStorage), false)
  assert.equal(loadReadinessDraft('athlete-1', '2026-09-07', throwingStorage), null)
  assert.doesNotThrow(() => clearReadinessDraft('athlete-1', '2026-09-07', throwingStorage))
})
