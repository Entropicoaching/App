import test from 'node:test'
import assert from 'node:assert/strict'
import { mountExistingTracker } from './trackerAdapter.mjs'
import { syntheticHost, find, flush } from '../../nutrition/synthetic-dom.mjs'
import { athleteId, date } from './day.fixture.mjs'

function setup(contracts = {}) {
  const host = syntheticHost(), calls = [], writes = []
  const options = { enabled: true, athlete: { id: athleteId, kcal_target: 2000, protein_target: 140 }, date,
    contracts: { async load(id, day) { calls.push(['load', id, day]); return [] },
      async save(row) { calls.push(['save', row]); return true }, ...contracts },
    storage: { getItem() { return null }, setItem(key) { writes.push(key) } } }
  return { host, calls, writes, options }
}

test('tracker adapter OFF never reads or touches host, contracts or storage', () => {
  const poison = new Proxy({}, { get() { throw Error('OFF read') } })
  for (const enabled of [false, undefined, 1, 'true']) mountExistingTracker(poison, { enabled, athlete: poison, contracts: poison, storage: poison })()
})

test('actual existing tracker mounts, manual log uses existing controller.log and scoped injected save, cleanup disposes', async t => {
  const f = setup(), cleanup = mountExistingTracker(f.host, f.options); t.after(cleanup)
  await flush(); assert.deepEqual(f.calls, [['load', athleteId, date]])
  assert.ok(find(f.host, 'h2', 'Log hurtigt')); assert.ok(find(f.host, 'h2', 'Din vægt'))
  assert.match(f.host.textContent, /Ingen måltider registreret i dag/)
  const save = find(f.host, 'button', 'Gem måltid'), form = save.parentElement
  const fields = form.querySelectorAll('input')
  for (const [index, value] of ['Ekstra mad', '250', '10', '30', '5'].entries()) {
    fields[index].value = value; await fields[index].fire('input')
  }
  await form.fire('submit')
  assert.deepEqual(f.calls[1], ['save', { athlete_id: athleteId, date, meal: 'Ekstra mad', kcal: 250, protein: 10, carb: 30, fat: 5 }])
  assert.match(f.host.textContent, /Måltid gemt/); assert.deepEqual(f.writes, [])
  cleanup(); assert.equal(f.host.textContent, '')
  await form.fire('submit'); assert.equal(f.calls.length, 2)
})

test('actual existing tracker shows read failure/retry and failed log without invented diary entry', async t => {
  let failRead = true, saves = 0
  const f = setup({ async load() { if (failRead) throw Error('synthetic'); return [] }, async save() { saves++; return false } })
  const cleanup = mountExistingTracker(f.host, f.options); t.after(cleanup); await flush()
  assert.ok(find(f.host, 'button', 'Hent kostloggen igen'))
  assert.equal(find(f.host, 'button', 'Gem måltid'), undefined)
  failRead = false; await find(f.host, 'button', 'Hent kostloggen igen').fire('click')
  const form = find(f.host, 'button', 'Gem måltid').parentElement
  for (const [index, value] of ['Fejlmad', '100', '0', '0', '0'].entries()) {
    const input = form.querySelectorAll('input')[index]; input.value = value; await input.fire('input')
  }
  await form.fire('submit'); assert.equal(saves, 1)
  assert.match(f.host.textContent, /Måltidet blev ikke gemt/)
  assert.match(f.host.textContent, /Ingen måltider registreret i dag/)
})
