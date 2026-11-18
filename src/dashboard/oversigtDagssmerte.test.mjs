// Ordre 1683: coachens "Parathed i dag" viser dagstjekkets smerte i stedet for ømheden, når
// atleten har skrevet smerte samme dag. Ét tal, ingen modsigelse med forsidens "Smerte 6/10".
import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { installCoachTabsFixture, baseProps, ready } from './coachTabsFixture.mjs'
import { calendarDay, addCalendarDays } from '../calendarDate.js'
installCoachTabsFixture({ realReact: true })
const OversigtTab = (await import('./OversigtTab.jsx')).default
const show = extra => renderToStaticMarkup(createElement(OversigtTab, baseProps(extra))).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
const today = calendarDay(), yesterday = addCalendarDays(today, -1)
const row = (day, score) => ({ athlete_id: 'synthetic-a', logged_date: day, readiness_score: score, energy: 4, motivation: 3, stress: 3, soreness_level: 3 })
const readiness = dayPain => Object.assign(ready([row(today, 58), row(yesterday, 61)]), dayPain === undefined ? {} : { dayPain })

test('dagstjekkets smerte samme dag står i stedet for ømheden i Parathed i dag', () => {
  const out = show({ athleteReadiness: readiness({ athlete_id: 'synthetic-a', logged_date: today, pain: 6, pain_location: 'venstre knæ' }) })
  assert.match(out, /Parathed i dag/)
  assert.match(out, /Smerte 6\/10/)
  assert.match(out, /venstre knæ/)
  assert.doesNotMatch(out, /Ømhed/)
  assert.match(out, /Energi 4\/5/)
})

test('uden dagstjek, med dagstjek fra en anden dag eller uden smerte vises ømheden som før', () => {
  for (const dayPain of [undefined, null, { athlete_id: 'synthetic-a', logged_date: yesterday, pain: 6 },
    { athlete_id: 'synthetic-a', logged_date: today, pain: null }, { athlete_id: 'synthetic-b', logged_date: today, pain: 6 }]) {
    const out = show({ athleteReadiness: readiness(dayPain) })
    assert.match(out, /Ømhed 3\/5/)
    assert.doesNotMatch(out, /Smerte/)
  }
})

test('seneste check-in fra i går bruger aldrig dagens smerte', () => {
  const out = show({ athleteReadiness: Object.assign(ready([row(yesterday, 61)]), { dayPain: { athlete_id: 'synthetic-a', logged_date: today, pain: 6 } }) })
  assert.match(out, /Seneste check-in: i går/)
  assert.match(out, /Ømhed 3\/5/)
  assert.doesNotMatch(out, /Smerte/)
})
