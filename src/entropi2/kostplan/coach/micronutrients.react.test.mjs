// Required app npm-test gate: use real React, with no substitute or dependency skip.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import CoachPlan from './CoachPlan.mjs'
import { coachPlanView } from './view.mjs'
import { microFood, microPlan, syntheticMicros } from './micronutrients.fixture.mjs'
import { createCoachPlan } from './controller.mjs'
import { FOODS } from '../foedevarer/index.mjs'
import { syntheticInput } from './syntheticFixture.mjs'

test('real React renders one collapsed daily micronutrient section containing only complete values', () => {
  const { controller, calls } = microPlan({ calciumMg: null })
  const html = renderToStaticMarkup(h(CoachPlan, { enabled: true, controller }))
  assert.equal((html.match(/>Mineraler og vitaminer<\/summary>/g) ?? []).length, 1)
  assert.match(html, /<details><summary[^>]*>Mineraler og vitaminer<\/summary>/)
  assert.match(html, /<dt>Jern<\/dt><dd[^>]*>4 mg<\/dd>/)
  assert.doesNotMatch(html, /<dt>Calcium<\/dt>|ikke nok data/)
  assert.match(html, /<dt>D-vitamin<\/dt><dd[^>]*>0 µg<\/dd>/)
  assert.equal(calls.length, 0)
})

test('real React controls recalculate the daily section, fail closed for invalid grams and preserve OFF', () => {
  const { controller, calls } = microPlan()
  const walk = n => !n || typeof n !== 'object' ? []
    : [n, ...[n.props.children].flat(Infinity).flatMap(walk)]
  const tree = () => walk(coachPlanView(h, controller.snapshot(), controller))
  tree().find(n => n.props.name === 'grams-0-0').props.onChange({ currentTarget: { value: '200' } })
  assert.match(renderToStaticMarkup(h(CoachPlan, { enabled: true, controller })), /<dt>Jern<\/dt><dd[^>]*>5 mg<\/dd>/)
  tree().find(n => n.props.name === 'grams-0-0').props.onChange({ currentTarget: { value: '' } })
  const html = renderToStaticMarkup(h(CoachPlan, { enabled: true, controller }))
  assert.doesNotMatch(html, /Mineraler og vitaminer|ikke nok data/)
  for (const enabled of [false, undefined, 'true', 1])
    assert.equal(renderToStaticMarkup(h(CoachPlan, { enabled,
      controller: new Proxy({}, { get() { throw Error('OFF read') } }) })), '')
  assert.equal(calls.length, 0)
})

test('real React hides current catalog and legacy plans including saved history with no complete data', async () => {
  for (const catalog of [FOODS, syntheticInput().options.catalog]) {
    const { options, calls } = syntheticInput({ catalog, template: [
      { id: 'meal', name: 'Syntetisk måltid', items: [{ foodId: catalog[0].id, grams: 100 }] },
    ] })
    const controller = createCoachPlan(options)
    const render = () => renderToStaticMarkup(h(CoachPlan, { enabled: true, controller }))
    assert.doesNotMatch(render(), /Mineraler og vitaminer/)
    controller.generate()
    assert.doesNotMatch(render(), /Mineraler og vitaminer|ikke nok data/)
    await controller.save()
    const writes = calls.length
    assert.match(render(), /Syntetisk måltid/)
    assert.doesNotMatch(render(), /Mineraler og vitaminer|ikke nok data/)
    assert.equal(calls.length, writes)
  }
})

test('real React displays a sole complete zero and hides its incomplete daily subtotal', () => {
  const unknown = Object.fromEntries(Object.keys(syntheticMicros).map(key => [key, null]))
  const catalog = [microFood('zero', { ...unknown, vitaminDUg: 0 }), microFood('missing', unknown)]
  const { options, calls } = syntheticInput({ catalog, template: [
    { id: 'meal', name: 'Syntetisk måltid', items: [{ foodId: 'zero', grams: 100 }] },
  ] })
  const controller = createCoachPlan(options)
  controller.generate()
  const render = () => renderToStaticMarkup(h(CoachPlan, { enabled: true, controller }))
  assert.match(render(), /<dt>D-vitamin<\/dt><dd[^>]*>0 µg<\/dd>/)
  assert.doesNotMatch(render(), /<dt>Jern<\/dt>|ikke nok data/)
  controller.editFood(0, 0, 'missing')
  assert.doesNotMatch(render(), /Mineraler og vitaminer|ikke nok data/)
  assert.equal(calls.length, 0)
})
