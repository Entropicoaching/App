import test from 'node:test'
import assert from 'node:assert/strict'
import { createNutritionController } from './controller.mjs'
import { nutritionContracts } from './contracts.mjs'
import { mountNutrition } from './view.mjs'
import { syntheticHost, find, flush } from './synthetic-dom.mjs'

const meal = { meal: 'Synthetic meal', kcal: 300, protein: 20, carb: 40, fat: 8 }
const row = { ...meal, id: 'meal-1', athlete_id: 'synthetic', date: '2026-11-03' }
const next = { ...meal, meal: 'Synthetic revised', kcal: 450, protein: 30 }
function fixture(options = {}) {
  const calls = [], contracts = {
    load: async () => [row], save: async () => true,
    update: async value => { calls.push(['update', value]); return true },
    remove: async value => { calls.push(['remove', value]); return true }, ...options,
  }
  const c = createNutritionController({ enabled: true, athlete: { id: 'synthetic', kcal_target: 2000, protein_target: 100 },
    date: row.date, contracts })
  return { c, calls, contracts }
}
async function mount(t, options) {
  const f = fixture(options), host = syntheticHost(), cleanup = mountNutrition(host, f.c, { clock: () => new Date(row.date + 'T12:00:00+01:00') })
  t.after(cleanup); await flush(); return { ...f, host }
}
const edit = host => find(host, 'button', 'Ret måltid: ' + meal.meal)
const remove = host => find(host, 'button', 'Fjern måltid: ' + meal.meal)
const editor = host => host.querySelectorAll('form').find(n => n.getAttribute('aria-label')?.startsWith('Ret måltid:'))
async function fill(host, values = next) {
  const inputs = editor(host).querySelectorAll('input')
  for (const [i, key] of ['meal', 'kcal', 'protein', 'carb', 'fat'].entries()) {
    inputs[i].value = String(values[key]); await inputs[i].fire('input')
  }
}

test('meal actions: optional contracts hide each action independently; only today and canonical unique IDs', async t => {
  for (const [update, removeContract] of [[undefined, undefined], [async () => true, undefined], [undefined, async () => true]]) {
    const { host } = await mount(t, { update, remove: removeContract })
    assert.equal(!!edit(host), !!update); assert.equal(!!remove(host), !!removeContract)
  }
  for (const rows of [[{ ...row, id: undefined }], [{ ...row, id: 'local:fake' }], [row, row], [{ ...row, date: '2026-11-02' }], [{ ...row, meal: '[appData2-day-v1]receipt' }]]) {
    const { host } = await mount(t, { load: async () => rows })
    assert.equal(edit(host), undefined); assert.equal(remove(host), undefined)
  }
})

test('meal actions: confirmation declined makes no write; stale confirmation cannot commit', async t => {
  const { host, c, calls } = await mount(t)
  await remove(host).fire('click')
  const yes = find(host, 'button', 'Ja, fjern måltid')
  assert.ok(yes); assert.equal(calls.length, 0)
  assert.equal(await c.remove(row.id, 'not-confirmed'), false)
  await find(host, 'button', 'Behold måltid').fire('click')
  await yes.fire('click')
  assert.deepEqual(calls, []); assert.deepEqual(c.snapshot().logs, [row])
})

test('meal actions: DOM edit and remove update totals, remaining, history', async t => {
  const { c, host, calls } = await mount(t)
  await edit(host).fire('click'); await fill(host)
  await editor(host).fire('submit')
  assert.deepEqual(c.snapshot().totals, { kcal: 450, protein: 30, carb: 40, fat: 8 })
  assert.ok(host.textContent.includes('Tilbage i dag: 1.550 kcal · 70 g protein'))
  assert.equal(c.snapshot().historyRows[0].meal, next.meal)
  assert.equal(calls[0][1].id, row.id)
  await find(host, 'button', 'Fjern måltid: ' + next.meal).fire('click')
  await find(host, 'button', 'Ja, fjern måltid').fire('click')
  assert.deepEqual(c.snapshot().logs, []); assert.deepEqual(c.snapshot().historyRows, [])
  assert.deepEqual(c.snapshot().totals, { kcal: 0, protein: 0, carb: 0, fat: 0 })
  assert.ok(host.textContent.includes('Tilbage i dag: 2.000 kcal · 100 g protein'))
  assert.deepEqual(calls[1], ['remove', { id: row.id, athlete_id: row.athlete_id, date: row.date }])
})

for (const kind of ['update', 'remove']) {
  test('meal actions: ' + kind + ' no optimistic totals, blocks all writes/load and deduplicates success', async () => {
    let resolve, count = 0
    const gate = new Promise(r => { resolve = r })
    const { c } = fixture({ [kind]: () => { count++; return gate } }); await c.load()
    const act = intent => kind === 'update' ? c.update(row.id, next, intent) : c.remove(row.id, intent, true)
    const before = c.snapshot(), pending = act('same')
    assert.equal(await act('same'), false); assert.equal(await act('other'), false)
    assert.equal(await c.log(meal, 'log'), false); assert.equal(await c.load(), false)
    assert.deepEqual(c.snapshot().logs, before.logs); assert.deepEqual(c.snapshot().totals, before.totals)
    resolve(true); assert.equal(await pending, true)
    assert.equal(await act('same'), false); assert.equal(count, 1); c.dispose()
  })
  test('meal actions: ' + kind + ' failures retain diary and allow retry, disposal isolates late success', async () => {
    for (const result of [false, undefined, { ok: true }, new Error('synthetic')]) {
      let ok = false
      const { c } = fixture({ [kind]: async () => { if (ok) return true; if (result instanceof Error) throw result; return result } })
      await c.load(); const before = c.snapshot()
      const act = () => kind === 'update' ? c.update(row.id, next, 'retry') : c.remove(row.id, 'retry', true)
      assert.equal(await act(), false); assert.deepEqual(c.snapshot().logs, before.logs)
      assert.deepEqual(c.snapshot().historyRows, before.historyRows); assert.deepEqual(c.snapshot().totals, before.totals)
      ok = true; assert.equal(await act(), true); c.dispose()
    }
    let resolve
    const { c } = fixture({ [kind]: () => new Promise(r => { resolve = r }) }); await c.load()
    const pending = kind === 'update' ? c.update(row.id, next, 'late') : c.remove(row.id, 'late', true)
    c.dispose(); resolve(true); assert.equal(await pending, false); assert.deepEqual(c.snapshot().logs, [])
  })
}

