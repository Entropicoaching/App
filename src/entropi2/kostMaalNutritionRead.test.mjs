// Actual copied reader, host and portal; synthetic React and in-memory storage.
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { readFileSync } from 'node:fs'
import { mount, nodes, text, memoryStorage } from './kostplan/coach/portal.fixture.mjs'
import { input, coach, athleteId } from './kostplan/rapport/reportFixture.mjs'

const root = new URL('./', import.meta.url).href
const hooks = registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'react' && context.parentURL?.startsWith(root))
    return { url: new URL('./kostplan/coach/portal.fixture.mjs', import.meta.url).href, shortCircuit: true }
  return next(specifier, context)
} })
const { default: CoachKostMaal, kostMaalNutritionRead } = await import('./kostMaalKobling.mjs')
const { readCoachNutrition } = await import('./coachNutritionRead.mjs')
const { default: PortalPlan, PortalNutritionReport } = await import('./kostplan/coach/PortalPlan.mjs')
hooks.deregister()

async function fixture() {
  const calls = [], data = input()
  const readContext = { coachId: coach.id, day: data.date, athleteIds: [athleteId, 'synthetic-other'] }
  const client = { from(table) {
    const call = [table]; calls.push(call)
    const chain = Object.fromEntries(['select', 'in', 'gte', 'lte', 'order'].map(method => [method, (...args) => {
      call.push([method, ...args]); return chain
    }]))
    chain.limit = limit => {
      call.push(['limit', limit])
      return Promise.resolve({ error: null, data: table === 'meal_logs'
        ? [...data.mealLogs.map(({ carb, fat, ...row }) => row),
          { ...data.mealLogs[0], id: 'other-meal', athlete_id: 'synthetic-other' }]
        : [{ id: athleteId, kcal_target: 2000, protein_target: 150 }] })
    }
    return chain
  } }
  const coachNutrition = await readCoachNutrition(client, readContext)
  return { calls, props: { enabled: true, athlete: { id: athleteId }, today: data.date,
    session: { user: { id: coach.id } }, loading: false, loadError: false, readContext, coachNutrition,
    weightStatus: { athleteId, state: 'ready', rows: [...data.weightLogs].reverse() } } }
}

test('existing coach read reaches the portal with only selected athlete rows and no additional query', async () => {
  const { calls, props } = await fixture(), before = structuredClone(props)
  const receipt = kostMaalNutritionRead(props)
  assert.equal(receipt.coachId, coach.id)
  assert.equal(receipt.athleteId, athleteId)
  assert.equal(receipt.date, props.today)
  assert.equal(receipt.state, 'ready')
  assert.equal(receipt.complete, true)
  assert.equal(receipt.mealLogs.length, 2)
  receipt.mealLogs.forEach((row, i) => {
    assert.equal(row, props.coachNutrition.rows[i])
    assert.equal(Object.hasOwn(row, 'carb'), false)
    assert.equal(Object.hasOwn(row, 'fat'), false)
  })
  assert.deepEqual(receipt.weightLogs, [...props.weightStatus.rows].reverse())
  const portal = CoachKostMaal(props).props.children.find(child => child.type === PortalPlan)
  assert.deepEqual(portal.props.nutritionRead, receipt)
  assert.equal(PortalPlan(portal.props).props.nutritionRead, portal.props.nutritionRead)
  assert.deepEqual(calls.map(call => call[0]), ['meal_logs', 'athletes'])
  assert.equal(calls[0][1][1], 'id, athlete_id, date, meal, kcal, protein')
  assert.deepEqual(props, before)
})

