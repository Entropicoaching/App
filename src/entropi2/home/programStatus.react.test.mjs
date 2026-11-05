import test from 'node:test'
import assert from 'node:assert/strict'

// Genuine React gate, discovered by npm test. Missing dependencies are explicit;
// the synthetic event tests never substitute for this integration gate.
let h, renderToStaticMarkup, Home, host, missing = false
try {
  ;({ createElement: h } = await import('react'))
  ;({ renderToStaticMarkup } = await import('react-dom/server'))
} catch (error) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND' || !/Cannot find package '(react|react-dom)'/.test(error.message)) throw error
  missing = true
}
if (!missing) {
  ;({ default: Home } = await import('./AthleteHome.mjs'))
  host = await import('../../athlete/samletProeveFixture.mjs')
  test.after(host.dispose)
}
const gate = { skip: missing ? 'React/react-dom absent in pinned copy; genuine React gate required at Dhurva merge.' : false }
const props = { enabled: true, athlete: { id: 'synthetic-react-athlete' }, storage: null,
  now: new Date('2026-11-04T12:00:00Z'), allWeeks: [], currentWeek: null, exerciseLogs: [], onRetryProgram() {} }
const render = extra => renderToStaticMarkup(h(Home, { ...props, ...extra }))

test('real React distinguishes program loading, read failure and confirmed empty', gate, () => {
  const loading = render({ programLoading: true, programError: true })
  assert.match(loading, /aria-busy="true"/)
  assert.match(loading, /role="status"[^>]*>Indlæser dit program/)
  assert.doesNotMatch(loading, /Intet program endnu|kunne ikke hentes|Hent igen/)
  const error = render({ programError: true })
  assert.match(error, /role="alert"[^>]*>Programmet kunne ikke hentes/)
  assert.match(error, />Hent igen<\/button>/)
  assert.doesNotMatch(error, /Intet program endnu|genindlæse siden/)
  const empty = render()
  assert.match(empty, /Intet program endnu/)
  assert.doesNotMatch(empty, /Indlæser dit program|kunne ikke hentes|Hent igen/)
})

test('real React OFF stays inert and absent retry capability is disabled', gate, () => {
  assert.equal(render({ enabled: false, onRetryProgram() { assert.fail('OFF read') } }), '')
  assert.match(render({ programError: true, onRetryProgram: undefined }), /<button[^>]*disabled=""[^>]*>Hent igen<\/button>/)
})

test('real AthleteView passes initial program loading and settled empty state to HomeSession', gate, async () => {
  for (const mode of ['athlete', 'own', 'preview']) {
    const loading = await host.renderScenario(host.scenario(mode, 'hjem', 'empty', { homeProgramLoading: true }))
    assert.match(loading, /Indlæser dit program/)
    assert.doesNotMatch(loading, /Intet program endnu/)
    const empty = await host.renderScenario(host.scenario(mode, 'hjem', 'empty'))
    assert.match(empty, /Intet program endnu/)
    assert.doesNotMatch(empty, /Indlæser dit program/)
    const error = await host.renderScenario(host.scenario(mode, 'hjem', 'empty', { programError: true }))
    assert.match(error, /Programmet kunne ikke hentes/)
    assert.match(error, />Hent igen<\/button>/)
  }
})