test('meal actions: same log validation for updates, immutable scope and no invalid target writes', async () => {
  const { c, calls } = fixture(); await c.load()
  for (const invalid of [{ ...next, meal: ' ' }, { ...next, meal: ' [appData2-day-v1]receipt' },
    ...['kcal', 'protein', 'carb', 'fat'].flatMap(key => [null, undefined, '', -1, Infinity, 'bad'].map(value => ({ ...next, [key]: value })))]) {
    assert.equal(await c.update(row.id, invalid, 'validation'), false)
  }
  assert.equal(await c.update('missing', next, 'bad-id'), false)
  assert.equal(await c.remove('missing', 'bad-id', true), false)
  assert.deepEqual(calls, [])
  assert.equal(await c.update(row.id, { ...next, athlete_id: 'other', date: '2020-01-01', id: 'other', kcal: '0', protein: '1,5' }, 'valid'), true)
  assert.deepEqual(calls[0][1], { id: row.id, athlete_id: row.athlete_id, date: row.date, ...next, kcal: 0, protein: 1.5 })
  c.dispose()
})

test('meal actions: failed DOM edit retains draft/focus and failed confirmation remains retryable', async t => {
  let ok = false
  const { host, c } = await mount(t, { update: async () => ok, remove: async () => ok })
  await edit(host).fire('click'); await fill(host)
  find(host, 'button', 'Gem ændring').focus()
  await editor(host).fire('submit')
  assert.equal(editor(host).querySelectorAll('input')[0].value, next.meal)
  assert.equal(host.ownerDocument.activeElement.textContent, 'Gem ændring')
  assert.deepEqual(c.snapshot().logs, [row])
  await find(host, 'button', 'Annuller rettelse').fire('click')
  await remove(host).fire('click'); await find(host, 'button', 'Ja, fjern måltid').fire('click')
  assert.ok(find(host, 'button', 'Behold måltid')); assert.deepEqual(c.snapshot().logs, [row])
  ok = true; await find(host, 'button', 'Ja, fjern måltid').fire('click')
  assert.deepEqual(c.snapshot().logs, [])
})

test('meal actions: new logs resolve database identity, never send synthetic local IDs', async () => {
  let loads = 0
  const { c } = fixture({ load: async () => ++loads === 1 ? [] : [row] })
  await c.load(); assert.equal(await c.log(meal, 'new-log'), true)
  assert.deepEqual(c.snapshot().editableIds, [row.id]); assert.equal(await c.update(row.id, next, 'edit-new'), true)
  c.dispose()
  const broken = fixture({ load: async () => { if (++loads > 3) throw Error('synthetic read failure'); return [] } })
  await broken.c.load(); assert.equal(await broken.c.log(meal, 'new-log'), true)
  assert.equal(broken.c.snapshot().logs.length, 1); assert.deepEqual(broken.c.snapshot().editableIds, [])
  assert.equal(await broken.c.remove('local:new-log', 'remove-local', true), false); broken.c.dispose()
})

for (const kind of ['update', 'remove']) {
  test('meal contracts: ' + kind + ' uses guarded scoped write, requires one affected ID, strips unknown fields', async () => {
    for (const result of [{ data: [{ id: row.id }], error: null }, { data: [], error: null }, { data: [{ id: 'other' }], error: null }, { data: null, error: { message: 'synthetic denial' } }]) {
      const trace = [], errors = []
      const query = { eq(...args) { trace.push(['eq', ...args]); return this }, async select(...args) { trace.push(['select', ...args]); return result } }
      const client = { from(table) { trace.push(['from', table]); return {
        update(value) { trace.push(['update', value]); return query }, delete() { trace.push(['delete']); return query },
      } } }
      const contracts = nutritionContracts({ client, onWriteError: e => errors.push(e) })
      const expected = !!result.data?.length && result.data[0].id === row.id && !result.error
      assert.equal(await contracts[kind]({ ...row, ...next, unknown: 'ignored' }), expected)
      assert.deepEqual(trace.filter(t => t[0] === 'eq'), [['eq', 'id', row.id], ['eq', 'athlete_id', row.athlete_id], ['eq', 'date', row.date]])
      if (kind === 'update') assert.deepEqual(trace.find(t => t[0] === 'update')[1], next)
      assert.equal(errors.length, result.error ? 1 : 0)
      const before = trace.length
      assert.equal(await contracts[kind]({ ...row, id: 'local:fake' }), false)
      assert.equal(trace.length, before)
    }
  })
}
