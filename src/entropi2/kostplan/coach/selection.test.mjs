import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { createCoachPlan } from './controller.mjs'
import { syntheticInput, text } from './syntheticFixture.mjs'

const componentURL = new URL('./CoachPlan.mjs', import.meta.url).href
const hooks = registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'react' && context.parentURL === componentURL)
    return { url: new URL('./subscription.fixture.mjs', import.meta.url).href, shortCircuit: true }
  return next(specifier, context)
} })
const { default: CoachPlan } = await import('./CoachPlan.mjs')
hooks.deregister()

const render = props => {
  const element = CoachPlan(props)
  return typeof element?.type === 'function' ? element.type(element.props) : element
}

test('actual component OFF never reads controller or selection; distinct controllers have stable distinct keys', () => {
  for (const enabled of [undefined, false, 'true', 1, null]) {
    assert.equal(CoachPlan({ enabled, get controller() { throw Error('OFF controller') },
      get athleteId() { throw Error('OFF selection') } }), null)
  }
  const a = createCoachPlan(syntheticInput().options), b = createCoachPlan(syntheticInput().options)
  const props = { enabled: true, controller: a }
  assert.equal(CoachPlan(props).key, CoachPlan(props).key)
  // Even the same athlete/day gets a new boundary for a replacement controller.
  assert.notEqual(CoachPlan(props).key, CoachPlan({ ...props, controller: b }).key)
})

test('actual component gates stale selected identity/date before plan, grams, history or actions render', async () => {
  const f = syntheticInput(), a = createCoachPlan(f.options)
  a.generate(); await a.save(); await a.activate()
  const old = render({ enabled: true, controller: a })
  assert.match(text(old), /Dagsplan til gennemgang|Tidligere planer/)
  for (const scope of [{ athleteId: 'synthetic-b' }, { date: '2026-11-05' }, { athleteId: null }, { date: null }]) {
    assert.equal(render({ enabled: true, controller: a, ...scope }), null)
  }
  assert.match(text(render({ enabled: true, controller: a, athleteId: f.options.athlete.id,
    date: f.options.date })), /Syntetisk atlet A/)
  const b = createCoachPlan(syntheticInput({ athlete: { id: 'synthetic-b', name: 'Syntetisk B' } }).options)
  const selected = text(render({ enabled: true, controller: b, athleteId: 'synthetic-b', date: f.options.date }))
  assert.match(selected, /Syntetisk B/)
  assert.doesNotMatch(selected, /Syntetisk atlet A|Ris, kogt|Dagsplan til gennemgang/)
  assert.equal(b.snapshot().history.plans.length, 0)
  assert.equal(f.calls.length, 2) // rendering never writes
})

test('late previous-athlete save cannot appear in selected component on repeated render', async () => {
  let resolve, request
  const f = syntheticInput(), pending = new Promise(r => { resolve = r })
  const a = createCoachPlan({ ...f.options, saveDraft: r => { request = r; return pending } })
  const b = createCoachPlan(syntheticInput({ athlete: { id: 'synthetic-b', name: 'Syntetisk B' } }).options)
  a.generate(); const saving = a.save()
  const props = { enabled: true, controller: b, athleteId: 'synthetic-b', date: f.options.date }
  const before = text(render(props))
  resolve(f.ack(request, 'draft')); assert.equal(await saving, true)
  assert.equal(text(render(props)), before)
  assert.equal(b.snapshot().meals.length, 0); assert.equal(b.snapshot().saved, null)
})
