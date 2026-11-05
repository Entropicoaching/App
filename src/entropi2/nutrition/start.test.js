import test from 'node:test'
import assert from 'node:assert/strict'
import { mountNutritionScreen } from './index.mjs'
import { createNutritionController } from './controller.mjs'
import { mountNutrition } from './view.mjs'
import { startAdvice, weightSummary } from './startModel.mjs'
import { syntheticHost, find, flush } from './synthetic-dom.mjs'

const date = '2026-11-02', id = 'synthetic-start'
const athlete = { id, kcal_target: '2400', protein_target: '160' }
const weight = (logged_at, value, extra = {}) => ({ athlete_id: id, logged_at, weight: value, ...extra })
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
function mount(options = {}, view = {}) {
  const host = syntheticHost()
  const controller = createNutritionController({ enabled: true, athlete, date,
    contracts: { async load() { return [] } }, ...options })
  const cleanup = mountNutrition(host, controller, { clock: () => new Date(date + 'T12:00:00+01:00'), ...(Array.isArray(view.weightLogs) ? { weightStatus: { athleteId: id, state: 'ready' } } : {}), ...view })
  return { host, controller, cleanup }
}
function goalCard(host) { return host.querySelectorAll('section').find(n => n.textContent.startsWith('Dagens mål')) }
function weightForm(host) { return find(host, 'h2', 'Din vægt').parentElement.querySelectorAll('form')[0] }

test('START: actual mount shows goals and optional general examples before any log response', async () => {
  const gate = deferred()
  const { host, cleanup } = mount({ contracts: { load: () => gate.promise } })
  const card = goalCard(host)
  assert.match(card.textContent, /2.400 kcal/); assert.match(card.textContent, /160 g/)
  assert.match(card.textContent, /40 g protein pr. måltid/); assert.match(card.textContent, /600 kcal pr. måltid/)
  assert.equal(card.querySelectorAll('li').length, 2)
  assert.equal(host.querySelectorAll('section')[0].querySelectorAll('h2')[0].textContent, 'Dagens mål')
  assert.equal(card.querySelectorAll('details')[0].open, false)
  assert.match(card.querySelectorAll('summary')[0].textContent, /Generel hjælp/)
  gate.resolve([]); await flush()
  assert.match(host.textContent, /Dagbogen er valgfri/); assert.match(host.textContent, /Ingen måltider registreret/)
  cleanup()
})

test('START: goals and coach action survive failed meal read; no nutrition writes needed', async () => {
  let coach = 0
  const { host } = mount({ contracts: { async load() { throw Error('synthetic') } } }, { onCoach: () => coach++ })
  await flush()
  assert.match(goalCard(host).textContent, /40 g protein/)
  await find(host, 'button', 'Tal med din coach').fire('click'); assert.equal(coach, 1)
  assert.ok(find(host, 'button', 'Hent kostloggen igen'))
})

test('START: missing, zero, negative and malformed targets never become zero or unknown goals', async () => {
  for (const value of [undefined, null, '', 'bad', '0', -1, Infinity, NaN]) {
    const { host, cleanup } = mount({ athlete: { id, kcal_target: value, protein_target: value } })
    await flush()
    const card = goalCard(host)
    assert.doesNotMatch(card.textContent, /Ingen mål endnu/); assert.match(card.textContent, /Aftal dine kostmål med din coach/)
    assert.doesNotMatch(card.textContent, /0 kcal|0 g|ukendt/)
    assert.equal(card.querySelectorAll('li').length, 0); cleanup()
  }
})

test('START: either partial target gives one optional example and missing-target coach advice', () => {
  for (const targets of [{ kcal_target: '2000,5' }, { protein_target: 123 }]) {
    const { host, cleanup } = mount({ athlete: { id, ...targets } })
    const card = goalCard(host)
    assert.equal(card.querySelectorAll('li').length, 1)
    assert.doesNotMatch(card.textContent, /Ingen mål endnu/); assert.match(card.textContent, /Aftal dine kostmål med din coach/)
    cleanup()
  }
  assert.match(startAdvice({ protein: '123' }).tips[0], /30,8 g/)
})

test('START: weight summary uses seven inclusive calendar days, latest daily row, own athlete only', () => {
  const rows = [weight('2026-10-26', 90), weight('2026-10-27', 80), weight(date, '82,0', { created_at: '2026-11-02T07:00:00Z' }),
    weight(date, 84, { created_at: '2026-11-02T08:00:00Z' }), weight(date, 999, { athlete_id: 'synthetic-other' }),
    weight('2026-11-03', 999), weight('2026-02-30', 999), weight(date, 0), weight(date, 'bad'), null]
  const summary = weightSummary(rows, id, date)
  assert.deepEqual(summary, { latest: { weight: 84, date }, average: 82, days: 2, previousAverage: 90, previousDays: 1, comparison: null })
  assert.deepEqual(weightSummary([weight('2026-10-26', 90)], id, date), { latest: { weight: 90, date: '2026-10-26' }, average: null, days: 0, previousAverage: 90, previousDays: 1, comparison: null })
  assert.deepEqual(weightSummary(null, id, date), { latest: null, average: null, days: 0, previousAverage: null, previousDays: 0, comparison: null })
  assert.equal(rows[2].weight, '82,0')
})

