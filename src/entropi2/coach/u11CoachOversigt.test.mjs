import test from 'node:test'
import assert from 'node:assert/strict'
import { CoachView } from './CoachScreen.mjs'
import AthleteOverview, { athleteOverviewModel } from './AthleteOverview.mjs'

// U11 (Marc 11. nov. kl. 16:45): "ønsker også en nem oversigt så jeg hurtig kan klikke ind og se atlet x program"
// og "fra coachview det stadig er lidt rodet". Én åben atletliste; ét tryk åbner programmet; resten samlet i to folde.
const today = '2026-11-11'
const ids = ['a-1', 'a-2', 'a-3', 'a-4']
const athletes = [
  { id: 'a-1', name: 'Syntetisk Bo' }, { id: 'a-2', name: 'Syntetisk Alma' },
  { id: 'a-3', name: 'Syntetisk Cille' }, { id: 'a-4', name: 'Syntetisk Dan' }]
const week = (id, start, n, block, count = 3) => ({ id: `w-${id}-${n}`, athlete_id: id, week_number: n, block_name: block, start_date: start, exercise_count: count })
const calendarWeeks = {
  'a-1': [week('a-1', '2026-11-02', 4, 'Styrke 2'), week('a-1', '2026-11-09', 5, 'Styrke 2'), week('a-1', '2026-11-16', 6, 'Styrke 2')],
  'a-2': [week('a-2', '2026-10-26', 1, 'Grundblok'), week('a-2', '2026-11-02', 2, 'Grundblok')],
  'a-3': [],
  'a-4': [week('a-4', '2026-11-09', 1, null), week('a-4', '2026-11-30', 4, null)],
}
const logs = [
  { athlete_id: 'a-1', logged_at: '2026-11-10T17:00:00Z' },
  { athlete_id: 'a-1', logged_at: '2026-11-03T17:00:00Z' },
  { athlete_id: 'a-2', logged_at: '2026-11-11T07:00:00Z' },
  { athlete_id: 'a-4', logged_at: '2026-11-11T08:00:00Z', skipped: true },
]
const props = (extra = {}) => ({ enabled: true, tab: 'home', today: new Date(`${today}T10:00:00Z`),
  session: { user: { id: 'owner-1' } }, readContext: { coachId: 'owner-1', day: today, athleteIds: ids },
  athletes, loading: false, loadError: false, calendarWeeks,
  coachActionsStatus: { calendar: 'ready', activity: { state: 'ready', day: today, ids, rows: logs } },
  coachMorningData: { messages: { state: 'ready', day: today, ids, rows: [] }, videos: { state: 'ready', day: today, ids: null, rows: [] } },
  setView() {}, setSelectedAthlete() {}, openCoachPriorityItem() {}, openProfile() {}, ...extra })
const nodes = n => Array.isArray(n) ? n.flatMap(nodes) :
  !n || typeof n !== 'object' ? [] : [n, ...nodes(n.props?.children ?? n.children)]
const text = n => Array.isArray(n) ? n.map(text).join('') : n == null || n === false ? '' :
  typeof n !== 'object' ? String(n) : text(n.props?.children)

test('U11 model: én række pr. atlet i navneorden med blok og uge, seneste pas og ét statusmærke', () => {
  const rows = athleteOverviewModel({ day: today, athletes, plans: calendarWeeks, calendarReady: true, complete: true,
    logs: { usable: true, complete: true, rows: logs }, actions: [{ athlete: { id: 'a-3' } }, { athlete: { id: 'a-4' }, reason: 'Smerte nævnt 9. nov.' }] })
  assert.deepEqual(rows.map(r => r.athlete.name), ['Syntetisk Alma', 'Syntetisk Bo', 'Syntetisk Cille', 'Syntetisk Dan'])
  const by = Object.fromEntries(rows.map(r => [r.athlete.id, r]))
  assert.equal(by['a-1'].program, 'Styrke 2 · uge 5')
  assert.equal(by['a-1'].lastSession, 'Seneste pas i går')
  assert.deepEqual(by['a-1'].badge, { tone: 'calm', text: 'Rolig' })
  // Sidste planlagte uge (start 2. nov.) sluttede 8. nov.: programmet er udløbet.
  assert.equal(by['a-2'].program, 'Grundblok · uge 2')
  assert.equal(by['a-2'].lastSession, 'Seneste pas i dag')
  assert.deepEqual(by['a-2'].badge, { tone: 'warn', text: 'Program udløbet' })
  // Kræver dit blik vinder over alt andet; intet program og intet pas siges ligeud.
  assert.equal(by['a-3'].program, 'Intet program')
  assert.equal(by['a-3'].lastSession, 'Intet pas logget')
  assert.deepEqual(by['a-3'].badge, { tone: 'gold', text: 'Kræver dit blik' })
  // Uge uden bloknavn; et sprunget sæt er ikke et pas.
  assert.equal(by['a-4'].program, 'Uge 1')
  assert.equal(by['a-4'].lastSession, 'Intet pas logget')
  assert.deepEqual(by['a-4'].badge, { tone: 'gold', text: 'Smerte nævnt 9. nov.' })
})

