import test from 'node:test'
import assert from 'node:assert/strict'
import { createCoachPlan } from './controller.mjs'
import { coachPlanView } from './view.mjs'
import { syntheticInput } from './syntheticFixture.mjs'

// Never substitute a fake package for this gate. Hermetic workers without the
// app's installed dependencies report an explicit skip; Dhurva runs it at merge.
let React, renderToStaticMarkup, CoachPlan
try {
  React = await import('react')
  ;({ renderToStaticMarkup } = await import('react-dom/server'))
  ;({ default: CoachPlan } = await import('./CoachPlan.mjs'))
} catch (error) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND' || !/Cannot find package 'react(?:-dom)?'/.test(error.message)) throw error
}
const gate = { skip: !CoachPlan ? 'Real React dependencies absent in pinned public copy; REQUIRED at app merge' : false }

test('real React SSR uses the actual subscription component, escapes names and renders daily meals', gate, async () => {
  const f = syntheticInput(), controller = createCoachPlan({ ...f.options, athlete: { ...f.options.athlete, name: '<synthetic>' } })
  const render = () => renderToStaticMarkup(React.createElement(CoachPlan, { enabled: true, controller }))
  assert.match(render(), /&lt;synthetic&gt;/); assert.equal(f.calls.length, 0)
  controller.generate()
  const html = render()
  assert.match(html, /Gram af/); assert.match(html, /Dagens plan og mål/)
  assert.match(html, /<details>/); assert.doesNotMatch(html, /<details open/)
  assert.equal((html.match(/<legend>/g) ?? []).length, 4)
  await controller.save(); await controller.activate()
  assert.match(render(), /Planen er aktiveret for atleten/)
  assert.equal(f.calls.length, 2)
})

test('real React element event handlers edit, save, activate and disable stale activation', gate, async () => {
  const f = syntheticInput(), controller = createCoachPlan(f.options)
  const all = element => !React.isValidElement(element) ? []
    : [element, ...[element.props.children].flat(Infinity).flatMap(all)]
  const tree = () => all(coachPlanView(React.createElement, controller.snapshot(), controller))
  tree().find(node => node.type === 'form').props.onSubmit({ preventDefault() {} })
  tree().find(node => node.props.name === 'grams-0-0').props.onChange({ currentTarget: { value: '150' } })
  await tree().find(node => node.props.children === 'Gem som kladde').props.onClick()
  assert.equal(tree().find(node => node.props.children === 'Aktivér for atleten').props.disabled, false)
  await tree().find(node => node.props.children === 'Aktivér for atleten').props.onClick()
  tree().find(node => node.props.name === 'food-0-0').props.onChange({ currentTarget: { value: 'rice' } })
  assert.equal(tree().find(node => node.props.children === 'Aktivér for atleten').props.disabled, true)
})

test('real React strict OFF and switching selected controller never expose the prior athlete', gate, () => {
  for (const enabled of [undefined, false, 'true', 1]) {
    const props = { enabled, controller: new Proxy({}, { get() { throw Error('OFF read') } }) }
    assert.equal(CoachPlan(props), null)
    assert.equal(renderToStaticMarkup(React.createElement(CoachPlan, props)), '')
  }
  const a = syntheticInput(), b = syntheticInput({ athlete: { id: 'synthetic-b', name: 'Syntetisk B' } })
  const modelA = createCoachPlan(a.options), modelB = createCoachPlan(b.options)
  modelA.generate()
  const markup = renderToStaticMarkup(React.createElement(CoachPlan, { enabled: true, controller: modelB }))
  assert.match(markup, /Syntetisk B/); assert.doesNotMatch(markup, /Syntetisk atlet A|Dagsplan til gennemgang/)
  assert.match(renderToStaticMarkup(React.createElement(CoachPlan, { enabled: true })), /role="alert"/)
})