test('absent plan history is explicit; profile targets and local drafts cannot become activated history', async () => {
  const { props } = await fixture(), storage = memoryStorage()
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })
  try {
    const receipt = kostMaalNutritionRead(props)
    assert.equal(receipt.planHistory, 'unavailable')
    assert.equal(Object.hasOwn(receipt, 'plans'), false)
    assert.equal(PortalNutritionReport({ enabled: true, coachId: coach.id,
      athlete: props.athlete, date: props.today, nutritionRead: receipt }), null)
    const screen = mount(CoachKostMaal, props)
    const folded = screen.render()
    nodes(folded).find(node => node.type === 'details' && text(node).trim() === 'Kostplan')
      .props.onToggle({ currentTarget: { open: true } })
    const opened = screen.render()
    assert.doesNotMatch(text(opened), /Kostrapport|Plan og registreret kost/)
    assert.equal(storage.data.size, 0)
    assert.equal(storage.calls.filter(([method]) => method === 'set').length, 0)
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous)
    else delete globalThis.localStorage
  }
})

test('stale, partial, failed, foreign or unfinished reads cannot become a report receipt', async () => {
  const { props } = await fixture()
  const changes = [
    { loading: true }, { loadError: true }, { readContext: undefined }, { coachNutrition: undefined },
    { today: '2026-11-09' }, { session: { user: { id: 'foreign-coach' } } },
    { athlete: { id: 'foreign-athlete' } }, { weightStatus: undefined },
    { weightStatus: { ...props.weightStatus, athleteId: 'foreign-athlete' } },
    ...['loading', 'error', 'partial'].map(state => ({ coachNutrition: { ...props.coachNutrition, state } })),
    { coachNutrition: { ...props.coachNutrition, complete: false } },
    { coachNutrition: { ...props.coachNutrition, from: '2026-11-03' } },
    { coachNutrition: { ...props.coachNutrition, rows: [{ ...props.coachNutrition.rows[0], athlete_id: 'foreign-athlete' }] } },
    { weightStatus: { ...props.weightStatus, state: 'loading' } },
    { weightStatus: { ...props.weightStatus, state: 'error' } },
    { weightStatus: { ...props.weightStatus, rows: [{ athlete_id: 'foreign-athlete' }] } },
  ]
  for (const change of changes) {
    const current = { ...props, ...change }
    assert.equal(kostMaalNutritionRead(current), undefined)
    assert.equal(CoachKostMaal(current).props.children.find(child => child.type === PortalPlan).props.nutritionRead, undefined)
  }
  assert.deepEqual(kostMaalNutritionRead({ ...props,
    coachNutrition: { ...props.coachNutrition, rows: [] }, weightStatus: { ...props.weightStatus, rows: [] } }).mealLogs, [])
})

test('explicit saved-history receipts remain unchanged and OFF reads no data', async () => {
  const { props } = await fixture()
  const nutritionRead = { ...input(), coachId: coach.id, state: 'ready', complete: true }
  const portal = CoachKostMaal({ ...props, nutritionRead }).props.children.find(child => child.type === PortalPlan)
  assert.equal(portal.props.nutritionRead, nutritionRead)
  const scoped = PortalPlan(portal.props)
  const report = mount(PortalNutritionReport, { ...scoped.props, enabled: true }).render()
  assert.match(text(report), /Plan og registreret kost/)
  assert.match(text(report), /3.500 kcal registreret/)
  assert.match(text(report), /4.000 kcal plan for loggede dage/)
  for (const enabled of [undefined, false, 0, 1, 'true']) {
    const off = { enabled, get coachNutrition() { throw Error('OFF meal read') },
      get athlete() { throw Error('OFF athlete read') }, get nutritionRead() { throw Error('OFF receipt read') } }
    assert.equal(kostMaalNutritionRead(off), undefined)
    assert.equal(CoachKostMaal(off), null)
  }
  const dashboard = readFileSync(new URL('../Dashboard.jsx', import.meta.url), 'utf8')
  const tag = dashboard.slice(dashboard.indexOf('<CoachKostMaal '), dashboard.indexOf('/>', dashboard.indexOf('<CoachKostMaal ')))
  assert.match(tag, /coachNutrition=\{e2CoachNutrition\}/)
  assert.match(tag, /readContext=\{e2ReadContext\}/)
})
