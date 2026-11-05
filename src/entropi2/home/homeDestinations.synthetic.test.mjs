import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { mount } from '../../athlete/trainingFullscreenFake.mjs'

// Actual copied Home; synthetic hooks only, no ReactDOM or browser claim.
const loader = registerHooks({ resolve(specifier, context, next) {
  return specifier === 'react'
    ? { shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(`export * from ${JSON.stringify(new URL('../../athlete/trainingFullscreenFake.mjs', import.meta.url).href)}; export const useMemo = fn => fn();`) }
    : next(specifier, context)
} })
test.after(() => loader.deregister())
const { default: Home } = await import('./AthleteHome.mjs')
const nutritionToday = { date: '2026-11-04', kcal: 400, kcalTarget: 2400 }
const message = { sender_role: 'coach', content: 'Syntetisk coachbesked' }
const props = extra => ({ enabled: true, athlete: { id: 'synthetic-destinations' },
  now: new Date('2026-11-04T12:00:00Z'), storage: null, ...extra })
const text = node => node == null || node === false ? '' : typeof node === 'object' ? node.children.map(text).join('') : String(node)
const buttons = view => view.nodes(n => n.type === 'button')

test('all four card combinations retain exactly one Kost and coach destination', t => {
  for (const hasNutrition of [false, true]) for (const hasCoach of [false, true]) {
    const calls = []
    const view = mount(Home, props({ nutritionToday: hasNutrition ? nutritionToday : null,
      messages: hasCoach ? [message] : [], setTab: route => calls.push(route) }))
    t.after(() => view.unmount())
    const nutrition = buttons(view).filter(n => /^(Kost|Kost i dag:.*)$/.test(text(n)))
    const coach = buttons(view).filter(n => /^(Din coach|Se besked og video)$/.test(text(n)))
    assert.equal(nutrition.length, 1); assert.equal(coach.length, 1)
    assert.equal(text(nutrition[0]).startsWith('Kost i dag:'), hasNutrition)
    assert.equal(text(coach[0]) === 'Se besked og video', hasCoach)
    assert.deepEqual(calls, [], 'render must not navigate')
    nutrition[0].props.onClick();coach[0].props.onClick()
    buttons(view).find(n => text(n) === 'Analyse').props.onClick()
    buttons(view).find(n => text(n) === 'Mobilitet').props.onClick()
    assert.deepEqual(calls, ['kost', 'beskeder', 'fremgang', 'mobilisering'])
  }
})

test('missing, stale or invalid snapshots and empty coach text keep fallback shortcuts', t => {
  for (const snapshot of [undefined, {}, { ...nutritionToday, date: '2026-11-03' },
    { ...nutritionToday, kcal: null }, { ...nutritionToday, kcalTarget: 0 }]) {
    const view = mount(Home, props({ nutritionToday: snapshot,
      messages: [{ sender_role: 'athlete', content: 'Syntetisk svar' }, { ...message, content: '  ' }] }))
    t.after(() => view.unmount())
    for (const label of ['Kost', 'Din coach', 'Analyse', 'Mobilitet'])
      assert.equal(buttons(view).filter(n => text(n) === label).length, 1)
  }
})

test('retained shortcuts and concrete actions use the latest setTab after rerender', t => {
  for (const cards of [false, true]) {
    const old = [], fresh = [], view = mount(Home, props({
      nutritionToday: cards ? nutritionToday : null, messages: cards ? [message] : [],
      setTab: route => old.push(route),
    }))
    t.after(() => view.unmount())
    const nutrition = buttons(view).find(n => /^Kost(?: i dag:.*)?$/.test(text(n)))
    const coach = buttons(view).find(n => /^(Din coach|Se besked og video)$/.test(text(n)))
    view.render({ setTab: route => fresh.push(route) })
    nutrition.props.onClick();coach.props.onClick()
    assert.deepEqual(old, []);assert.deepEqual(fresh, ['kost', 'beskeder'])
  }
})

test('coach own training keeps its shortcut exception and concrete card actions', t => {
  const view = mount(Home, props({ coachOwnTraining: true, nutritionToday, messages: [message] }))
  t.after(() => view.unmount())
  assert.equal(view.nodes(n => n.type === 'nav' && n.props['aria-label'] === 'Genveje').length, 0)
  assert.equal(buttons(view).filter(n => /^Kost i dag:/.test(text(n))).length, 1)
  assert.equal(buttons(view).filter(n => text(n) === 'Se besked og video').length, 1)
  assert.ok(buttons(view).filter(n => /^Kost i dag:|^Se besked og video$/.test(text(n))).every(n => n.props.disabled))
})
