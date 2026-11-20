// Ordre 2005a (Marc 20. nov.: "husk jeg er pt den eneste træner, kan vi arbejde på at optimere mit orkflow"):
// forsiden følger Marcs uge. Mangler ny uge, Kræver dit blik (beskeder og videoer) og Sendt står øverst i den
// rækkefølge, hver række med ét tryk ind. Det, der overlapper check-in i chatten, står under den lukkede fold Mere.
import test from 'node:test'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import { day } from './coachProductionFixture.mjs'
import { coachHomeModel, coachWeekModel } from './coachModel.mjs'
import { CoachView } from './CoachScreen.mjs'

const week = (start_date, week_number) => ({ start_date, week_number, exercise_count: 3, session_count: 3 })
// 2026-11-03 er en tirsdag; ugen startede mandag 2026-11-02.
function mandag() {
  const ids = ['a', 'b', 'c', 'd', 'e', 'f']
  const athletes = [
    { id: 'a', name: 'Atlet Besked' }, { id: 'b', name: 'Atlet Video' }, { id: 'c', name: 'Atlet Slutter' },
    { id: 'd', name: 'Atlet Udløbet' }, { id: 'e', name: 'Atlet Sendt' }, { id: 'f', name: 'Atlet Ny', status: 'onboarding' },
  ]
  return { enabled: true, today: day, session: { user: { id: 'coach' } },
    readContext: { coachId: 'coach', day, athleteIds: ids }, athletes, u3Data: false,
    calendarWeeks: { a: [week('2026-11-02', 1), week('2026-11-09', 2)], b: [week('2026-11-02', 1), week('2026-11-09', 2)],
      c: [week('2026-10-26', 1), week('2026-11-02', 2)], d: [week('2026-10-19', 1), week('2026-10-26', 2)],
      e: [week('2026-11-02', 4), week('2026-11-09', 5)], f: [] },
    coachActionsStatus: { calendar: 'ready', activity: { state: 'ready', day, ids, rows: [] } },
    coachMorningData: {
      messages: { state: 'ready', day, ids, rows: [] },
      videos: { state: 'ready', day, ids: null, rows: [{ id: 'v1', athlete_id: 'b', status: 'draft', created_at: `${day}T08:00:00Z` }] } },
    latestByTrack: { a: { besked: { athlete_id: 'a', content: 'Hej coach', created_at: `${day}T07:00:00Z` } } },
    unreadByTrack: { a: { besked: 1 } },
    openProfile() {}, openCoachPriorityItem() {}, setView() {}, setSelectedAthlete() {} }
}
const sections = html => [...html.matchAll(/data-coach-uge="([^"]+)"/g)].map(m => m[1])
const rowText = (html, key) => {
  const start = html.indexOf(`data-coach-uge="${key}"`)
  const end = html.indexOf('</section>', start)
  return html.slice(start, end).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
}

test('ugen: mangler ny uge er udløbet, slutter snart og ny atlet uden program; sendt er uger fra denne mandag', () => {
  const model = coachHomeModel(mandag(), day)
  assert.deepEqual(model.uge.nyUge.map(r => [r.athlete.id, r.reason, r.tab]), [
    ['d', 'Programmet er udløbet', 'program'], ['c', 'Programmet slutter om 5 dage', 'program'], ['f', 'Intet program i appen', 'program']])
  assert.deepEqual(model.uge.sendt.map(r => [r.athlete.id, r.reason]), [
    ['a', 'Uge 2 klar fra 9. nov.'], ['e', 'Uge 5 klar fra 9. nov.'], ['b', 'Uge 2 klar fra 9. nov.']])
  assert.deepEqual(model.waiting.map(r => [r.athlete.id, r.reason]), [['a', '1 ulæst besked'], ['b', 'Video venter på feedback']])
})

test('ugen: en atlet uden program og uden status onboarding står ikke under Mangler ny uge', () => {
  const p = mandag(); p.athletes[5] = { id: 'f', name: 'Atlet Ny', status: 'active' }
  assert.equal(coachHomeModel(p, day).uge.nyUge.some(r => r.athlete.id === 'f'), false)
})

