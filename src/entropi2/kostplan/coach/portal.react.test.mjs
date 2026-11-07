// Required app integration gate. No fake React and no skipped dependency errors.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import CoachKostMaal from '../../kostMaalKobling.mjs'
import PortalPlan from './PortalPlan.mjs'
import { coachPlanView } from './view.mjs'
import { openPortalPlan, DRAFT_MESSAGE } from './portalModel.mjs'
import { FOODS } from '../foedevarer/index.mjs'
import { memoryStorage } from './portal.fixture.mjs'

const props = { enabled: true, athlete: { id: 'synthetic-a', protein_target: 150 }, today: '2026-11-04',
  session: { user: { id: 'synthetic-coach' } }, weightStatus: { athleteId: 'synthetic-a', state: 'ready', rows: [] } }
test('real React renders coach targets followed by a collapsed cost-plan section with no storage access', () => {
  const html = renderToStaticMarkup(h(CoachKostMaal, props))
  assert.match(html, /Kostmål[\s\S]*<details[^>]*><summary[^>]*>Kostplan/)
  assert.doesNotMatch(html, /<details[^>]* open|Dagens plan og mål|Vælg måltider til forslaget/)
  assert.equal(PortalPlan({ enabled: false, get athlete() { throw Error('OFF') } }), null)
  assert.equal(renderToStaticMarkup(h(PortalPlan, { enabled: false })), '')
  const first = PortalPlan(props), second = PortalPlan({ ...props, today: '2026-11-05' })
  assert.notEqual(first.key, second.key)
})
test('real React cost-plan handlers generate, edit grams and persist a draft through explicit local saving', async () => {
  const storage = memoryStorage()
  const { controller } = openPortalPlan({ enabled: true, coachId: props.session.user.id,
    athlete: props.athlete, date: props.today, storage: () => storage,
    template: [{ id: 'synthetic-meal', name: '<synthetic>', items: [{ foodId: FOODS[0].id, grams: 100 }] }] })
  controller.set('maintenanceKcal', 2400); controller.set('fat', 70); controller.generate()
  const walk = n => !n || typeof n !== 'object' ? [] : [n, ...[n.props.children].flat(Infinity).flatMap(walk)]
  const tree = () => walk(coachPlanView(h, controller.snapshot(), controller))
  tree().find(n => n.props.name === 'grams-0-0').props.onChange({ currentTarget: { value: '123,5' } })
  assert.equal(tree().some(n => n.type === 'button' && n.props.children === 'Aktivér for atleten'), false)
  assert.equal(tree().some(n => n.type === 'button' && n.props.children === 'Markér lokal kladde som klar'), false)
  const button = tree().find(n => n.type === 'button' && n.props.children === 'Gem som kladde')
  assert.equal(button.props.disabled, false); await button.props.onClick()
  const html = renderToStaticMarkup(coachPlanView(h, controller.snapshot(), controller))
  assert.ok(html.includes(DRAFT_MESSAGE)); assert.match(html, /&lt;synthetic&gt;/)
  assert.doesNotMatch(html, /Planen er aktiveret/)
  assert.equal(JSON.parse([...storage.data.values()][0]).plan.status, 'draft')
})
