// Ordre 2184: "Kræver dit blik" når atleten ikke følger kostplanen (basemåltider og fri pulje). Syntetiske data.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup as render } from 'react-dom/server'
import { addCalendarDays } from '../../calendarDate.js'
import { productionFixture, day, athleteId } from './coachProductionFixture.mjs'
import { coachHomeModel } from './coachModel.mjs'
import { CoachView } from './CoachScreen.mjs'
import { followsPlan, RANK } from './coachAttention.mjs'

const BASE = ['Morgen', 'Middag', 'Aften']
const dates = n => Array.from({ length: n }, (_, i) => addCalendarDays(day, -n + i))
// Plandage med et niveau (friPct 20 giver 3 basemåltider og en pulje på 20 % af 2000 kcal = 400).
const planDays = (list, friPct = 20) => list.map(date => ({ date, state: 'approved', targets: { kcal: 2000, protein: 150 },
  ...(friPct > 0 ? { friPct, maaltider: BASE } : {}) }))
const meal = (date, name, kcal = 500) => ({ athlete_id: athleteId, date, meal: name, kcal, protein: 30 })
const fri = (date, kcal) => meal(date, `Fri: ${kcal} kcal`, kcal)
const baseRows = list => list.flatMap(date => BASE.map(name => meal(date, name)))

test('følger planen: ingen grund; under halvdelen af basen: grund', () => {
  const d = dates(7)
  assert.equal(followsPlan({ planDays: planDays(d), meals: baseRows(d) }, day), null)
  // Kun ét af tre basemåltider på hver dag: 7 af 21 fulgt.
  const kunEt = d.map(date => meal(date, 'Morgen'))
  assert.deepEqual(followsPlan({ planDays: planDays(d), meals: kunEt }, day), { reason: 'Følger ikke kostplanen' })
  // Præcis halvdelen (6 af 12) er ikke "under halvdelen"; 5 af 12 er.
  const fire = dates(4), toMaaltider = date => BASE.slice(0, 2).map(name => meal(date, name))
  const halv = [...fire.slice(0, 3).flatMap(toMaaltider), meal(fire[3], 'Snack')]
  assert.equal(followsPlan({ planDays: planDays(fire), meals: halv }, day), null)
  assert.ok(followsPlan({ planDays: planDays(fire), meals: halv.slice(1) }, day))
})

test('fri pulje ikke holdt på de fleste vurderede dage giver en grund, holdt på halvdelen gør ikke', () => {
  const d = dates(6)
  const over = date => fri(date, 900)
  const meals = date => [...baseRows([date])]
  const rows = (oever) => d.flatMap((date, i) => [...meals(date), i < oever ? over(date) : fri(date, 100)])
  assert.equal(followsPlan({ planDays: planDays(d), meals: rows(3) }, day), null)
  assert.deepEqual(followsPlan({ planDays: planDays(d), meals: rows(4) }, day), { reason: 'Følger ikke kostplanen' })
})

test('kræver mindst 3 vurderede dage med niveau over 0 %', () => {
  const d = dates(7)
  const kunMorgen = list => list.map(date => meal(date, 'Morgen'))
  assert.equal(followsPlan({ planDays: planDays(d), meals: kunMorgen(d.slice(0, 2)) }, day), null)
  assert.ok(followsPlan({ planDays: planDays(d), meals: kunMorgen(d.slice(0, 3)) }, day))
  // Niveau 0 % kender ingen basemåltider og ingen pulje: ingen grund, uanset logning.
  assert.equal(followsPlan({ planDays: planDays(d, 0), meals: kunMorgen(d) }, day), null)
  // Dage uden logning tæller ikke som vurderede.
  assert.equal(followsPlan({ planDays: planDays(d), meals: [] }, day), null)
})

