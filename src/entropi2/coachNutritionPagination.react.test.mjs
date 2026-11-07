// Real React/ReactDOM, real mounted coach consumer and Kost & mål leaf.
// The existing in-memory DOM and database boundary alone are synthetic.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h, act } from 'react'
import { createRoot } from 'react-dom/client'
import { useEntropi2CoachNutrition } from './coachNutritionRead.mjs'
import { CoachView } from './coach/CoachScreen.mjs'
import KostMaal from './kostMaal/KostMaal.mjs'
import { sessionReactDocument } from './session/sessionQuickSetReactDom.mjs'
import { nutritionDatabase as database, nutritionMeal as meal } from './coachNutritionPagination.fixture.mjs'

const athleteId = 'synthetic-day-athlete', day = '2026-11-05'
const context = () => ({ coachId: 'synthetic-coach', day, athleteIds: [athleteId] })
const rows = n => Array.from({ length: n }, (_, i) => meal(i, { date: ['2026-11-01', '2026-11-02', '2026-11-03', day][i % 4] }))
const flush = () => new Promise(resolve => setImmediate(resolve))
function Consumer({ enabled = true, client, readContext, observe }) {
  const batch = useEntropi2CoachNutrition({ enabled, client, readContext })
  observe(batch)
  const athletes = readContext.athleteIds.map(id => ({ id, name: 'Synthetic athlete', kcal_target: 2400, protein_target: 160 }))
  const props = { enabled, readContext, coachNutrition: batch, athletes,
    session: { user: { id: readContext.coachId } }, today: readContext.day,
    loading: false, loadError: false, calendarWeeks: {}, coachActionsStatus: {},
    athlete: athletes[0], weightState: 'loading' }
  return h('div', null, h(CoachView, props), h(KostMaal, props))
}
async function withRoot(run) {
  const doc = sessionReactDocument()
  // CoachView includes the real notes selector. Supply its native DOM options
  // collection while retaining the existing fixture's event/element contract.
  const createElement = doc.createElement
  doc.createElement = tag => {
    const node = createElement(tag)
    if (tag === 'select') Object.defineProperty(node, 'options', { get: () => node.querySelectorAll('option') })
    if (tag === 'option') Object.defineProperty(node, 'value', {
      get: () => node.getAttribute('value') ?? node.textContent,
      set: value => { node.setAttribute('value', value) },
    })
    return node
  }
  const host = doc.createElement('div'); doc.body.append(host)
  const globals = { window: doc.defaultView, IS_REACT_ACT_ENVIRONMENT: true }
  const prior = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, value })
  const root = createRoot(host)
  let last
  const show = props => act(async () => {
    root.render(h(Consumer, { ...props, observe: batch => { last = batch } }))
    await flush(); await flush()
  })
  const unmount = () => act(async () => root.unmount())
  try { await run({ host, show, unmount, batch: () => last }) }
  finally {
    try { await unmount() }
    finally { for (const [key, descriptor] of prior) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]
    } }
  }
}

test('real mounted hook feeds 1001-row cap37 receipt into existing CoachView and Kost & mål', async () => {
  const db = database(rows(1001), { serverCap: 37 }), readContext = context()
  await withRoot(async ({ host, show, batch }) => {
    await show({ client: db.client, readContext })
    assert.equal(batch().complete, true); assert.equal(batch().rows.length, 1001)
    assert.match(host.textContent, /Kost · 4\/7 dage/)
    assert.match(host.textContent, /Seneste 7 dage: gns\./)
    assert.equal(host.querySelectorAll('[data-coach-nutrition]').length, 1)
    assert.equal(db.calls.filter(call => call.table === 'meal_logs').at(-1).range[0], 1001)
  })
})

