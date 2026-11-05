import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createNutritionController } from './controller.mjs'
import { mountNutrition } from './view.mjs'
import { syntheticHost, find, flush } from './synthetic-dom.mjs'

const id = 'synthetic:read-labels', date = '2026-11-05'
const deferred = () => {
  let resolve, reject
  const promise = new Promise((a, b) => { resolve = a; reject = b })
  return { promise, resolve, reject }
}
function mount(t, load, view = {}) {
  const controller = createNutritionController({ enabled: true, athlete: { id }, date,
    storage: { getItem: () => null, setItem: () => assert.fail('read must not write') },
    contracts: { load, save: () => assert.fail('read must not save') } })
  const host = syntheticHost()
  const cleanup = mountNutrition(host, controller, {
    clock: () => new Date(date + 'T12:00:00+01:00'), ...view,
  })
  t.after(cleanup)
  return { controller, host, cleanup }
}

test('diary: shared read label retries only meals; delayed responses never assert empty', async t => {
  const first = deferred(), retry = deferred()
  let meals = 0, weights = 0
  const f = mount(t, () => (++meals === 1 ? first.promise : retry.promise), {
    weightStatus: { athleteId: id, state: 'error' }, retryWeight: () => { weights++ },
  })
  assert.match(f.host.textContent, /Henter kostloggen…/)
  assert.doesNotMatch(f.host.textContent, /Ingen måltider registreret/)
  first.reject(Error('synthetic transport detail')); await flush()
  assert.equal(find(f.host, 'p', 'Kostloggen kunne ikke hentes.').getAttribute('role'), 'alert')
  assert.equal(f.host.querySelectorAll('button').filter(n => n.textContent === 'Hent igen').length, 2)
  await flush() // The error and action persist without another read.
  const button = f.host.querySelectorAll('button').find(n => n.textContent === 'Hent igen'
    && n.parentElement.getAttribute('data-kost-del') !== 'vaegt')
  const pending = button.fire('click')
  assert.equal(meals, 2); assert.equal(weights, 0)
  assert.match(f.host.textContent, /Henter kostloggen…/)
  assert.doesNotMatch(f.host.textContent, /Ingen måltider registreret/)
  retry.resolve([]); await pending
  assert.equal(f.host.querySelectorAll('li').filter(n => n.textContent === 'Ingen måltider registreret i dag.').length, 1)
  assert.equal(find(f.host, 'p', 'Kostloggen kunne ikke hentes.'), undefined)
  assert.ok(find(f.host, 'p', 'Vejningerne kunne ikke hentes.'))
})

test('weight: Henter… names the existing pending button; retry never reads meals or saves', async t => {
  const gate = deferred()
  let meals = 0, weights = 0
  const f = mount(t, async () => { meals++; return [] }, {
    weightStatus: { athleteId: id, state: 'error' },
    retryWeight: () => { weights++; return gate.promise },
  })
  await flush()
  const button = find(f.host, 'button', 'Hent igen')
  const pending = button.fire('click')
  await button.fire('click')
  const waiting = find(f.host, 'button', 'Henter…')
  assert.ok(waiting.disabled)
  assert.equal(waiting.parentElement.getAttribute('aria-busy'), 'true')
  assert.equal(meals, 1); assert.equal(weights, 1)
  f.cleanup.updateWeight({ weightStatus: { athleteId: id, state: 'loading' } })
  assert.ok(find(f.host, 'p', 'Henter vejningerne…'))
  assert.doesNotMatch(f.host.textContent, /Ingen vejninger endnu/)
  f.cleanup.updateWeight({ weightStatus: { athleteId: id, state: 'ready' }, weightLogs: [] })
  gate.resolve(); await pending
  assert.ok(find(f.host, 'p', 'Ingen vejninger endnu'))
  assert.equal(find(f.host, 'button', 'Hent igen'), undefined)
})

test('pilot retains its scoped 44px targets and visible focus CSS', () => {
  const css = readFileSync(new URL('./nutrition.css', import.meta.url), 'utf8')
  assert.match(css, /\.e2-nutrition button[^{}]*\{[^}]*min-height:44px;min-width:44px/)
  assert.match(css, /\.e2-nutrition :focus-visible\{outline:3px/)
})
