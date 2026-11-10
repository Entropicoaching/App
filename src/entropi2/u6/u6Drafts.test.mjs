import test from 'node:test'
import assert from 'node:assert/strict'
import { addCalendarDays } from '../../calendarDate.js'
import { productionFixture, day, athleteId } from '../coach/coachProductionFixture.mjs'
import { coachHomeModel } from '../coach/coachModel.mjs'
import { attentionFor } from '../coach/coachAttentionRead.mjs'
import { attentionDraft } from './coachDraft.mjs'
import { offerCoachDraft, takeCoachDraft, applyCoachDraft, DRAFT_TTL_MS } from './draftHandoff.mjs'

// Kun syntetiske data. day = 2026-11-03.
const NOTE = 'Syntetisk: det gjorde ondt i knæet på sidste sæt'
const readiness = (offset, score, sore = 2) => ({ athlete_id: athleteId, logged_date: addCalendarDays(day, -offset), readiness_score: score, soreness_level: sore })
const falling = [readiness(1, 55), readiness(2, 56), readiness(3, 54), ...Array.from({ length: 10 }, (_, i) => readiness(4 + i, i % 2 ? 72 : 68))]
function fixture({ notes = [], rows = [] } = {}) {
  const p = productionFixture()
  p.coachNutrition.rows = p.coachNutrition.rows.map(r => ({ ...r, protein: 120 }))
  p.calendarWeeks[athleteId] = ['2026-11-02', '2026-11-09', '2026-11-16'].map((start_date, i) => ({ start_date, week_number: 45 + i, session_count: 1, exercise_count: 1 }))
  p.u3Data = true
  p.u3Attention = { day, ids: [athleteId], complete: true, readiness: rows, notes }
  return p
}
const draftOf = p => {
  const model = coachHomeModel(p, day)
  const row = model.actions.find(r => r.athlete.id === athleteId)
  return attentionDraft({ row, attention: attentionFor(p.u3Attention, athleteId, day), weeks: model.plans[athleteId], day })
}

test('U6 2/5: readiness-rækken får et udkast med tallene bag', () => {
  const draft = draftOf(fixture({ rows: falling }))
  assert.equal(draft.athleteId, athleteId)
  assert.equal(draft.requiresCoachReview, true)
  assert.match(draft.text, /^Hej Syntetisk\. Jeg kan se, at din readiness de sidste 3 dage ligger på 55 i snit mod 70 i ugerne før\./)
})

test('U6 2/5: smerte citerer aldrig noten, kun datoen', () => {
  const draft = draftOf(fixture({ notes: [{ athlete_id: athleteId, logged_at: '2026-10-29T17:00:00Z', note: NOTE }] }))
  assert.match(draft.text, /nævnte smerte i din log 29\. okt\./)
  assert.doesNotMatch(draft.text, /knæet/)
})

test('U6 2/5: program, manglende log og beskeder', () => {
  const athlete = { id: athleteId, name: 'Syntetisk atlet' }
  assert.match(attentionDraft({ row: { key: `program-${athleteId}`, athlete, reason: 'Programmet slutter om 3 dage' } }).text,
    /^Hej Syntetisk\. Dit program slutter om 3 dage\./)
  assert.match(attentionDraft({ row: { key: `logs-${athleteId}`, athlete, reason: 'Ingen log i afsluttet programuge 44; årsagen er ukendt' } }).text,
    /ikke se nogen log fra uge 44/)
  assert.equal(attentionDraft({ row: { key: 'message-x', athlete, item: { kind: 'message' }, reason: '2 ulæste beskeder' } }), null)
  // Uden de data, rækken bygger på, intet udkast.
  assert.equal(attentionDraft({ row: { key: 'u3-readiness-x', athlete, u3: 'readiness' }, attention: null, day }), null)
})

test('U6 2/5: udkastet lægges kun i et tomt felt for samme atlet, og kun én gang', () => {
  const controller = (snapshot) => {
    const listeners = new Set(), drafts = []
    return { drafts, emit(s) { for (const fn of [...listeners]) fn(s) },
      subscribe(fn) { listeners.add(fn); fn(snapshot); return () => listeners.delete(fn) }, draft(t) { drafts.push(t); return true }, listeners }
  }
  offerCoachDraft({ athleteId: 'a', text: 'Hej.' }, 1000)
  const c = controller({ available: true, loaded: false, athleteId: 'a', draft: '' })
  applyCoachDraft(c, 'a', () => 1000)
  assert.deepEqual(c.drafts, [])
  c.emit({ available: true, loaded: true, athleteId: 'a', draft: '' })
  c.emit({ available: true, loaded: true, athleteId: 'a', draft: '' })
  assert.deepEqual(c.drafts, ['Hej.'])
  assert.equal(takeCoachDraft('a', 1000), null)

  offerCoachDraft({ athleteId: 'a', text: 'Hej.' }, 1000)
  const typed = controller({ available: true, loaded: true, athleteId: 'a', draft: 'Min egen tekst' })
  applyCoachDraft(typed, 'a', () => 1000)
  assert.deepEqual(typed.drafts, [], 'coachens egen tekst overskrives aldrig')

  offerCoachDraft({ athleteId: 'a', text: 'Hej.' }, 1000)
  const other = controller({ available: true, loaded: true, athleteId: 'b', draft: '' })
  applyCoachDraft(other, 'b', () => 1000)
  assert.deepEqual(other.drafts, [])
  assert.equal(takeCoachDraft('a', 1000 + DRAFT_TTL_MS + 1), null, 'et gammelt udkast udløber')
})

let React, render, CoachView, missing = false
try {
  React = await import('react')
  ;({ renderToStaticMarkup: render } = await import('react-dom/server'))
} catch (error) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND' || !/Cannot find package '(react|react-dom)'/.test(error.message)) throw error
  missing = true
}
if (!missing) ({ CoachView } = await import('../coach/CoachScreen.mjs'))
const gate = { skip: missing ? 'Kræver ægte React.' : false }
// CoachView er uden hooks; knappen findes i elementtræet, og dens onClick kaldes som et tryk.
function findButton(node, text) {
  if (!node || typeof node !== 'object') return null
  if (Array.isArray(node)) { for (const n of node) { const f = findButton(n, text); if (f) return f } return null }
  if (node.type === 'button' && [].concat(node.props?.children).join('') === text) return node
  return findButton(node.props?.children, text)
}

test('U6 2/5: "Skriv" åbner samtalen med udkastet og sender intet', gate, () => {
  const opened = [], p = fixture({ rows: falling })
  p.openProfile = (...args) => opened.push(args)
  p.openCoachPriorityItem = () => {}
  const props = { ...p, enabled: true, today: new Date(`${day}T12:00:00Z`) }
  assert.match(render(React.createElement(CoachView, { ...props, u6Drafts: true })), /Udkast: Hej Syntetisk\. Jeg kan se, at din readiness/)
  const skriv = findButton(CoachView({ ...props, u6Drafts: true }), 'Skriv')
  assert.ok(skriv)
  skriv.props.onClick()
  assert.equal(opened.length, 1)
  assert.equal(opened[0][0].id, athleteId)
  assert.equal(opened[0][1], 'beskeder')
  assert.match(takeCoachDraft(athleteId), /^Hej Syntetisk\./)
  assert.doesNotMatch(render(React.createElement(CoachView, { ...props, u6Drafts: false })), /Udkast:/)
})
