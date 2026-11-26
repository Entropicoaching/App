// Real React SSR. Synthetic authorized roster/read receipts only; no service calls.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup as render } from 'react-dom/server'
import CoachScreen, { CoachView } from './CoachScreen.mjs'
import { productionFixture, day } from './coachProductionFixture.mjs'
import { coachHomeModel } from './coachModel.mjs'

function fixture(count) {
  const p = productionFixture(), ids = Array.from({ length: count }, (_, i) => `synthetic-${i}`)
  p.athletes = ids.map((id, i) => ({ id, name: i === 0 ? 'Syntetisk Æble' : `Syntetisk langt atletnavn ${i}` }))
  p.readContext.athleteIds = ids
  p.calendarWeeks = Object.fromEntries(ids.map(id => [id, []]))
  p.coachActionsStatus.activity = { state: 'ready', day, ids, rows: [] }
  p.coachMorningData.messages = { state: 'ready', day, ids, rows: [] }
  p.coachMorningData.videos = { state: 'ready', day, ids, rows: [] }
  p.latestByTrack = Object.fromEntries(ids.map(id => [id, { besked: { athlete_id: id, content: 'Syntetisk', created_at: `${day}T12:00:00Z` } }]))
  p.unreadByTrack = Object.fromEntries(ids.map(id => [id, { besked: 1 }]))
  delete p.coachNutrition
  return p
}

test('real React: task limit, order, closed remainder and inbox portions for zero, one, ten and twenty tasks', () => {
  for (const count of [0, 1, 10, 20]) {
    const p = fixture(count), model = coachHomeModel(p, day)
    const html = render(h(CoachScreen, p))
    // Ordre 1547 (genfanget bevidst, 1544's fund): tom liste siger ikke "0 opgaver i alt" eller "0 af 0"; den rolige sætning står alene.
    // Ordre 1707: forsiden siger aldrig "n opgaver i alt"; rækkerne og "Vis resten (n)" bærer tallet.
    assert.doesNotMatch(html, /opgaver? i alt|0 af 0/)
    // Ordre 2417: forsiden viser højst 5 rækker i Kræver dig i dag, ingen fold med rest.
    assert.equal((html.match(/data-coach-action=/g) ?? []).length, Math.min(5, count))
    assert.deepEqual([...html.matchAll(/data-coach-action="([^"]+)"/g)].map(m => m[1]), model.idag.slice(0, 5).map(r => r.key))
    assert.doesNotMatch(html, /Vis resten|data-coach-fold="opgaver"/)
    const inbox = render(h(CoachScreen, { ...p, tab: 'inbox' }))
    assert.doesNotMatch(inbox, /Vis resten|type="search"/)
    assert.equal((inbox.match(/data-coach-action=/g) ?? []).length, Math.min(10, model.inbox.length))
    if (count === 0) assert.doesNotMatch(inbox, /0 af 0|opgaver i alt/)
    else assert.match(inbox, new RegExp(`${Math.min(10, count)} af ${count}`))
    assert.equal(inbox.includes('Vis 10 flere'), count > 10)
    const expanded = render(h(CoachView, { ...p, tab: 'inbox', inboxLimit: 20 }))
    assert.deepEqual([...expanded.matchAll(/data-coach-action="([^"]+)"/g)].map(m => m[1]), model.inbox.map(r => r.key))
  }
})

test('real React: restored search is controlled by the host', () => {
  // Ordre 1692: Atletkort er flyttet ind i Dine atleter; søgningen står over listen, og der er ingen åben fold at gendanne.
  const html = render(h(CoachScreen, { ...fixture(10), athleteQuery: 'ÆBLE', onAthleteQueryChange() {} }))
  assert.match(html, /type="search"[^>]*value="ÆBLE"/)
  assert.match(html, /1 af 10/)
  assert.equal((html.match(/data-u11-atlet=/g) ?? []).length, 1)
})

test('real React: remounted inbox respects the host portion and keeps remaining tasks reachable', () => {
  const p = fixture(25), expected = coachHomeModel(p, day).inbox
  for (const inboxLimit of [10, 20, 30]) {
    const html = render(h(CoachScreen, { ...p, tab: 'inbox', inboxLimit, onShowMoreInbox() {} }))
    assert.deepEqual([...html.matchAll(/data-coach-action="([^"]+)"/g)].map(m => m[1]),
      expected.slice(0, inboxLimit).map(row => row.key))
    assert.match(html, new RegExp(`${Math.min(inboxLimit, 25)} af 25`))
    assert.equal(html.includes('Vis 10 flere'), inboxLimit < 25)
  }
})

test('real React: controlled name search, no match and reset render above the athlete list', () => {
  const p = fixture(10)
  for (const [athleteQuery, expected] of [['', 10], ['  ÆBLE  ', 1], ['intet-match', 0]]) {
    const html = render(h(CoachView, { ...p, athleteQuery, onAthleteQueryChange() {} }))
    assert.match(html, /<label[^>]*>Søg efter atletnavn<input type="search"/)
    assert.match(html, new RegExp(`${expected} af 10`))
    assert.equal((html.match(/data-u11-atlet=/g) ?? []).length, expected)
    assert.equal(html.includes('Ingen match på atletnavnet.'), expected === 0)
    if (athleteQuery) assert.match(html, /Nulstil søgning/)
  }
})
