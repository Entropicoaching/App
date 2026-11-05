import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup as render } from 'react-dom/server'
import CoachScreen, { CoachView } from './CoachScreen.mjs'
import { productionFixture, athleteId } from './coachProductionFixture.mjs'

test('real React home audit: sparse data have no unknown report rows or empty ending fold', () => {
  const p = productionFixture(); delete p.coachNutrition
  p.coachActionsStatus.activity.rows = []; p.calendarWeeks[athleteId] = []
  p.notesClient = { from() { throw Error('No eager IO during SSR') } }
  const html = render(h(CoachView, p))
  assert.match(html, /Syntetisk atlet/); assert.match(html, /Åbn/)
  assert.doesNotMatch(html, /data-coach-fold="(?:ugerapport|programslut)"|ukendt|Proteinmål: ikke angivet/i)
  assert.match(html, /Noter fra passene · Vælg atlet/)
  assert.doesNotMatch(html, /Vælg en atlet for at se pasnoter/)
})

test('real React home audit: loading and failed reads have one attention status without false empty claims', () => {
  for (const state of ['loading', 'error']) {
    const p = productionFixture(); p.coachActionsStatus.activity.state = state
    p.reloadOverview = () => {}; p.inboxRefreshing = state === 'loading'
    const html = render(h(CoachView, p))
    assert.match(html, state === 'error' ? /role="alert"/ : /Opdaterer overblikket…/)
    assert.doesNotMatch(html, /Ingen atleter kræver dit blik|Intet venter på dig/)
    if (state === 'error') assert.match(html, /Prøv igen/)
  }
})

test('real React home audit: undated task occurs once and never claims an imminent end date', () => {
  const p = productionFixture(); p.calendarWeeks[athleteId].push({ exercise_count: 1 })
  p.athletes[0].name = '<script>synthetic</script>'
  const html = render(h(CoachView, p))
  assert.equal((html.match(/Sæt dato på programugen/g) ?? []).length, 1)
  assert.doesNotMatch(html, /data-coach-fold="programslut"|Ukendt slutdato|<script>/)
  assert.match(html, /&lt;script&gt;synthetic&lt;\/script&gt;/)
})

test('real React home audit: confirmed zero stays zero and all auxiliary folds stay closed', () => {
  const p = productionFixture(); p.coachActionsStatus.activity.rows = []; p.coachNutrition.rows = []
  const html = render(h(CoachView, p))
  assert.match(html, /Pas logget: 0 af 3 planlagte/)
  assert.match(html, /Kostdage logget: 0\/7/)
  assert.doesNotMatch(html, /<details[^>]*\bopen/)
})

test('real React home audit: OFF short-circuits both public components before data access', () => {
  for (const Component of [CoachScreen, CoachView]) {
    const props = { enabled: false, get athletes() { throw Error('OFF read') } }
    assert.equal(Component(props), null)
    assert.equal(render(h(Component, { enabled: false })), '')
  }
})
