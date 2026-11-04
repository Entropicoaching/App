import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { readFileSync } from 'node:fs'
import { jsx } from '../../../dashboard/analyseSamletJsx.mjs'

// App npm-test discovery, real React/ReactDOM only. Never silently substitute it.
let h, renderToStaticMarkup, CoachSleep, CoachSleepContent, AnalyseTab, missing = false
try {
  ;({ createElement: h } = await import('react'))
  ;({ renderToStaticMarkup } = await import('react-dom/server'))
} catch (error) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND' || !/package '(react|react-dom)'/.test(error.message)) throw error
  missing = true
}
if (!missing) {
  ;({ default: CoachSleep, CoachSleepContent } = await import('./CoachSleep.mjs'))
  const src = new URL('../../../', import.meta.url).href
  const tabURL = new URL('../../../dashboard/AnalyseTab.jsx', import.meta.url).href
  const legacy = new Set(['../dashboardCharts.jsx', './AnalyseLokaltVaerktoej.jsx', './primaerKurve.js', '../danskDato.js', '../AthleteSilentFailNote.jsx'])
  const hook = registerHooks({
    resolve(specifier, context, next) {
      if (context.parentURL === tabURL && legacy.has(specifier))
        return { url: new URL('../../../dashboard/analyseSamletStubs.mjs', import.meta.url).href, shortCircuit: true }
      return next(specifier, context)
    },
    load(url, context, next) {
      if (url.endsWith('.jsx') && url.startsWith(src)) return { format: 'module',
        source: `import { createElement as __sleepCreateElement, Fragment as __sleepFragment } from 'react';
          const __h = (type, props, ignored, ...children) => __sleepCreateElement(type || __sleepFragment, props, ...children);
          ${jsx(readFileSync(new URL(url), 'utf8'))}`, shortCircuit: true }
      return next(url, context)
    },
  })
  try { ({ default: AnalyseTab } = await import('../../../dashboard/AnalyseTab.jsx')) }
  finally { hook.deregister() }
}
const options = { skip: missing ? 'Real React/react-dom absent in pinned copy; Dhurva must run app npm test' : false }
const scope = { enabled: true, client: {}, coachId: 'synthetic-coach', athleteId: 'synthetic-athlete', asOf: '2026-11-04' }
const row = { athlete_id: scope.athleteId, logged_date: '2026-11-03', sleep_hours: 7.5 }
const snapshot = { status: 'ready', complete: true, athleteId: scope.athleteId, endDate: '2026-11-03',
  readinessRows: [row], qualityRows: [], exerciseLogs: [] }
const render = (Component, props) => renderToStaticMarkup(h(Component, props))

test('real React coach hours: folded, 4/6/8 choices, correct coverage, no quality/training invention', options, () => {
  for (const weeks of [4, 6, 8]) {
    const html = render(CoachSleepContent, { snapshot, weeks })
    assert.match(html, /<details[^>]*><summary[^>]*>Søvn \(4-8 uger\)/)
    assert.doesNotMatch(html, /<details[^>]*\bopen|Søvnkvalitet|Kvalitet:|dine pas|e1RM|synthetic-/)
    assert.equal((html.match(/class="e2-sleep-week"/g) ?? []).length, weeks)
    assert.match(html, /For lidt data · 1\/7 dage/)
    for (const value of [4, 6, 8]) assert.ok(html.includes(`value="${value}"`))
  }
})

test('real React coach gate: OFF, other athlete and absent data render nothing', options, () => {
  const poison = new Proxy({}, { get() { throw Error('OFF payload inspected') } })
  assert.equal(render(CoachSleep, { enabled: false, readinessRows: poison, client: poison }), '')
  assert.equal(render(CoachSleep, { ...scope, readinessRows: [] }), '')
  assert.equal(render(CoachSleep, { ...scope, athleteId: 'synthetic-other', readinessRows: [row] }), '')
  assert.equal(render(CoachSleepContent, { snapshot: { ...snapshot, readinessRows: [] } }), '')
  assert.match(render(CoachSleepContent, { snapshot: { status: 'error' }, onRetry() {} }), /role="alert"/)
})

test('real React actual AnalyseTab: sleep after Ugeevaluering, selected-athlete scope and OFF', options, () => {
  const props = { coachId: scope.coachId, a: { id: scope.athleteId }, selectedAthlete: { id: scope.athleteId },
    athleteLogs: [], athletePRHistory: [], athleteReadiness: [row], athleteWeightLogs: [],
    exerciseLibrary: [], videoAnalyses: [], videoBaselines: [], weeks: [], videoLiftFilter: 'all' }
  const seen = []
  function Boundary(p) {
    if (p.label === 'Søvn (4-8 uger)') { seen.push(p); return h(CoachSleepContent, { snapshot }) }
    return p.label ? null : h('h2', null, 'Ugeevaluering')
  }
  const html = render(AnalyseTab, { ...props, weeklyEvaluation: h(Boundary, { componentProps: scope }) })
  assert.ok(html.indexOf('Ugeevaluering') < html.indexOf('Søvn (4-8 uger)'))
  assert.equal(seen.length, 1)
  assert.equal(seen[0].componentProps.athleteId, scope.athleteId)
  assert.doesNotMatch(render(AnalyseTab, props), /Søvn \(4-8 uger\)/)
})
