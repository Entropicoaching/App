import test from 'node:test'
import assert from 'node:assert/strict'
import { homeWeekSnapshot } from './homeTrackingRead.mjs'

// App npm test discovers these tests. Never substitute a synthetic renderer for
// React: absent dependencies remain an explicit required Dhurva merge gate.
let h, renderToStaticMarkup, Home, QuickLogs, AthleteWeek, missing = false
try {
  ;({ createElement: h } = await import('react'))
  ;({ renderToStaticMarkup } = await import('react-dom/server'))
} catch (error) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND' || !/Cannot find package '(react|react-dom)'/.test(error.message)) throw error
  missing = true
}
if (!missing) {
  ;({ default: Home } = await import('./AthleteHome.mjs'))
  ;({ default: QuickLogs } = await import('./QuickLogs.mjs'))
  ;({ default: AthleteWeek } = await import('../tracking/ugeatlet/AthleteWeek.mjs'))
}
const gate = { skip: missing ? 'Pinned copy lacks React/react-dom. Run with genuine React at Dhurva merge; no install allowed here.' : false }
const athlete = { id: 'synthetic-home', name: 'Testfornavn Testefternavn' }, today = '2026-11-04'
const props = { enabled: true, athlete, now: new Date('2026-11-04T12:00:00Z'), today, storage: null,
  weightLogs: [], readinessLog: null, setReadinessInput() {}, setWeightInput() {}, saveReadiness() {}, logWeight() {} }
const render = (Component, input) => renderToStaticMarkup(h(Component, input))

test('real React Home keeps the greeting, film action, check-in and one initially closed quick row', gate, () => {
  const html = render(Home, props)
  assert.match(html, /Dit overblik, Testfornavn/); assert.doesNotMatch(html, /Testefternavn/)
  assert.equal((html.match(/data-home-quick-logs=/g) ?? []).length, 1)
  assert.equal((html.match(/data-home-checkin=/g) ?? []).length, 1)
  assert.match(html, /data-film-set=/)
  // The weekly check-in owns a form; only the quick-log row must start closed.
  const quick = html.slice(html.indexOf('data-home-quick-logs='), html.indexOf('data-film-set='))
  assert.ok(quick.length > 0); assert.doesNotMatch(quick, /<form|<section/)
  assert.match(html, /aria-expanded="false"/)
})

test('real React previews and OFF have no writing buttons and inspect no history', gate, () => {
  const unreadable = new Proxy({}, { get() { assert.fail('preview history read') } })
  assert.equal(render(QuickLogs, { ...props, sessionReadOnly: true, trackingData: unreadable }), '')
  // React copies props into the element, so guard history/read access instead of the athlete getter.
  assert.equal(render(Home, { enabled: false, athlete, trackingData: unreadable,
    readHomeReadiness() { assert.fail('OFF history read') } }), '')
})

test('real React compact week presents only measured wellbeing with sparse-data honesty', gate, () => {
  const snapshot = homeWeekSnapshot({ status: 'ready', complete: true, athleteId: athlete.id, today,
    readinessRows: [{ athlete_id: athlete.id, logged_date: '2026-11-03', sleep_hours: 0, energy: 2 }] }, athlete.id, today)
  const html = render(AthleteWeek, { enabled: true, compactHome: true, snapshot })
  assert.match(html, /2026-10-28/); assert.match(html, /2026-11-03/)
  assert.match(html, /1\/7 dage/); assert.match(html, /For lidt data/)
  assert.doesNotMatch(html, /0 pas|Kost i forhold|Bedste sæt|<h2|NaN|Infinity/)
})

test('real React full weekly module preserves its existing five-domain presentation', gate, () => {
  const snapshot = { status: 'ready', complete: true, athleteId: athlete.id, endDate: '2026-11-03',
    sessions: [], daily: [], nutritionDays: [], strength: null }
  const html = render(AthleteWeek, { enabled: true, snapshot })
  for (const label of ['Pas gennemført','Bedste sæt','Søvn i gennemsnit','Dagsform i gennemsnit','Kost i forhold til mål'])
    assert.ok(html.includes(label), label)
})
