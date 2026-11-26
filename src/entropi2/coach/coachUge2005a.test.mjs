// Ordre 2005a (Marc 20. nov.: "husk jeg er pt den eneste træner, kan vi arbejde på at optimere mit orkflow"):
// forsiden følger Marcs uge. Mangler ny uge, Kræver dit blik (beskeder og videoer) og Sendt står øverst i den
// rækkefølge, hver række med ét tryk ind. Det, der overlapper check-in i chatten, står under den lukkede fold Mere.
import test from 'node:test'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import { day } from './coachProductionFixture.mjs'
import { coachHomeModel, coachWeekModel, ugeStatus } from './coachModel.mjs'
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

test('ugen: mangler ny uge er udløbet og ny atlet uden program; sendt er uger, der dækker i dag eller senere (tirsdag)', () => {
  const model = coachHomeModel(mandag(), day)
  assert.deepEqual(model.uge.nyUge.map(r => [r.athlete.id, r.reason, r.tab]), [
    ['d', 'Programmet er udløbet', 'program'], ['f', 'Intet program i appen', 'program']])
  assert.deepEqual(model.uge.sendt.map(r => [r.athlete.id, r.reason]), [
    ['a', 'Uge 2 9. nov. til 15. nov.'], ['e', 'Uge 5 9. nov. til 15. nov.'], ['b', 'Uge 2 9. nov. til 15. nov.'], ['c', 'Uge 2 2. nov. til 8. nov.']])
  assert.deepEqual(model.waiting.map(r => [r.athlete.id, r.reason]), [['a', '1 ulæst besked'], ['b', 'Video venter på feedback']])
})

// Ordre 2087: en atlet uden program, oprettet de seneste 14 dage, er ny (coachUge2087.test.mjs). En ældre står ikke der.
test('ugen: en atlet uden program og uden status onboarding står ikke under Mangler ny uge', () => {
  const p = mandag(); p.athletes[5] = { id: 'f', name: 'Atlet Ny', status: 'active', created_at: '2026-09-01T10:00:00Z' }
  assert.equal(coachHomeModel(p, day).uge.nyUge.some(r => r.athlete.id === 'f'), false)
})

test('ugen: uden færdig kalenderlæsning siger forsiden intet om ny uge eller sendt', () => {
  const p = mandag(); p.coachActionsStatus.calendar = 'loading'
  const model = coachHomeModel(p, day)
  assert.deepEqual(model.uge, { ready: false, nyUge: [], sendt: [] })
  assert.deepEqual(coachWeekModel({}, []), { ready: false, nyUge: [], sendt: [] })
})

test('forsiden: Kræver dig i dag, Mangler ny uge og Sendt i den rækkefølge, før Dine atleter og Mere', () => {
  const html = renderToStaticMarkup(CoachView(mandag()))
  assert.deepEqual(sections(html), ['uge', 'venter', 'ny-uge', 'sendt'])
  const at = s => html.indexOf(s)
  assert.ok(at('data-coach-uge="sendt"') < at('aria-label="Dine atleter"'))
  assert.ok(at('aria-label="Dine atleter"') < at('data-coach-fold="mere"'))
  assert.match(rowText(html, 'ny-uge'), /Atlet Udløbet · Programmet er udløbet.*Atlet Ny · Intet program i appen/)
  assert.match(rowText(html, 'venter'), /Atlet Besked · 1 ulæst besked.*Atlet Video · Video venter på feedback/)
  assert.match(rowText(html, 'sendt'), /Atlet Besked · Uge 2 9. nov. til 15. nov..*Atlet Sendt · Uge 5 9. nov. til 15. nov..*Atlet Video · Uge 2 9. nov. til 15. nov..*Atlet Slutter · Uge 2 2. nov. til 8. nov./)
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

// Ordre 2007 (Marc 20. nov.): Marc sender én uge ad gangen om søndagen. Dagen sættes fast, aldrig ud fra uret.
// 2026-11-23 er en mandag, 2026-11-27 en fredag, 2026-11-28 en lørdag og 2026-11-29 en søndag.
test('2007: mandag med sendt uge 23. til 29. nov. står under Sendt, ikke Mangler ny uge', () => {
  const p = mandag(), d = '2026-11-23'
  p.today = d; p.readContext.day = d
  p.athletes = [{ id: 'a', name: 'Atlet Mandag' }]; p.readContext.athleteIds = ['a']
  p.calendarWeeks = { a: [week('2026-11-23', 1)] }
  p.coachActionsStatus = { calendar: 'ready', activity: { state: 'ready', day: d, ids: ['a'], rows: [] } }
  p.coachMorningData = { messages: { state: 'ready', day: d, ids: ['a'], rows: [] }, videos: { state: 'ready', day: d, ids: null, rows: [] } }
  p.latestByTrack = {}; p.unreadByTrack = {}
  const uge = coachHomeModel(p, d).uge
  assert.deepEqual(uge.nyUge, [])
  assert.deepEqual(uge.sendt.map(r => [r.athlete.id, r.reason]), [['a', 'Uge 1 23. nov. til 29. nov.']])
})

test('2007: ugeStatus, mandag til torsdag med en uge i gang er sendt; udløbet mangler', () => {
  for (const d of ['2026-11-23', '2026-11-24', '2026-11-26']) {
    const s = ugeStatus([week('2026-11-23', 1)], d)
    assert.equal(s.mangler, false, d); assert.equal(s.sendt.week_number, 1, d)
  }
  assert.deepEqual(ugeStatus([week('2026-11-16', 1)], '2026-11-23'), { mangler: true, reason: 'Programmet er udløbet', sendt: null })
})

test('2007: fredag til søndag uden næste uge mangler; med sendt næste uge er den sendt', () => {
  for (const d of ['2026-11-27', '2026-11-28', '2026-11-29'])
    assert.deepEqual(ugeStatus([week('2026-11-23', 1)], d), { mangler: true, reason: 'Ingen uge sendt til næste mandag', sendt: null }, d)
  for (const d of ['2026-11-27', '2026-11-28', '2026-11-29']) {
    const s = ugeStatus([week('2026-11-23', 1), week('2026-11-30', 2)], d)
    assert.equal(s.mangler, false, d); assert.equal(s.sendt.week_number, 2, d)
  }
})

test('2007: en uge uden øvelser tæller ikke som sendt, og en uge uden gyldig dato behandles som før', () => {
  assert.equal(ugeStatus([{ start_date: '2026-11-30', week_number: 2, exercise_count: 0 }, week('2026-11-23', 1)], '2026-11-28').mangler, true)
  const data = { day: '2026-11-28', athletes: [{ id: 'u', name: 'Atlet Udateret' }], calendarReady: true,
    plans: { u: [{ start_date: null, week_number: 1, exercise_count: 3 }] } }
  assert.deepEqual(coachWeekModel(data), { ready: true, nyUge: [], sendt: [] })
})