test('U11 model: uden kalender eller log gætter listen ikke', () => {
  const rows = athleteOverviewModel({ day: today, athletes, plans: calendarWeeks, calendarReady: false,
    logs: { usable: false, rows: [] }, actions: [] })
  for (const row of rows) {
    assert.equal(row.program, null); assert.equal(row.lastSession, null)
    assert.equal(row.badge, null, 'uden fuldt grundlag intet "Rolig"')
  }
  // Uge 6 starter 16. nov. og slutter 22. nov.: 6 dage tilbage giver mærket; 7 dage gør ikke, som i Kræver dit blik.
  const slutter = athleteOverviewModel({ day: '2026-11-16', athletes: [athletes[0]], plans: calendarWeeks, calendarReady: true,
    complete: true, logs: { usable: true, complete: true, rows: [] }, actions: [] })
  assert.deepEqual(slutter[0].badge, { tone: 'warn', text: 'Slutter snart' })
  const syv = athleteOverviewModel({ day: '2026-11-15', athletes: [athletes[0]], plans: calendarWeeks, calendarReady: true,
    complete: true, logs: { usable: true, complete: true, rows: [] }, actions: [] })
  assert.deepEqual(syv[0].badge, { tone: 'calm', text: 'Rolig' })
})

test('U11 kontrolfund: et afskåret logvindue, manglende læsninger og udaterede uger gætter ikke', () => {
  const base = { day: today, athletes, plans: calendarWeeks, calendarReady: true, actions: [] }
  // Logvinduet ramte loftet (partial): en dato vises, når den findes, ellers ingenting.
  const partial = athleteOverviewModel({ ...base, complete: false, logs: { usable: true, complete: false, rows: logs } })
  const by = Object.fromEntries(partial.map(r => [r.athlete.id, r]))
  assert.equal(by['a-1'].lastSession, 'Seneste pas i går')
  assert.equal(by['a-3'].lastSession, null)
  // Beskeder eller videoer kunne ikke læses: intet "Rolig", men advarsler fra kalenderen står.
  assert.equal(by['a-1'].badge, null)
  assert.deepEqual(by['a-2'].badge, { tone: 'warn', text: 'Program udløbet' })
  // Kun udaterede uger: ingen påstand om "Intet program".
  const undated = athleteOverviewModel({ ...base, complete: true, logs: { usable: true, complete: true, rows: [] },
    plans: { ...calendarWeeks, 'a-3': [{ id: 'w-x', athlete_id: 'a-3', week_number: 1, block_name: 'Ny', start_date: null, exercise_count: 4 }] } })
  const c = undated.find(r => r.athlete.id === 'a-3')
  assert.equal(c.program, 'Ny · uge 1 · uden dato')
  assert.equal(c.badge, null, 'usikker slutdato giver intet "Rolig"')
  // Kun fremtidige uger siger, at programmet ikke er startet.
  const future = athleteOverviewModel({ ...base, day: '2026-10-30', complete: true, logs: { usable: true, complete: true, rows: [] } })
  assert.equal(future.find(r => r.athlete.id === 'a-1').program, 'Styrke 2 · uge 4 · starter om 3 dage')
  // En ugyldig logtid gør atletens seneste pas ukendt i stedet for at springe den over.
  const bad = athleteOverviewModel({ ...base, complete: true,
    logs: { usable: true, complete: true, rows: [...logs, { athlete_id: 'a-1', logged_at: 'ikke en tid' }] } })
  assert.equal(bad.find(r => r.athlete.id === 'a-1').lastSession, null)
})

test('U11 kontrolfund: en tom gruppe vises ikke', () => {
  const all = nodes(CoachView(props({ athletes: [], readContext: { coachId: 'owner-1', day: today, athleteIds: [] } })))
  assert.deepEqual(all.filter(n => n.props?.['data-u11-gruppe']).map(n => n.props['data-u11-gruppe']), [])
})

test('U11 visning: ét tryk på en atlet åbner programmet med vej tilbage til forsiden', () => {
  const calls = []
  const view = AthleteOverview({ context: { day: today, athletes, plans: calendarWeeks, calendarReady: true, complete: true,
    logs: { usable: true, complete: true, rows: logs }, actions: [] }, openProfile: (...args) => calls.push(args) })
  const buttons = nodes(view).filter(n => n.type === 'button')
  assert.equal(buttons.length, 4)
  assert.match(text(buttons[1]), /Syntetisk Bo.*Rolig.*Styrke 2 · uge 5 · Seneste pas i går/)
  buttons[1].props.onClick()
  assert.deepEqual(calls, [[athletes[0], 'program', 'list']])
  assert.equal(buttons[1].props['aria-label'], 'Åbn programmet for Syntetisk Bo')
})

test('U11 forside: Kræver dit blik, så den åbne atletliste, så kun to lukkede grupper', () => {
  const all = nodes(CoachView(props()))
  const top = all.filter(n => n.props?.['data-u11-top'] !== undefined).map(n => n.props['data-u11-top'])
  assert.deepEqual(top, ['opgaver', 'atleter', 'hold', 'programmer'])
  const groups = all.filter(n => n.props?.['data-u11-gruppe'])
  assert.deepEqual(groups.map(n => n.props['data-u11-gruppe']), ['hold', 'programmer'])
  for (const g of groups) { assert.equal(g.type, 'details'); assert.notEqual(g.props.open, true) }
  const list = all.find(n => n.props?.['data-u11-top'] === 'atleter')
  assert.equal(list.type, 'section')
  assert.equal(nodes(list).find(n => n.type === AthleteOverview)?.props.context.athletes.length, 4)
})

test('U11 forside: hver opgave er én linje; detaljer og udkast ligger i en lukket fold under den', () => {
  const p = props({ calendarWeeks: { ...calendarWeeks, 'a-2': [week('a-2', '2026-10-19', 1, 'Grundblok')] } })
  const all = nodes(CoachView(p))
  const action = all.find(n => n.props?.['data-coach-action'])
  assert.ok(action, 'mindst én opgave')
  const line = nodes(action).find(n => n.props?.['data-u11-linje'] !== undefined)
  assert.equal(line.props.style.whiteSpace, 'nowrap')
  assert.equal(line.props.style.textOverflow, 'ellipsis')
})
