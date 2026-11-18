// Ordre 1667: coachens "Aktuelt coachmål fra profilen" siger ikke "ukendt" ved siden af et kendt mål,
// når atleten har en aktiv godkendt plan. Uden aktiv plan står teksten som før. Syntetiske data.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { planContextView } from './planContextView.mjs'

const snapshot = activePlan => ({ form: { goal: 'maintain' }, calculated: false, suggestion: null, totals: null, busy: null,
  activationState: activePlan ? 'ready' : 'checking', activePlan })
const render = (athlete, activePlan) => renderToStaticMarkup(planContextView(h, { athlete, date: '2026-11-18',
  snapshot: snapshot(activePlan), notes: { preferences: '', allergies: '', budget: '' }, onNote() {} }))
const coachRow = html => html.match(/<dt>Aktuelt coachmål fra profilen<\/dt><dd>(.*?)<\/dd>/)[1]
const athlete = { id: 'syn', age: 26, bodyweight: 80, kcal_target: 1800, protein_target: 180 }
const active = { id: 'p', revision: 'v', athlete_id: 'syn', date: '2026-11-18', active: true }

test('aktiv plan: kendte mål står uden "ukendt" for det ukendte mål', () => {
  assert.equal(coachRow(render(athlete, active)), '1.800 kcal · 180 g protein')
})
test('aktiv plan og kendt mål: alle tre står som før', () => {
  assert.equal(coachRow(render({ ...athlete, goal: 'cut' }, active)), 'Cut · 1.800 kcal · 180 g protein')
})
test('uden aktiv plan står teksten som før', () => {
  assert.equal(coachRow(render(athlete, null)), 'ukendt · 1.800 kcal · 180 g protein')
})
test('aktiv plan uden noget kendt mål: står som før', () => {
  assert.equal(coachRow(render({ id: 'syn', age: 26, bodyweight: 80 }, active)), 'ukendt · ukendt · ukendt')
})
