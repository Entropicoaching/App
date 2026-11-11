import test from 'node:test'
import assert from 'node:assert/strict'

// U9 punkt 1 (Marc 11. nov.): "det første man skal møde er genvej til ens aktuelle pas", 80 % af gangene.
// Dagens eller næste pas står derfor som det første kort under overskriften; resten af Hjem rykker ned.
let React, render, Home, missing = false
try {
  React = await import('react')
  ;({ renderToStaticMarkup: render } = await import('react-dom/server'))
} catch (error) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND' || !/Cannot find package '(react|react-dom)'/.test(error.message)) throw error
  missing = true
}
if (!missing) ({ default: Home } = await import('./AthleteHome.mjs'))
const gate = { skip: missing ? 'Kræver ægte React.' : false }
const h = (...a) => React.createElement(...a)
const A = 'atlet-syntetisk-u9'
const week = { id: 'u9-uge', athlete_id: A, start_date: '2026-11-09', week_number: 2,
  sessions: [{ id: 'u9-pas', weekday: 1, title: 'Syntetisk pas', exercises: [{ id: 'u9-ex', name: 'Squat', sets: 2, reps: '5' }] }] }
const props = { enabled: true, athlete: { id: A, name: 'Syntetisk Atlet' }, now: new Date('2026-11-10T12:00:00Z'), storage: null,
  allWeeks: [week], currentWeek: week, exerciseLogs: [], onStartSession() {}, setLogInputs() {}, onLogSet() {}, setTab() {},
  weightLogs: [], readinessLog: null, setReadinessInput() {}, setWeightInput() {}, saveReadiness() {}, logWeight() {},
  readHomeReadiness: async () => ({ status: 'loading' }), u5Today: true }

test('U9 1: passet er det første kort på Hjem, før "I dag", påmindelser og alt andet', gate, () => {
  const html = render(h(Home, props))
  const pas = html.indexOf('aria-label="Dit næste pas"')
  assert.ok(pas > 0)
  assert.ok(pas < html.indexOf('data-u5-today'), 'passet står over "I dag"')
  assert.ok(pas < html.indexOf('data-home-quick-logs'))
  assert.ok(pas < html.indexOf('data-film-set'))
  // Intet andet kort mellem overskriften og passet.
  assert.doesNotMatch(html.slice(html.indexOf('</h1>'), html.lastIndexOf('<section', pas)), /<section/)
})

test('U9 1: genvejen er stor: hele kortet er markeret som genvej, og Start står øverst i kortet', gate, () => {
  const html = render(h(Home, props))
  const start = html.indexOf('data-u9-pas')
  assert.ok(start > 0, 'kortet bærer data-u9-pas')
  const kort = html.slice(start, html.indexOf('</section>', start))
  assert.match(kort, />Start dagens pas</)
  assert.match(kort, /Syntetisk pas/)
  assert.equal((html.match(/>Start (dagens|næste) pas</g) ?? []).length, 1)
})
