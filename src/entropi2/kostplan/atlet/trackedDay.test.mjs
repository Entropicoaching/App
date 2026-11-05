import test from 'node:test'
import assert from 'node:assert/strict'
import { createTrackedAthleteDay, mountExistingTracker } from './trackerAdapter.mjs'
import { namespace } from './dayModel.mjs'
import { nutritionContracts } from '../../nutrition/contracts.mjs'
import { syntheticHost, flush } from '../../nutrition/synthetic-dom.mjs'
import { athleteId, date, source, deferred } from './day.fixture.mjs'

function fixture(options = {}) {
  let rows = [], sequence = 0
  const calls = [], writes = [], values = new Map()
  const storage = { getItem: key => values.get(key) ?? null,
    setItem(key, value) { writes.push(key); values.set(key, value) } }
  // Actual existing production contracts, with an inert in-memory query fixture.
  const contracts = nutritionContracts({ client: { from(table) {
    assert.equal(table, 'meal_logs')
    return {
      insert(row) {
        calls.push({ ...row })
        const saved = { ...row, id: 'synthetic-log-' + ++sequence }
        rows.push(saved)
        return { async select(columns) { assert.equal(columns, 'id'); return { data: [{ id: saved.id }], error: null } } }
      },
      select() {
        const q = { eq(column, value) { assert.equal(column, 'athlete_id'); assert.equal(value, athleteId); return q },
          gte() { return q }, lte(column, value) { assert.equal(column, 'date'); assert.equal(value, date); return q },
          async order() { return { data: rows.map(row => ({ ...row })), error: null } } }
        return q
      },
    }
  } } })
  const input = { enabled: true, athleteId, date, storage, contracts,
    loadPlan: async scope => { assert.deepEqual(scope, { athleteId, date }); return source().plan }, ...options }
  return { input, contracts, storage, values, calls, writes, make: extra => createTrackedAthleteDay({ ...input, ...extra }),
    rows: () => rows, setRows(next) { rows = next } }
}

test('tracked day OFF touches no contract, plan, host or storage', () => {
  const poison = new Proxy({}, { get() { throw Error('OFF read') } })
  for (const enabled of [undefined, false, null, 'true', 1])
    assert.equal(createTrackedAthleteDay({ enabled, athleteId: poison, contracts: poison, storage: poison, loadPlan: poison }), null)
})

test('actual tracker contracts: planned tap logs exact values, reload links returned ID, same diary sees it', async t => {
  const f = fixture(), m = f.make(); t.after(m.dispose)
  assert.equal(await m.load(), true); assert.deepEqual(f.calls, []); assert.deepEqual(f.writes, [])
  assert.deepEqual(m.snapshot().remaining, { kcal: 2200, protein: 140, carb: 260, fat: 70 })
  assert.equal(await m.markEaten('lunch'), true)
  assert.deepEqual(f.calls, [{ athlete_id: athleteId, date, meal: 'Frokost <test>', kcal: 420, protein: 37, carb: 58, fat: 3 }])
  assert.equal(await m.markEaten('lunch'), false)
  assert.equal(m.snapshot().remaining.kcal, 1780); assert.equal(m.snapshot().remaining.protein, 103)
  assert.equal(f.writes.length, 2)
  assert.ok(f.writes.every(key => key === `${namespace}:${encodeURIComponent(athleteId)}:${date}`))
  const again = f.make(); t.after(again.dispose); assert.equal(await again.load(), true)
  assert.equal(again.snapshot().eatenCount, 1); assert.equal(await again.markEaten('lunch'), false)
  const host = syntheticHost(), cleanup = mountExistingTracker(host, { enabled: true, athlete: { id: athleteId }, date,
    contracts: f.contracts, clock: () => new Date(date + 'T12:00:00Z') }); t.after(cleanup)
  await flush(); assert.match(host.textContent, /Frokost <test>/); assert.match(host.textContent, /420/)
  assert.equal(f.calls.length, 1)
})

