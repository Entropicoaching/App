// Ordre 1707 (Marc 18. nov.: "føler coach siden er lidt rodet, coachens opgaver er lidt off"):
// menuens Coach Briefing tæller i Entropi 2 kun det, indbakken viser; "Aktuel opgave" forsvinder, når opgaven er klaret;
// forsiden siger ikke "n opgaver i alt", og Dine atleter gentager ikke "Kræver dit blik" som mærke.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { athleteOverviewModel } from './AthleteOverview.mjs'

const source = readFileSync(new URL('../../Dashboard.jsx', import.meta.url), 'utf8')
const expression = name => source.match(new RegExp(`const ${name} = ([\\s\\S]+?)\\r?\\n  const `))?.[1]
  ?? source.match(new RegExp(`const ${name} = ([\\s\\S]+?)\\r?\\n\\r?\\n`))?.[1]

const queue = [
  { key: 'message-a-besked', kind: 'message', label: 'Besked', color: '#c8923a' },
  { key: 'video-v1', kind: 'video', label: 'Video', color: '#67dff5' },
  { key: 'signal-a-pain', kind: 'signal', label: 'Smerte', color: '#e05a5a' },
  { key: 'automation-1', kind: 'automation', label: 'Automation', color: '#888' },
]

test('Entropi 2: menuens Coach Briefing tæller kun beskeder og videoer, som indbakken viser', () => {
  const body = expression('navPriorityCount')
  assert.ok(body, 'navPriorityCount findes i Dashboard.jsx')
  const count = new Function('e2', 'coachPriorityItems', 'coachPriorityCount', 'return ' + body)
  assert.equal(count(true, queue, queue.length), 2)
  assert.equal(count(false, queue, queue.length), 4, 'uden Entropi 2 er tallet uændret')
  assert.match(source, /<Sidebar[\s\S]*?coachPriorityCount: navPriorityCount[\s\S]*?\/>/)
  assert.match(source, /<MobilNav[\s\S]*?coachPriorityCount: navPriorityCount[\s\S]*?\/>/)
})

test('Entropi 2: Aktuel opgave står kun, mens opgaven står i køen, og får køens mærke', () => {
  const live = expression('liveProfileItem'), shown = expression('shownPriorityContext')
  assert.ok(live && shown, 'liveProfileItem og shownPriorityContext findes i Dashboard.jsx')
  const card = (e2, profilePriorityContext, coachPriorityItems) => {
    const liveProfileItem = new Function('profilePriorityContext', 'coachPriorityItems', 'return ' + live)(profilePriorityContext, coachPriorityItems)
    return new Function('e2', 'profilePriorityContext', 'liveProfileItem', 'return ' + shown)(e2, profilePriorityContext, liveProfileItem)
  }
  const opened = { key: 'message-a-besked', kind: 'message', label: 'Opgave', color: '#c8923a', summary: 'Atleten har svaret. Læs og svar i Samtale med atleten.' }
  assert.equal(card(true, opened, queue).label, 'Besked')
  assert.equal(card(true, opened, queue).summary, opened.summary)
  assert.equal(card(true, opened, queue.slice(1)), null, 'læst besked: kortet forsvinder')
  assert.equal(card(true, null, queue), null)
  assert.equal(card(false, opened, []), opened, 'uden Entropi 2 er kortet uændret')
  assert.match(source, /<ProfilHoved[\s\S]*?profilePriorityContext: shownPriorityContext[\s\S]*?\/>/)
})

test('forsiden: Dine atleter gentager ikke "Kræver dit blik" som mærke; andre mærker består', () => {
  const day = '2026-11-18'
  const rows = athleteOverviewModel({ day, athletes: [{ id: 'a', name: 'Syntetisk A' }, { id: 'b', name: 'Syntetisk B' }],
    plans: { a: [], b: [] }, calendarReady: true, complete: true, logs: { usable: true, complete: true, rows: [] },
    actions: [{ athlete: { id: 'a' } }] })
  const by = Object.fromEntries(rows.map(r => [r.athlete.id, r]))
  assert.equal(by.a.badge, null)
  assert.deepEqual(by.b.badge, { tone: 'calm', text: 'Rolig' })
})

test('forsiden: intet "n opgaver i alt"; indbakken beholder sit tal', () => {
  const screen = readFileSync(new URL('./CoachScreen.mjs', import.meta.url), 'utf8')
  // Ordre 2005a: tallet står kun i indbakkens egen gren (inbox ? ... : forsiden), og der står det én gang.
  const lines = screen.split(/\r?\n/)
  const at = lines.findIndex(l => l.includes("'opgaver'} i alt"))
  assert.ok(at > 0, 'linjen findes')
  assert.equal(lines.filter(l => l.includes("'opgaver'} i alt")).length, 1)
  assert.match(lines.slice(Math.max(0, at - 3), at).join('\n'), /inbox \? h\('section', \{ 'aria-label': 'Ulæste beskeder og indsendelser'/)
})
