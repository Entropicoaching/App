import test from 'node:test'
import assert from 'node:assert/strict'

// Discovered by the app's npm test. Genuine React only; a missing dependency
// is an explicit merge gate, never substituted with the synthetic hook host.
let h, render, Home, Profile, Analysis, missing = false
try {
  ;({ createElement: h } = await import('react'))
  ;({ renderToStaticMarkup: render } = await import('react-dom/server'))
} catch (error) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND' || !/Cannot find package '(react|react-dom)'/.test(error.message)) throw error
  missing = true
}
if (!missing) {
  ;({ default: Home } = await import('./home/AthleteHome.mjs'))
  ;({ default: Profile } = await import('./profile/Profile.mjs'))
  ;({ default: Analysis } = await import('./analysis/Analysis.mjs'))
}
const gate = { skip: missing ? 'Pinned copy lacks React/react-dom; genuine React required at Dhurva merge.' : false }
const athlete = { id: 'synthetic-frame-react', goal: 'Langt syntetisk mål '.repeat(40), kcal_target: 2400 }
const now = new Date('2026-11-05T12:00:00Z')

test('frame real React: actual Home, Profile and Analysis emit the scoped roots with long reading content', gate, () => {
  const home = render(h(Home, { enabled: true, athlete, now, storage: null, allWeeks: [], exerciseLogs: [],
    messages: [{ sender_role: 'coach', content: 'Første linje\nSyntetisk coachafsnit\nSidste linje' }] }))
  assert.match(home, /<main[^>]*data-entropi2-home=""/)
  assert.match(home, /Syntetisk coachafsnit/)
  const profile = render(h(Profile, { enabled: true, athlete }))
  assert.match(profile, /data-entropi2-profile=""/)
  assert.match(profile, /<dd[^>]*>Langt syntetisk mål/)
  assert.match(render(h(Analysis, { entropi2: true, athlete, now, fremgangLogs: [], exerciseLogs: [] })),
    /data-entropi2-analysis="true"/)
})

test('frame real React: long exercise text stays escaped and wrapping with the original action and card sizes', gate, () => {
  const week = { id: 'synthetic-week', start_date: '2026-11-02', week_number: 1,
    sessions: [{ id: 'synthetic-session', weekday: 3, exercises: [
      { id: 'synthetic-exercise', name: '<script>fixture()</script>' + 'Øvelse'.repeat(80), sets: 1 },
    ] }] }
  const markup = render(h(Home, { enabled: true, athlete, now, storage: null, currentWeek: week,
    allWeeks: [week], exerciseLogs: [], onStartSession() {} }))
  assert.match(markup, /overflow-wrap:anywhere/)
  assert.match(markup, /&lt;script&gt;fixture\(\)&lt;\/script&gt;/)
  assert.doesNotMatch(markup, /<script>/)
  assert.match(markup, /min-height:52px/)
  assert.match(markup, /padding:20px/)
})

test('frame real React: OFF entries stay empty without evaluating athlete data', gate, () => {
  const poison = new Proxy({}, { get() { assert.fail('OFF athlete read') } })
  for (const [Component, options] of [[Home, { enabled: false }], [Profile, { enabled: false }],
    [Analysis, { entropi2: false }]])
    assert.equal(render(h(Component, { ...options, athlete: poison })), '')
})