test('adjusted grams, ordinary logs, old dates and day receipts contribute only real current intake', async () => {
  const f = fixture(), m = f.make()
  f.setRows([{ id: 'extra', athlete_id: athleteId, date, meal: 'Ekstra', kcal: 100, protein: 10, carb: 5, fat: 0 },
    { id: 'old', athlete_id: athleteId, date: '2026-11-03', meal: 'I går', kcal: 999, protein: 99, carb: 0, fat: 0 },
    { id: 'receipt', athlete_id: athleteId, date, meal: '[appData2-day-v1]receipt', kcal: 9999 }])
  await m.load(); m.setGrams('lunch', 'rice', '125,5')
  assert.equal(m.snapshot().meals[0].adjusted, true)
  assert.equal(await m.markEaten('lunch'), true)
  assert.deepEqual(f.calls[0], { athlete_id: athleteId, date, meal: 'Frokost <test>', kcal: 323, protein: 35, carb: 37, fat: 3 })
  const again = f.make(); await again.load()
  assert.equal(again.snapshot().totals.kcal, 423); assert.equal(again.snapshot().remaining.protein, 95)
  assert.equal(again.snapshot().meals[0].foods[0].grams, 125.5)
  assert.equal(f.calls.length, 1); m.dispose(); again.dispose()
})

test('missing plan leaves existing tracker mode and never reads receipts or log contracts', async () => {
  const poison = new Proxy({}, { get() { throw Error('unexpected read') } })
  const m = createTrackedAthleteDay({ enabled: true, athleteId, date,
    contracts: { load: poison, saveWithIdentity: async () => { throw Error('write') } },
    storage: { getItem() { throw Error('receipt read') }, setItem() { throw Error('write') } } })
  assert.equal(await m.load(), true); assert.equal(m.snapshot().mode, 'tracker')
  assert.equal(await m.markEaten('lunch'), false); m.dispose()
})

test('no identity-saving contract or local receipt storage keeps planned logging unavailable', async () => {
  const f = fixture()
  for (const extra of [{ storage: undefined }, { contracts: { load: f.contracts.load, save: async () => true } }]) {
    const m = f.make(extra); await m.load()
    assert.equal(m.snapshot().canSave, false); assert.equal(await m.markEaten('lunch'), false); m.dispose()
  }
  assert.equal(f.calls.length, 0)
})

test('failed or silently dropped reservation never inserts; a storage retry is safe', async () => {
  for (const setItem of [() => { throw Error('quota') }, () => {}]) {
    const f = fixture(), m = f.make({ storage: { getItem: () => null, setItem } })
    await m.load(); assert.equal(await m.markEaten('lunch'), false)
    assert.equal(m.snapshot().phase, 'save-error'); assert.equal(f.calls.length, 0); m.dispose()
  }
})

test('lost insert response blocks replay across reload; explicit absence acknowledgement only unlocks', async () => {
  const f = fixture(), contracts = { ...f.contracts, async saveWithIdentity(row) {
    await f.contracts.saveWithIdentity(row); throw Error('lost synthetic response')
  } }, m = f.make({ contracts })
  await m.load(); assert.equal(await m.markEaten('lunch'), false)
  assert.equal(m.snapshot().phase, 'uncertain'); assert.equal(m.snapshot().totals.kcal, 0)
  assert.equal(await m.markEaten('lunch'), false)
  const again = f.make(); await again.load()
  assert.equal(again.snapshot().meals[0].blocked, true)
  // The existing log is counted, but never guessed to be a particular plan meal.
  assert.equal(again.snapshot().totals.kcal, 420); assert.equal(again.snapshot().eatenCount, 0)
  assert.equal(await again.markEaten('lunch'), false); assert.equal(f.calls.length, 1)
  // Athlete first removes/checks the uncertain row in the existing diary.
  f.setRows([])
  assert.equal(await again.confirmNotLogged('lunch'), true)
  assert.equal(again.snapshot().meals[0].blocked, false); assert.equal(f.calls.length, 1)
  assert.equal(await again.markEaten('lunch'), true); assert.equal(f.calls.length, 2)
  m.dispose(); again.dispose()
})

test('missing ID or false acknowledgement is uncertain and cannot be auto-retried', async () => {
  for (const result of [{ ok: true, id: null }, { ok: false, id: null }, { ok: true, id: 'local:bad' }]) {
    const f = fixture(), m = f.make({ contracts: { ...f.contracts, saveWithIdentity: async () => result } })
    await m.load(); assert.equal(await m.markEaten('lunch'), false)
    assert.equal(m.snapshot().phase, 'uncertain'); await m.load()
    assert.equal(m.snapshot().meals[0].blocked, true); assert.equal(await m.markEaten('lunch'), false); m.dispose()
  }
})