test('ugen: uden færdig kalenderlæsning siger forsiden intet om ny uge eller sendt', () => {
  const p = mandag(); p.coachActionsStatus.calendar = 'loading'
  const model = coachHomeModel(p, day)
  assert.deepEqual(model.uge, { ready: false, nyUge: [], sendt: [] })
  assert.deepEqual(coachWeekModel({}, []), { ready: false, nyUge: [], sendt: [] })
})

test('forsiden: Mangler ny uge, Kræver dit blik og Sendt i den rækkefølge, før Dine atleter og Mere', () => {
  const html = renderToStaticMarkup(CoachView(mandag()))
  assert.deepEqual(sections(html), ['uge', 'ny-uge', 'venter', 'sendt'])
  const at = s => html.indexOf(s)
  assert.ok(at('data-coach-uge="sendt"') < at('aria-label="Dine atleter"'))
  assert.ok(at('aria-label="Dine atleter"') < at('data-coach-fold="mere"'))
  assert.match(rowText(html, 'ny-uge'), /Atlet Udløbet · Programmet er udløbet.*Atlet Slutter · Programmet slutter om 5 dage.*Atlet Ny · Intet program i appen/)
  assert.match(rowText(html, 'venter'), /Atlet Besked · 1 ulæst besked.*Atlet Video · Video venter på feedback/)
  assert.match(rowText(html, 'sendt'), /Atlet Besked · Uge 2 klar fra 9\. nov\..*Atlet Sendt · Uge 5 klar fra 9\. nov\..*Atlet Video · Uge 2 klar fra 9\. nov\./)
  // Mere er lukket, og Holdet og Programmer og noter ligger inden i den.
  const mere = html.slice(at('data-coach-fold="mere"') - 200)
  assert.doesNotMatch(mere.slice(0, mere.indexOf('data-coach-fold="mere"') + 40), /\bopen=""/)
  assert.ok(at('data-u11-gruppe="hold"') === -1 || at('data-u11-gruppe="hold"') > at('data-coach-fold="mere"'))
  assert.ok(at('data-u11-gruppe="programmer"') > at('data-coach-fold="mere"'))
})

test('forsiden: hver række i ugen åbner med ét tryk; ny uge og sendt åbner programmet, besked og video deres opgave', () => {
  const p = mandag(), calls = []
  p.openProfile = (...args) => calls.push(['profil', ...args])
  p.openCoachPriorityItem = (...args) => calls.push(['opgave', ...args])
  const all = n => Array.isArray(n) ? n.flatMap(all) : !n || typeof n !== 'object' ? [] : [n, ...all(n.props?.children)]
  const tree = all(CoachView(p))
  const click = key => {
    const button = tree.find(n => n.props?.['data-coach-action'] === key)
    assert.ok(button, `knappen ${key} findes`)
    button.props.onClick(); return calls.at(-1)
  }
  const [kind, athlete, ...rest] = click('program-d')
  assert.deepEqual([kind, athlete.id, ...rest], ['profil', 'd', 'program', 'list'])
  assert.deepEqual(click('program-f').slice(2), ['program', 'list'])
  assert.deepEqual(click('sendt-e').slice(2), ['program', 'list'])
  assert.equal(click('message-a-besked')[0], 'opgave')
  assert.equal(click('video-v1')[0], 'opgave')
})

test('forsiden: + Ny atlet står under Dine atleter, når Dashboard giver en åbner; ellers ingen knap', () => {
  let opened = 0
  const p = mandag()
  const all = n => Array.isArray(n) ? n.flatMap(all) : !n || typeof n !== 'object' ? [] : [n, ...all(n.props?.children)]
  assert.equal(all(CoachView(p)).some(n => n.props?.['data-coach-ny-atlet']), false)
  const knap = all(CoachView({ ...p, onNyAtlet: () => opened++ })).find(n => n.props?.['data-coach-ny-atlet'])
  knap.props.onClick(); assert.equal(opened, 1)
  assert.equal(all(CoachView({ ...p, tab: 'inbox', onNyAtlet: () => opened++ })).some(n => n.props?.['data-coach-ny-atlet']), false)
})
