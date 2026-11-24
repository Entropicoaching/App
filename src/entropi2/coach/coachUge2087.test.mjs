// Ordre 2087 (Marc 23. nov.: "få udbedret produktet så jeg kan tjene flere penge og få mere erfaring og klienter"):
// appen opretter en ny klient med status active, ikke onboarding. Uden første uge skal klienten alligevel stå under
// Mangler ny uge, så Marc ikke glemmer en ny betalende klient, og ud igen, når første uge er gemt.
import test from 'node:test'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import { day } from './coachProductionFixture.mjs'
import { coachHomeModel, coachWeekModel } from './coachModel.mjs'
import { CoachView } from './CoachScreen.mjs'

const week = (start_date, week_number) => ({ start_date, week_number, exercise_count: 3, session_count: 3 })
// 2026-11-03 er en tirsdag.
function model(ny, weeks = []) {
  const e = { id: 'e', name: 'Atlet Sendt', status: 'active', created_at: '2026-05-01T09:00:00Z' }
  const n = { id: 'n', name: 'Atlet Klient', status: 'active', ...ny }
  return { day, athletes: [e, n], calendarReady: true,
    plans: { e: [week('2026-11-02', 4), week('2026-11-09', 5)], n: weeks } }
}
const nyUge = data => coachWeekModel(data).nyUge.map(r => [r.athlete.id, r.reason])

test('ny klient oprettet i appen med status active og uden uger står under Mangler ny uge', () => {
  assert.equal(day, '2026-11-03')
  assert.deepEqual(nyUge(model({ created_at: '2026-11-01T18:30:00.123456+00:00' })), [['n', 'Intet program i appen']])
  assert.deepEqual(nyUge(model({ created_at: `${day}T07:00:00Z` })), [['n', 'Intet program i appen']])
  // Status fra oprettelsen (Peaking, Off-season, Ferie) ændrer ikke, at første uge mangler.
  assert.deepEqual(nyUge(model({ status: 'peaking', created_at: '2026-10-28T10:00:00Z' })), [['n', 'Intet program i appen']])
  // En kladdeuge uden øvelser er ikke en sendt uge.
  assert.deepEqual(nyUge(model({ created_at: '2026-11-01T10:00:00Z' }, [{ start_date: '2026-11-09', week_number: 1, exercise_count: 0 }])),
    [['n', 'Intet program i appen']])
})

test('ny klient går ud af Mangler ny uge og ind under Sendt, når første uge er gemt', () => {
  const data = model({ created_at: '2026-11-01T10:00:00Z' }, [week('2026-11-02', 1)])
  const uge = coachWeekModel(data)
  assert.equal(uge.nyUge.some(r => r.athlete.id === 'n'), false)
  assert.deepEqual(uge.sendt.map(r => [r.athlete.id, r.reason]), [['e', 'Uge 5 9. nov. til 15. nov.'], ['n', 'Uge 1 2. nov. til 8. nov.']])
})

test('kun nyoprettede: 14 dage eller ældre, fremtid, manglende eller ugyldig dato står ikke under Mangler ny uge', () => {
  assert.deepEqual(nyUge(model({ created_at: '2026-10-21T10:00:00Z' })), [['n', 'Intet program i appen']])
  for (const created_at of ['2026-10-20T10:00:00Z', '2026-09-01T10:00:00Z', '2026-11-04T10:00:00Z', undefined, null, '', 'i går', 42, '2026-11-01'])
    assert.deepEqual(nyUge(model({ created_at })), created_at === '2026-11-01' ? [['n', 'Intet program i appen']] : [], String(created_at))
  // Status onboarding gælder fortsat uden dato (skillerne opretter sådan).
  assert.deepEqual(nyUge(model({ status: 'onboarding', created_at: undefined })), [['n', 'Intet program i appen']])
})

test('forsiden viser den nye klient under Mangler ny uge med ét tryk ind til programmet', () => {
  const ids = ['e', 'n']
  const p = { enabled: true, today: day, session: { user: { id: 'coach' } },
    readContext: { coachId: 'coach', day, athleteIds: ids }, u3Data: false,
    athletes: [{ id: 'e', name: 'Atlet Sendt', status: 'active' },
      { id: 'n', name: 'Atlet Klient', status: 'active', created_at: '2026-11-02T12:00:00Z' }],
    calendarWeeks: { e: [week('2026-11-02', 4), week('2026-11-09', 5)], n: [] },
    coachActionsStatus: { calendar: 'ready', activity: { state: 'ready', day, ids, rows: [] } },
    coachMorningData: { messages: { state: 'ready', day, ids, rows: [] }, videos: { state: 'ready', day, ids: null, rows: [] } },
    latestByTrack: {}, unreadByTrack: {}, openProfile() {}, openCoachPriorityItem() {}, setView() {}, setSelectedAthlete() {} }
  assert.deepEqual(coachHomeModel(p, day).uge.nyUge.map(r => r.athlete.id), ['n'])
  const html = renderToStaticMarkup(CoachView(p))
  const start = html.indexOf('data-coach-uge="ny-uge"')
  assert.ok(start > -1)
  assert.match(html.slice(start, html.indexOf('</section>', start)).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '),
    /Atlet Klient · Intet program i appen/)
  assert.ok(html.includes('data-coach-action="program-n"'))
})