test('kun de 7 afsluttede dage tæller; i dag og ældre dage ignoreres; dagskvitteringer tæller ikke', () => {
  const gamle = dates(14).slice(0, 7), i_dag = [day]
  const kunMorgen = list => list.map(date => meal(date, 'Morgen'))
  assert.equal(followsPlan({ planDays: planDays([...gamle, ...i_dag]), meals: kunMorgen([...gamle, ...i_dag]) }, day), null)
  const kvittering = dates(7).map(date => ({ athlete_id: athleteId, date, meal: '[appData2-day-v1] {}', kcal: 0, protein: 0 }))
  assert.equal(followsPlan({ planDays: planDays(dates(7)), meals: kvittering }, day), null)
  assert.equal(followsPlan(null, day), null)
  assert.equal(followsPlan({ planDays: 'x', meals: [] }, day), null)
})

// Hele vejen gennem forsidens model: coachNutrition.plan med to 7-dages læsninger (14 dage).
function fixture({ rows, protein = 120 } = {}) {
  const p = productionFixture()
  const start = addCalendarDays(day, -14), end = addCalendarDays(day, -1)
  const days = Array.from({ length: 14 }, (_, i) => addCalendarDays(start, i))
  p.coachNutrition.rows = p.coachNutrition.rows.map(r => ({ ...r, protein }))
  p.coachNutrition.plan = { from: start, through: end, athletes: [{ athlete_id: athleteId, days: planDays(days) }],
    meals: rows.map(r => ({ ...r })) }
  p.calendarWeeks[athleteId] = ['2026-11-02', '2026-11-09', '2026-11-16'].map((start_date, i) => ({ start_date, week_number: 45 + i, session_count: 1, exercise_count: 1 }))
  p.u3Data = true
  p.u3Attention = { day, ids: [athleteId], complete: true, readiness: [], notes: [] }
  return p
}
const liste = p => coachHomeModel(p, day).actions.find(r => r.athlete.id === athleteId)
const kunMorgen = dates(7).map(date => meal(date, 'Morgen'))

test('forsiden: grunden står under Kræver dit blik med fast, neutral tekst', () => {
  const r = liste(fixture({ rows: kunMorgen }))
  assert.equal(r.reason, 'Følger ikke kostplanen')
  assert.equal(r.rank, RANK.followsPlan)
  assert.doesNotMatch(r.reason, /advarsel|fare|alarm|kritisk|dårlig/i)
  const html = render(h(CoachView, { ...fixture({ rows: kunMorgen }), today: day }))
  assert.match(html, /Følger ikke kostplanen/)
})

test('forsiden: følger atleten planen, står der intet', () => {
  assert.equal(liste(fixture({ rows: baseRows(dates(7)) })), undefined)
})

test('rangering: protein under målet går forud, planen står som "Også"', () => {
  const r = liste(fixture({ rows: kunMorgen, protein: 50 }))
  assert.equal(r.reason, 'Protein under målet')
  assert.equal(r.rank, RANK.lowProtein)
  assert.ok(RANK.lowProtein < RANK.followsPlan)
  assert.deepEqual(r.reasons, ['Protein under målet', 'Følger ikke kostplanen'])
  assert.match(render(h(CoachView, { ...fixture({ rows: kunMorgen, protein: 50 }), today: day })), /Også: følger ikke kostplanen/)
})

test('ferie og ugyldig kilde: ingen grund', () => {
  const ferie = fixture({ rows: kunMorgen })
  ferie.athletes[0].vacation_until = '2026-11-20'
  assert.equal(liste(ferie), undefined)
  const forkert = fixture({ rows: kunMorgen })
  forkert.coachNutrition.plan.through = day
  assert.equal(liste(forkert), undefined)
  const uden = fixture({ rows: kunMorgen })
  uden.coachNutrition.plan = null
  assert.equal(liste(uden), undefined)
  const u3Fra = fixture({ rows: kunMorgen })
  u3Fra.u3Data = false
  assert.equal(liste(u3Fra), undefined)
})
