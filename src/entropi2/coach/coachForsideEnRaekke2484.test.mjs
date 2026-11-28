// Ordre 2484 (Marc 28. nov.: "forbedre coach view"; fund 2 i 2483): en atlet står kun én gang blandt opgaverne på forsiden.
// Programslut i Kræver dig i dag og Ingen uge sendt til næste mandag i Mangler ny uge er samme opgave.
import test from 'node:test'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import { coachHomeModel } from './coachModel.mjs'
import { CoachView } from './CoachScreen.mjs'

const day = '2026-11-06' // fredag; ugen 2. til 8. nov. slutter om 2 dage
const week = (start_date, week_number) => ({ start_date, week_number, exercise_count: 3, session_count: 3 })
const ids = ['a', 'b', 'c', 'd', 'e']
function fredag() {
  const athletes = ids.map(id => ({ id, name: `Atlet ${id.toUpperCase()}` }))
  return { enabled: true, today: day, session: { user: { id: 'coach' } },
    readContext: { coachId: 'coach', day, athleteIds: ids }, athletes, u3Data: false,
    calendarWeeks: { a: [week('2026-11-02', 1)], b: [week('2026-11-02', 1), week('2026-11-09', 2)],
      c: [week('2026-10-19', 1)], d: [week('2026-11-02', 1)], e: [week('2026-11-02', 1)] },
    coachActionsStatus: { calendar: 'ready', activity: { state: 'ready', day, ids, rows: [] } },
    coachMorningData: { messages: { state: 'ready', day, ids, rows: [] }, videos: { state: 'ready', day, ids: null, rows: [] } },
    openProfile() {}, openCoachPriorityItem() {}, setView() {}, setSelectedAthlete() {} }
}
const idagIds = m => m.idag.map(r => r.athlete.id).sort()
const ugeIds = m => m.uge.nyUge.map(r => r.athlete.id).sort()

test('2484: ingen atlet står både i Kræver dig i dag og Mangler ny uge', () => {
  const m = coachHomeModel(fredag(), day)
  assert.deepEqual(idagIds(m), ['a', 'd', 'e'])
  assert.deepEqual(ugeIds(m), ['c'], 'kun den udløbne, som ikke står i Kræver dig i dag')
  assert.equal(idagIds(m).filter(id => ugeIds(m).includes(id)).length, 0)
})

test('2484: grunden fra Mangler ny uge følger med ind i rækken og vises i Detaljer', () => {
  const m = coachHomeModel(fredag(), day)
  assert.equal(m.idag.find(r => r.athlete.id === 'a').ugeGrund, 'Ingen uge sendt til næste mandag')
  const html = renderToStaticMarkup(CoachView(fredag()))
  assert.equal(html.split('data-coach-uge-grund').length - 1, 3)
  assert.match(html.replace(/<[^>]+>/g, ' '), /Mangler ny uge: Ingen uge sendt til næste mandag/)
})

test('2484: en atlet ud over de 5 i Kræver dig i dag beholder sin række i Mangler ny uge', () => {
  const p = fredag()
  const mere = ['f', 'g', 'h'].map(id => ({ id, name: `Atlet ${id.toUpperCase()}` }))
  p.athletes = [...p.athletes, ...mere]
  p.readContext.athleteIds = [...ids, 'f', 'g', 'h']
  for (const a of mere) p.calendarWeeks[a.id] = [week('2026-11-02', 1)]
  p.coachActionsStatus.activity.ids = p.readContext.athleteIds
  p.coachMorningData.messages.ids = p.readContext.athleteIds
  const m = coachHomeModel(p, day)
  assert.equal(m.idag.length, 6)
  const synlige = m.idag.slice(0, 5).map(r => r.athlete.id)
  assert.deepEqual(ugeIds(m).sort(), ['c', 'a', 'd', 'e', 'f', 'g', 'h'].filter(id => !synlige.includes(id)).sort())
})
