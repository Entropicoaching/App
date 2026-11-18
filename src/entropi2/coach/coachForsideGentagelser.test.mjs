import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { CoachView } from './CoachScreen.mjs'

// Ordre 1692 (Marc 16. nov.: "pas på at det ikke er gentagelser på siderne"): på coachens forside står hver atlet
// højst to gange i indholdet: én gang i Kræver dit blik og én gang i Dine atleter. Sidemenuen er navigation og tæller ikke.
const today = '2026-11-18'
const ids = ['a-1', 'a-2', 'a-3']
const athletes = [{ id: 'a-1', name: 'Syntetisk Anna' }, { id: 'a-2', name: 'Syntetisk Bo' }, { id: 'a-3', name: 'Syntetisk Carl' }]
const week = (id, start, n) => ({ id: `w-${id}-${n}`, athlete_id: id, week_number: n, block_name: 'Base', start_date: start, exercise_count: 3 })
const calendarWeeks = Object.fromEntries(ids.map(id => [id, [week(id, '2026-11-16', 2)]]))
const logs = ids.map(id => ({ athlete_id: id, logged_at: '2026-11-18T07:00:00Z' }))
const props = (n = 3) => {
  const list = athletes.slice(0, n), own = ids.slice(0, n)
  return { enabled: true, tab: 'home', today: new Date(`${today}T10:00:00Z`),
    session: { user: { id: 'owner-1' } }, readContext: { coachId: 'owner-1', day: today, athleteIds: own },
    athletes: list, loading: false, loadError: false, calendarWeeks,
    coachActionsStatus: { calendar: 'ready', activity: { state: 'ready', day: today, ids: own, rows: logs.slice(0, n) } },
    coachMorningData: { messages: { state: 'ready', day: today, ids: own, rows: [] }, videos: { state: 'ready', day: today, ids: null, rows: [] } },
    setView() {}, setSelectedAthlete() {}, openCoachPriorityItem() {}, openProfile() {} }
}
// Navnene i vælgeren Noter fra passene (<option>) er et valg, ikke indhold, og tæller ikke.
const synligTekst = html => html.replace(/<option[^>]*>[^<]*<\/option>/g, ' ').replace(/<[^>]*>/g, ' ').replace(/&#x27;|&quot;/g, "'").replace(/\s+/g, ' ')
const antal = (tekst, navn) => tekst.split(navn).length - 1

for (const n of [0, 1, 3]) {
  test(`forsiden nævner hver atlet højst to gange i indholdet (${n} atleter)`, () => {
    const tekst = synligTekst(renderToStaticMarkup(h(CoachView, props(n))))
    for (const a of athletes.slice(0, n)) assert.ok(antal(tekst, a.name) <= 2, `${a.name} står ${antal(tekst, a.name)} gange`)
  })
}

test('Dine atleter er listen med atletens egne tal i én fold uden navn', () => {
  const html = renderToStaticMarkup(h(CoachView, props(3)))
  assert.equal(html.split('data-u11-flere').length - 1, 3, 'én fold pr. atlet')
  assert.match(synligTekst(html), /Planlagt til 22\.11\.2026/)
})