test('receipt finalization failure never reports eaten; pending survives until deliberate checking', async () => {
  const f = fixture(); let count = 0
  const m = f.make({ storage: { getItem: f.storage.getItem, setItem(key, value) {
    if (++count === 2) throw Error('quota after insert'); f.storage.setItem(key, value)
  } } })
  await m.load(); assert.equal(await m.markEaten('lunch'), false)
  assert.equal(m.snapshot().eatenCount, 0); assert.equal(f.calls.length, 1)
  await m.load(); assert.equal(m.snapshot().totals.kcal, 420)
  assert.equal(m.snapshot().meals[0].blocked, true); m.dispose()
})

test('manual tracker edits block a stale plan receipt; only a confirmed deletion permits another log', async () => {
  const f = fixture(), m = f.make(); await m.load(); await m.markEaten('lunch')
  f.setRows(f.rows().map(row => ({ ...row, kcal: 421 })))
  await m.load(); assert.equal(m.snapshot().meals[0].blocked, true)
  assert.equal(m.snapshot().totals.kcal, 421); assert.equal(await m.confirmNotLogged('lunch'), false)
  assert.equal(f.calls.length, 1)
  f.setRows([]); await m.load(); assert.equal(m.snapshot().meals[0].canSave, true)
  assert.equal(await m.markEaten('lunch'), true); assert.equal(f.calls.length, 2); m.dispose()
})

test('same-named manual meal is never guessed to be a plan receipt; corrupt/foreign receipts fail closed', async () => {
  const f = fixture(), m = f.make()
  f.setRows([{ id: 'manual', athlete_id: athleteId, date, meal: 'Frokost <test>', kcal: 420, protein: 37, carb: 58, fat: 3 }])
  await m.load(); assert.equal(m.snapshot().eatenCount, 0); assert.equal(m.snapshot().remaining.kcal, 1780)
  await m.markEaten('lunch'); m.dispose()
  const key = [...f.values.keys()][0], good = f.values.get(key)
  for (const corrupt of ['bad JSON', JSON.stringify({ ...JSON.parse(good), athlete_id: 'other' })]) {
    f.values.set(key, corrupt); const next = f.make()
    assert.equal(await next.load(), false); assert.equal(next.snapshot().phase, 'load-error')
    assert.equal(await next.markEaten('lunch'), false); next.dispose()
  }
  assert.equal(f.calls.length, 1)
})

test('a second session sees the reservation and cannot insert the same meal while first write awaits', async () => {
  const gate = deferred(), f = fixture(), contracts = { ...f.contracts,
    async saveWithIdentity(row) { await gate.promise; return f.contracts.saveWithIdentity(row) } }
  const a = f.make({ contracts }), b = f.make({ contracts }); await a.load(); await b.load()
  const write = a.markEaten('lunch')
  assert.equal(await b.markEaten('lunch'), false); assert.equal(f.calls.length, 0)
  gate.resolve(); assert.equal(await write, true); assert.equal(f.calls.length, 1)
  await b.load(); assert.equal(b.snapshot().eatenCount, 1); a.dispose(); b.dispose()
})

test('midnight guard and disposal prevent another insert; late confirmation still retains its local receipt', async () => {
  const f = fixture(), wrongDay = f.make({ currentDay: () => '2026-11-05' }); await wrongDay.load()
  assert.equal(await wrongDay.markEaten('lunch'), false); assert.equal(f.calls.length, 0); wrongDay.dispose()
  const gate = deferred(), m = f.make({ contracts: { ...f.contracts,
    async saveWithIdentity(row) { await gate.promise; return f.contracts.saveWithIdentity(row) } } })
  await m.load(); const write = m.markEaten('lunch'); m.dispose(); gate.resolve()
  assert.equal(await write, false); assert.equal(await m.markEaten('snack'), false)
  const again = f.make(); await again.load(); assert.equal(again.snapshot().eatenCount, 1); again.dispose()
})