test('START: top weight form submits once with zero arguments, controlled input, no fabricated success', async () => {
  const gate = deferred(), inputs = [], args = []
  const { host, cleanup } = mount({}, { weightInput: '', onWeightInput: value => inputs.push(value),
    logWeight: (...values) => { args.push(values); return gate.promise }, weightLogs: [weight(date, 81)] })
  await flush()
  assert.match(host.textContent, /Seneste vægt: 81 kg/); assert.match(host.textContent, /Ugegennemsnit: 81 kg/)
  const input = weightForm(host).querySelectorAll('input')[0]; input.value = '82,5'; await input.fire('input')
  assert.deepEqual(inputs, ['82,5'])
  const form = weightForm(host), first = form.fire('submit'); await form.fire('submit')
  assert.deepEqual(args, [[]]); assert.equal(find(host, 'button', 'Gemmer vægt…').disabled, true)
  gate.resolve(); await first
  assert.equal(weightForm(host).querySelectorAll('input')[0].value, '82,5') // void is not proof of success
  assert.doesNotMatch(host.textContent, /Vægt gemt/)
  cleanup.updateWeight({ weightStatus: { athleteId: id, state: 'ready' }, weightInput: '', weightLogs: [weight(date, 82.5)] })
  assert.match(host.textContent, /Seneste vægt: 82,5 kg/)
  assert.equal(weightForm(host).querySelectorAll('input')[0].value, '')
  cleanup()
})

test('START: invalid input and saving prop prevent callback; thrown callback permits retry', async () => {
  let calls = 0
  const { host, cleanup } = mount({}, { weightInput: '', onWeightInput() {}, logWeight: async () => { calls++; throw Error('synthetic') } })
  await flush()
  for (const value of ['', '0', '-1', 'NaN', 'Infinity']) {
    cleanup.updateWeight({ weightInput: value }); await weightForm(host).fire('submit')
    assert.match(host.textContent, /Angiv en gyldig vægt/)
  }
  assert.equal(calls, 0)
  cleanup.updateWeight({ weightInput: '80', savingWeight: true }); await weightForm(host).fire('submit'); assert.equal(calls, 0)
  cleanup.updateWeight({ savingWeight: false }); await weightForm(host).fire('submit')
  assert.equal(calls, 1); assert.match(host.textContent, /Vægten blev ikke gemt/)
  assert.equal(weightForm(host).querySelectorAll('input')[0].value, '80')
  await weightForm(host).fire('submit'); assert.equal(calls, 2)
})

test('START: refreshed props preserve diary draft and weight completion cannot revive disposed view', async () => {
  const gate = deferred()
  const { host, cleanup } = mount({}, { weightInput: '80', onWeightInput() {}, logWeight: () => gate.promise })
  await flush()
  const details = host.querySelectorAll('details')[0]; details.open = true
  const mealInput = details.querySelectorAll('input')[0]; mealInput.value = 'Synthetic draft'; await mealInput.fire('input'); mealInput.focus()
  cleanup.updateWeight({ weightLogs: [weight(date, 80)] })
  assert.equal(host.querySelectorAll('details')[0].open, true)
  assert.equal(host.ownerDocument.activeElement.value, 'Synthetic draft')
  const pending = weightForm(host).fire('submit'); cleanup(); gate.resolve(); await pending
  cleanup.updateWeight({ weightInput: '99' }); assert.equal(host.textContent, '')
})

test('START: actual assembly passes props; callback is sole weight write seam', async () => {
  const tables = [], calls = []
  const client = { from(table) {
    tables.push(table)
    const query = { select() { return query }, eq() { return query }, gte() { return query }, lte() { return query },
      async order() { return { data: [], error: null } } }
    return query
  } }
  const host = syntheticHost()
  const cleanup = mountNutritionScreen(host, { entropi2: true, athlete, date, client, clock: () => new Date(date + 'T12:00:00+01:00'), weightLogs: [weight(date, 80)],
    weightInput: '81', onWeightInput() {}, logWeight: (...args) => { calls.push(args) } })
  await flush(); await weightForm(host).fire('submit')
  assert.deepEqual(calls, [[]]); assert.deepEqual(tables, ['meal_logs'])
  cleanup.updateWeight({ weightLogs: [], weightStatus: { athleteId: id, state: 'ready' } }); assert.match(host.textContent, /Ingen vejninger endnu/)
  cleanup()
})

test('START: OFF never reads weight data or callback and leaves host untouched', () => {
  const host = syntheticHost(); host.textContent = 'legacy'
  for (const entropi2 of [false, undefined, 'true', 1]) {
    const poison = new Proxy({}, { get() { throw Error('OFF weight read') } })
    mountNutritionScreen(host, { entropi2, weightLogs: poison, logWeight: poison })()
    assert.equal(host.textContent, 'legacy')
  }
})
