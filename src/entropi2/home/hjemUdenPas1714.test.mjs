// Ordre 1714 (Marc 18. nov.: "er igang emd at unboarde en klient"): Hjem uden pas siger ét budskab,
// og ferie med slutdato viser datoen og dagen efter.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import AthleteHome from './AthleteHome.mjs'

const base = { enabled: true, athlete: { id: 'synthetic-athlete', name: 'Testfornavn Testefternavn' }, today: '2026-11-18',
  now: new Date('2026-11-18T12:00:00Z'), allWeeks: [], currentWeek: undefined, exerciseLogs: [], storage: { getItem: () => null },
  setTab() {}, onStartSession() {} }
const render = extra => renderToStaticMarkup(h(AthleteHome, { ...base, ...extra }))
const count = (html, re) => (html.match(re) || []).length
const buttons = html => [...html.matchAll(/<button[^>]*>(.*?)<\/button>/g)].map(m => m[1])

test('1714: uden program står ét budskab og højst én handling mod coachen', () => {
  const page = render({})
  const html = page.slice(page.indexOf('data-u9-pas'), page.indexOf('data-home-onboarding'))
  assert.match(html, /Din coach er ved at lægge dit program/)
  assert.doesNotMatch(html, /Intet program endnu|Se programmet eller kontakt din coach|Se mit program/)
  assert.equal(count(html, /<h2/g), 1)
  assert.equal(count(html, /<p[ >]/g), 0)
  assert.equal(count(page, />Skriv til din coach<\/button>/g), 1)
  assert.equal(count(page, /Din coach<\/button>/g), 0)
  assert.deepEqual(buttons(html), ['Skriv til din coach'])
})

test('1714: ferie med slutdato viser "til" og dagen efter, uden dato som før', () => {
  const html = render({ onHoliday: true, athlete: { ...base.athlete, vacation_until: '2026-11-22' } })
  assert.match(html, /Du er på ferie til 22\. nov\./)
  assert.match(html, /Din træning venter fra 23\. nov\./)
  const plain = render({ onHoliday: true })
  assert.match(plain, /Du er på ferie/)
  assert.doesNotMatch(plain, /ferie til/)
  assert.match(plain, /Din træning venter, når du er tilbage\./)
})

test('1714: ugyldig eller umulig slutdato falder tilbage til den gamle ferietekst; månedsskifte og årsskifte tæller rigtigt', () => {
  for (const vacation_until of ['2026-02-30', 'x', null, '2026-11-22T10:00:00Z']) {
    const html = render({ onHoliday: true, athlete: { ...base.athlete, vacation_until } })
    assert.doesNotMatch(html, /ferie til|fra null/)
    assert.match(html, /Din træning venter, når du er tilbage\./)
  }
  assert.match(render({ onHoliday: true, athlete: { ...base.athlete, vacation_until: '2026-12-31' } }), /ferie til 31\. dec\..*venter fra 1\. jan\./)
  assert.match(render({ onHoliday: true, athlete: { ...base.athlete, vacation_until: '2026-02-28' } }), /venter fra 1\. mar\./)
})