for (const failure of ['error', 'budget', 'overlap']) {
  test(`real consumer ${failure} stays explicit, hides conclusions and retries through existing button`, async () => {
    let broken = true
    const db = database(rows(failure === 'budget' ? 101 : 80), {
      serverCap: failure === 'budget' ? 1 : 37,
      response(call, data) {
        if (broken && call.table === 'meal_logs' && call.range[0] === 37) {
          if (failure === 'error') return { data: null, error: { code: 'synthetic' } }
          if (failure === 'overlap') return { data: [meal(0, { date: '2026-11-01' })], error: null }
        }
        return { data, error: null }
      },
    })
    await withRoot(async ({ host, show, batch }) => {
      const readContext = context()
      await show({ client: db.client, readContext })
      assert.equal(batch().state, failure === 'error' ? 'error' : 'partial')
      assert.match(host.textContent, failure === 'error' ? /Kostdata kunne ikke hentes/ : /Kostdata er ufuldstændige/)
      assert.equal(host.querySelectorAll('[data-coach-nutrition]').length, 0)
      assert.doesNotMatch(host.textContent, /Kost ·|Seneste 7 dage med nuværende mål|0 loggede dage|Spis mere/)
      const retry = host.querySelectorAll('button').find(node => node.textContent === 'Hent kost igen')
      assert.ok(retry)
      broken = false
      // A genuine new server response after retry, still within the same scope.
      if (failure === 'budget') db.client.from = database(rows(50), { serverCap: 1 }).client.from
      await act(async () => {
        host.dispatch('click', { type: 'click', target: retry, button: 0, bubbles: true, stopPropagation() {} })
        await flush(); await flush()
      })
      assert.equal(batch().state, 'ready'); assert.equal(batch().complete, true)
      assert.match(host.textContent, /Kost · 4\/7 dage/)
      assert.doesNotMatch(host.textContent, /Kostdata er ufuldstændige|Kostdata kunne ikke hentes/)
    })
  })
}

for (const change of ['owner', 'day', 'roster', 'context', 'client', 'OFF', 'unmount']) {
  test(`real effect ${change} replacement stops an in-flight page and prevents late overwrite`, async () => {
    let release, held = false
    const wait = new Promise(resolve => { release = resolve })
    const old = database(rows(80), { serverCap: 37, before(call) {
      if (!held && call.table === 'meal_logs' && call.range[0] === 37) { held = true; return wait }
    } })
    const next = database(rows(4)), initial = context()
    await withRoot(async ({ host, show, batch, unmount }) => {
      try {
        await show({ client: old.client, readContext: initial })
        assert.ok(held); assert.equal(batch(), undefined)
        assert.equal(old.calls.length, 2)
        if (change === 'unmount') await unmount()
        else if (change === 'OFF') await show({ enabled: false, client: old.client, readContext: initial })
        else {
          const readContext = change === 'client' ? initial : { ...initial, athleteIds: [...initial.athleteIds] }
          if (change === 'owner') readContext.coachId = 'new-synthetic-owner'
          if (change === 'day') readContext.day = '2026-11-06'
          if (change === 'roster') readContext.athleteIds = ['synthetic-other-athlete']
          await show({ client: next.client, readContext })
          assert.equal(batch().state, 'ready')
          assert.equal(batch().coachId, readContext.coachId); assert.equal(batch().day, readContext.day)
          assert.deepEqual(batch().athleteIds, readContext.athleteIds)
        }
        const before = batch(), rendered = host.textContent
        await act(async () => { release(); await flush(); await flush() })
        assert.equal(old.calls.length, 2)
        assert.equal(batch(), before); assert.equal(host.textContent, rendered)
        if (change === 'OFF' || change === 'unmount') assert.equal(host.textContent, '')
      } finally { release() }
    })
  })
}

for (const field of ['coachId', 'day', 'athleteIds']) {
  test(`in-place ${field} mutation restarts real effect with captured scope and hides prior receipt`, async () => {
    let release, held = false
    const wait = new Promise(resolve => { release = resolve }), readContext = context()
    const db = database(rows(80), { serverCap: 37, before(call) {
      if (!held && call.table === 'meal_logs' && call.range[0] === 37) { held = true; return wait }
    } })
    await withRoot(async ({ show, batch }) => {
      try {
        await show({ client: db.client, readContext })
        if (field === 'coachId') readContext.coachId = 'new-owner'
        if (field === 'day') readContext.day = '2026-11-06'
        if (field === 'athleteIds') readContext.athleteIds.splice(0, 1, 'synthetic-other-athlete')
        await show({ client: db.client, readContext })
        assert.equal(batch().state, 'ready')
        assert.equal(batch().coachId, readContext.coachId); assert.equal(batch().day, readContext.day)
        assert.deepEqual(batch().athleteIds, readContext.athleteIds)
        const latest = batch(), calls = db.calls.length
        await act(async () => { release(); await flush(); await flush() })
        assert.equal(batch(), latest); assert.equal(db.calls.length, calls)
      } finally { release() }
    })
  })
}

test('real OFF hook makes no database calls and mounts no consumer data', async () => {
  const db = database(rows(4))
  await withRoot(async ({ host, show }) => {
    await show({ enabled: false, client: db.client, readContext: context() })
    assert.equal(db.calls.length, 0); assert.equal(host.textContent, '')
  })
})
