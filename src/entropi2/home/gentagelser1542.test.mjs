// Ordre 1542 (Marc 16. nov.: "pas på at det ikke er gentagelser på siderne"): på Hjem står vægt,
// dagsform og antal sæt kun ét sted, og datoen i toppen er dansk.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import AthleteHome from './AthleteHome.mjs'
import QuickLogs from './QuickLogs.mjs'

const props = { enabled: true, athlete: { id: 'synthetic-athlete' }, today: '2026-11-04',
  now: new Date('2026-11-04T12:00:00Z'), weightLogs: [], readinessLog: null,
  storage: { getItem: () => null },
  saveReadiness() {}, setReadinessInput() {}, logWeight() {}, setWeightInput() {} }
const count = (html, re) => (html.match(re) || []).length

test('1542: med "I dag"-kortet står vægt og dagsform ét sted på Hjem', () => {
  const html = renderToStaticMarkup(h(AthleteHome, props))
  assert.equal(count(html, /data-u5-weight/g), 1)
  assert.doesNotMatch(html, />Vægt i dag</)
  const quick = html.slice(html.indexOf('data-home-quick-logs'), html.indexOf('data-home-mere'))
  assert.match(quick, /hidden=""[^>]*>Dagsform<\/button>/)
  assert.doesNotMatch(quick, /data-home-readiness-fast/)
})

test('1542: uden "I dag"-kortet er knapperne som før', () => {
  const html = renderToStaticMarkup(h(AthleteHome, { ...props, u5Today: false }))
  assert.match(html, />Dagsform<\/button>/); assert.match(html, />Vægt i dag<\/button>/)
  assert.doesNotMatch(html, /hidden=""[^>]*>Dagsform/)
  const alone = renderToStaticMarkup(h(QuickLogs, props))
  assert.match(alone, />Vægt i dag<\/button>/)
})

test('1542: antal sæt står kun i pas-kortet, og datoen i toppen er dansk', () => {
  const card = readFileSync(new URL('./today/TodayCard.mjs', import.meta.url), 'utf8')
  assert.doesNotMatch(card, /Træning · \$\{training\.logged/)
  const ramme = readFileSync(new URL('../../athlete/Ramme.jsx', import.meta.url), 'utf8')
  assert.match(ramme, /danskDato === true \? dagTekst\(today\(\)\) : today\(\)/)
  const body = ramme.slice(ramme.indexOf('function dagTekst'), ramme.indexOf('function Ramme'))
  const dagTekst = new Function('UGEDAGE', 'MAANEDER', `${body}; return dagTekst`)(
    ['søn.', 'man.', 'tirs.', 'ons.', 'tors.', 'fre.', 'lør.'],
    ['jan.', 'feb.', 'mar.', 'apr.', 'maj', 'jun.', 'jul.', 'aug.', 'sep.', 'okt.', 'nov.', 'dec.'])
  assert.equal(dagTekst('2026-11-16'), 'man. 16. nov.')
  assert.equal(dagTekst('2026-11-22'), 'søn. 22. nov.')
  assert.equal(dagTekst('2027-01-01'), 'fre. 1. jan.')
  assert.equal(dagTekst(null), '')
})
