import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import CoachScreen, { CoachView } from './CoachScreen.mjs'
import { CoachTeamRegistrations } from '../tracking/hold/CoachTeam.mjs'
import { coachTeamModel } from './coachTeamModel.mjs'
import { coachHomeModel } from './coachModel.mjs'
import { productionFixture, athleteId } from './coachProductionFixture.mjs'

const render = p => renderToStaticMarkup(h(CoachView, p))
const hold = html => html.match(/<details aria-label="Holdoverblik"[\s\S]*?<\/details>/)?.[0] ?? ''

test('real React: current Dashboard data mount one closed fold after attention, before cards', () => {
  const html = render(productionFixture()), section = hold(html)
  assert.ok(section)
  assert.ok(html.indexOf('Kræver dit blik') < html.indexOf('data-coach-fold="hold"'))
  assert.ok(html.indexOf('data-coach-fold="hold"') < html.indexOf('data-coach-fold="atleter"'))
  assert.doesNotMatch(section.split('<summary')[0], / open(?:=|>| )/)
  assert.equal((section.match(/>Holdoverblik</g) ?? []).length, 1)
  for (const text of ['Syntetisk atlet', '1 registreringssignal', '1/28 dage registreret',
    '7/7 dage registreret', '2026-10-07', '2026-10-28', 'min-height:48px', 'minmax(0, 1fr)']) {
    assert.ok(section.includes(text), text)
  }
  assert.doesNotMatch(section, /ukendt|kunne ikke|Vægt|Dagsform|Lavt protein|Seneste pas|ulæst|<button/i)
  // Kontrol-genbasering: basens atletkort viser nu ogsaa det korte signal (data-coach-short-signal);
  // holdfolden maa stadig ikke gentage det.
  assert.ok(html.replace(section, '').includes('Lavt protein i de seneste 7 loggede dage'))
})

test('real React: no observed data, loading, failed, stale or hidden roster never leaves an empty fold', () => {
  for (const change of [p => { p.coachActionsStatus.activity.rows = []; p.coachNutrition.rows = [] },
    p => { p.loading = true }, p => { p.loadError = true }, p => { p.session.user.id = 'foreign' },
    p => { p.readContext.day = '2026-11-02' }, p => { p.hiddenAthleteIds = new Set([athleteId]) }]) {
    const p = productionFixture(); change(p)
    assert.equal(hold(render(p)), '')
  }
})

test('real React: only available domains render; sparse records never claim zero total flags', () => {
  const p = productionFixture(); delete p.coachNutrition
  p.coachActionsStatus.activity.rows = [{ athlete_id: athleteId, logged_at: p.today }]
  const section = hold(render(p))
  assert.match(section, /1\/28 dage registreret/)
  assert.doesNotMatch(section, /Kost 2026|0 flag|0 registreringssignal|ukendt/i)
  p.coachActionsStatus.activity.state = 'partial'
  assert.equal(hold(render(p)), '')
})

test('real React: escaped visible names, no hidden athlete, no analysis or cycle access', () => {
  const p = productionFixture(); p.athletes[0].name = '<script>synthetic</script>'
  p.athletes.push({ id: 'synthetic-hidden', name: 'HIDDEN-SENTINEL', hidden: true })
  p.readContext.athleteIds.push('synthetic-hidden')
  p.coachActionsStatus.activity.ids.push('synthetic-hidden')
  p.coachNutrition.athleteIds.push('synthetic-hidden')
  const section = hold(render(p))
  assert.match(section, /&lt;script&gt;synthetic&lt;\/script&gt;/)
  assert.doesNotMatch(section, /<script>|HIDDEN-SENTINEL|cycle|synthetic-hidden/i)
  // Kontrol-genbasering: basens atletkort laeser coachAnalysis legitimt; holdmodellen selv maa ikke.
  const { today, tab, ...rest } = p
  rest.coachAnalysis = new Proxy({}, { get() { throw Error('private snapshot read') } })
  assert.ok(coachTeamModel({ enabled: true, props: rest, context: coachHomeModel(rest, today) }))
})

test('real React: inbox and OFF are inert for the new view', () => {
  assert.equal(hold(render({ ...productionFixture(), tab: 'inbox' })), '')
  for (const Component of [CoachScreen, CoachView, CoachTeamRegistrations]) {
    for (const enabled of [undefined, false, null, 1, 'true']) assert.equal(Component({ enabled,
      get model() { throw Error('OFF model read') }, get athletes() { throw Error('OFF roster read') } }), null)
    assert.equal(renderToStaticMarkup(h(Component, { enabled: false })), '')
  }
  assert.equal(renderToStaticMarkup(h(CoachTeamRegistrations, { enabled: true, model: null })), '')
})
