import test from 'node:test'
import assert from 'node:assert/strict'

// Genuine React gate discovered by npm test. Hermetic copies without installed
// dependencies leave this explicitly pending for Dhurva; never substitute React.
let h, renderToStaticMarkup, Home, HomeSession, missing = false
try {
  ;({ createElement: h } = await import('react'))
  ;({ renderToStaticMarkup } = await import('react-dom/server'))
} catch (error) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND' || !/Cannot find package '(react|react-dom)'/.test(error.message)) throw error
  missing = true
}
if (!missing) {
  ;({ default: Home } = await import('./AthleteHome.mjs'))
  ;({ default: HomeSession } = await import('./HomeSession.mjs'))
}
const gate = { skip: missing ? 'React/react-dom absent in pinned copy; required genuine React gate at Dhurva merge.' : false }
const week = { id: 'synthetic-week', athlete_id: 'synthetic-a', start_date: '2026-11-02', week_number: 1,
  sessions: [{ id: 'synthetic-session', title: 'Syntetisk pas', exercises: [
    { id: 'synthetic-exercise', name: 'Syntetisk løft', sets: 2, reps: 5 },
  ] }] }
const props = { enabled: true, athlete: { id: 'synthetic-a' }, allWeeks: [week], currentWeek: week,
  now: new Date('2026-11-03T12:00:00Z'), exerciseLogs: [], storage: null,
  onStartSession() {}, onLogSet() {}, setLogInputs() {}, parsePlannedRpe() {} }
const render = (Component, input) => renderToStaticMarkup(h(Component, input))

test('genuine React renders local loading with a disabled start and preserves the program', gate, () => {
  const html = render(Home, { ...props, sessionLoading: true })
  assert.match(html, /<button[^>]*disabled=""[^>]*>Start dagens pas<\/button>/)
  assert.match(html, /Syntetisk pas/); assert.match(html, /Se mit program/)
  const ready = render(Home, props)
  assert.match(ready, />Start dagens pas<\/button>/)
  assert.doesNotMatch(ready, /<button[^>]*disabled=""[^>]*>Start dagens pas<\/button>/)
  const wrapped = render(HomeSession, props)
  assert.ok(wrapped.indexOf('Dit valgte pas') < wrapped.indexOf('Se mit program'), 'load/error host belongs to the session card')
})

test('genuine React HomeSession keeps OFF and read-only preview free of session actions', gate, () => {
  assert.equal(render(HomeSession, { enabled: false }), '')
  const html = render(HomeSession, { ...props, onLogSet: undefined, setLogInputs: undefined })
  assert.doesNotMatch(html, /Start dagens pas|Start næste pas|Indlæser passet|Prøv igen|<dialog/)
  assert.match(html, /Syntetisk pas/)
})
