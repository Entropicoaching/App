import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { CoachView } from './CoachScreen.mjs'
import { productionFixture, day, athleteId } from './coachProductionFixture.mjs'
import { addCalendarDays } from '../../calendarDate.js'
const render = props => renderToStaticMarkup(h(CoachView, props))
const cards = html => [...html.matchAll(/<article aria-label="Atletkort:[\s\S]*?<\/article>/g)].map(match => match[0])

test('real React SSR: Dashboard-shaped props without coachAnalysis show supported signals, never unknown card rows', () => {
  const p = productionFixture()
  assert.equal('coachAnalysis' in p, false)
  // SSR runs real hooks in the folded session-note view and draft component too.
  const html = render(p), list = cards(html)
  assert.equal(list.length, 1)
  assert.doesNotMatch(list[0], /ukendt|Vægttrend|Kost logget|Kostdage|Pas logget|<dl/i)
  assert.match(list[0], /Syntetisk atlet/)
  assert.match(list[0], /Seneste pas i dag/)
  assert.match(list[0], /Lavt protein i de seneste 7 loggede dage/)
  assert.match(list[0], /Åbn/)
  assert.equal((list[0].match(/data-coach-short-signal/g) ?? []).length, 1)
  assert.ok(html.indexOf('Kræver dit blik') < html.indexOf('Dine atleter'))
  assert.doesNotMatch(html, /Opfølgningssignal ukendt|Vægttrend ukendt/)
})

test('real React SSR: sparse production data leave just name and open action, no empty draft fold', () => {
  const p = productionFixture(); delete p.coachNutrition
  p.coachActionsStatus.activity.rows = []; p.calendarWeeks = { [athleteId]: [] }
  const html = render(p), list = cards(html)
  assert.equal(list.length, 1)
  assert.doesNotMatch(list[0], /ukendt|Vægttrend|Opfølgningssignal|Kost|Seneste pas|data-coach-short-signal/i)
  assert.doesNotMatch(html, /Beskedudkast fra ugerapport|Lav beskedudkast/)
})

test('real React SSR: validated weight uses tracking weekly averages and the card stays bounded', () => {
  const p = productionFixture()
  p.coachAnalysis = { coachId: p.readContext.coachId, day, athleteIds: [athleteId], state: 'ready',
    byAthlete: { [athleteId]: { athleteId, day, state: 'ready', complete: true,
      cardWeight: { athleteId, day, state: 'ready', complete: true, from: '2026-10-21', through: day,
        points: [0, 1, 2, 7, 8, 9].map(offset => ({ day: addCalendarDays(day, -offset), kg: offset < 7 ? 81 : 80 })) } } } }
  const html = render(p), card = cards(html)[0]
  assert.match(card, /Vægttrend \+1,0 kg · ugesnit/)
  assert.equal((card.match(/data-coach-short-signal/g) ?? []).length, 2)
  assert.doesNotMatch(card, /ukendt|<dl/i)
  p.coachAnalysis.day = '2026-11-02'
  assert.doesNotMatch(cards(render(p))[0], /Vægttrend/)
})

test('real React SSR: known zero permits a draft; inbox and OFF do not mount the workspace', () => {
  const p = productionFixture(); p.coachNutrition.rows = []
  assert.match(render(p), /Beskedudkast fra ugerapport/)
  assert.equal(cards(render({ ...p, tab: 'inbox' })).length, 0)
  for (const enabled of [false, undefined, 1, 'true']) {
    assert.equal(CoachView({ enabled, get athletes() { throw Error('OFF read') } }), null)
    assert.equal(render({ enabled }), '')
  }
})
