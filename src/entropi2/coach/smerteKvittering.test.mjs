// Ordre 1711: coachen kan kvittere en smerte- eller ømhedsadvarsel. Rød på main: ingen kvittering findes.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup as render } from 'react-dom/server'
import { addCalendarDays } from '../../calendarDate.js'
import { productionFixture, day, athleteId } from './coachProductionFixture.mjs'
import { coachHomeModel } from './coachModel.mjs'
import { CoachView } from './CoachScreen.mjs'
import { erKvitteret, medKvittering, indlaesKvitteringer, gemKvitteringer } from './smerteKvittering.mjs'

const NOTE = 'Syntetisk: det gjorde ondt i knæet på sidste sæt'
function fixture({ notes = [], readiness = [], kvittering } = {}) {
  const p = productionFixture()
  p.coachNutrition.rows = p.coachNutrition.rows.map(r => ({ ...r, protein: 120 }))
  p.calendarWeeks[athleteId] = ['2026-11-02', '2026-11-09', '2026-11-16'].map((start_date, i) => ({ start_date, week_number: 45 + i, session_count: 1, exercise_count: 1 }))
  p.u3Data = true
  p.u3Attention = { day, ids: [athleteId], complete: true, readiness, notes }
  if (kvittering) p.smerteKvittering = kvittering
  return p
}
const row = p => coachHomeModel(p, day).actions.find(r => r.athlete.id === athleteId)
const note = date => ({ athlete_id: athleteId, logged_at: `${date}T17:00:00Z`, note: NOTE })
const ome = (offset, level = 4) => ({ athlete_id: athleteId, logged_date: addCalendarDays(day, -offset), readiness_score: 70, soreness_level: level })

test('kvitteret smerteadvarsel skjules, og en ny smerte efter kvitteringen viser den igen', () => {
  const foerste = row(fixture({ notes: [note('2026-10-29')] }))
  assert.equal(foerste.reason, 'Smerte nævnt 29. okt.')
  assert.deepEqual(foerste.smerte, { kind: 'notes', date: '2026-10-29', level: null })
  const kvittering = medKvittering({}, athleteId, foerste.smerte)
  assert.equal(row(fixture({ notes: [note('2026-10-29')], kvittering })), undefined)
  assert.equal(row(fixture({ notes: [note('2026-11-02'), note('2026-10-29')], kvittering })).reason, 'Smerte nævnt 2. nov.')
})

test('ømhed: samme antal dage forbliver kvitteret, flere dage viser den igen', () => {
  const tre = [ome(1), ome(2), ome(5)]
  const r = row(fixture({ readiness: tre }))
  assert.equal(r.reason, 'Ømhed 3 af 7 dage')
  const kvittering = medKvittering({}, athleteId, r.smerte)
  assert.equal(row(fixture({ readiness: tre, kvittering })), undefined)
  assert.equal(row(fixture({ readiness: [...tre, ome(3)], kvittering })).reason, 'Ømhed 4 af 7 dage')
})

test('erKvitteret: højere niveau eller nyere dato viser igen, en anden type er ikke kvitteret', () => {
  const k = medKvittering({}, 'a', { kind: 'daily', date: '2026-11-01', level: 6 })
  assert.equal(erKvitteret(k, 'a', { kind: 'daily', date: '2026-11-01', level: 6 }), true)
  assert.equal(erKvitteret(k, 'a', { kind: 'daily', date: '2026-11-01', level: 7 }), false)
  assert.equal(erKvitteret(k, 'a', { kind: 'daily', date: '2026-11-02', level: 5 }), false)
  assert.equal(erKvitteret(k, 'a', { kind: 'notes', date: '2026-11-01', level: null }), false)
  assert.equal(erKvitteret(k, 'b', { kind: 'daily', date: '2026-11-01', level: 6 }), false)
})

test('kvitteringen gemmes lokalt pr. coach og kan ikke rammes af ødelagt lager', () => {
  const lager = new Map()
  const storage = { getItem: k => lager.has(k) ? lager.get(k) : null, setItem: (k, v) => lager.set(k, v) }
  const k = medKvittering({}, 'a', { kind: 'notes', date: '2026-11-01', level: null })
  assert.equal(gemKvitteringer('coach-1', k, storage), true)
  assert.deepEqual(indlaesKvitteringer('coach-1', storage), k)
  assert.deepEqual(indlaesKvitteringer('coach-2', storage), {})
  lager.set('entropi2:smerte-kvittering:coach-1', '{ikke json')
  assert.deepEqual(indlaesKvitteringer('coach-1', storage), {})
  assert.equal(gemKvitteringer('coach-1', k, { setItem() { throw new Error('fuld') } }), false)
})

test('forsiden viser Kvittér på en række med smerte og kalder onKvitterSmerte; ikke uden smerte', () => {
  const kald = []
  const html = render(h(CoachView, { ...fixture({ notes: [note('2026-10-29')] }), onKvitterSmerte: (...a) => kald.push(a) }))
  assert.match(html, /data-coach-kvitter-smerte="synthetic-a"/)
  assert.match(html, /Kvittér smerte/)
  assert.doesNotMatch(render(h(CoachView, fixture())), /Kvittér smerte/)
})
