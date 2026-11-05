import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { readFileSync } from 'node:fs'
import { jsx } from '../../../dashboard/analyseSamletJsx.mjs'
import { fixture } from './restitutionFixtures.mjs'

// Discovered by the app's npm test; React and ReactDOM are never doubled here.
let h, renderToStaticMarkup, CoachRestitution, Content, AnalyseTab, missing = false
try {
  ;({ createElement: h } = await import('react'))
  ;({ renderToStaticMarkup } = await import('react-dom/server'))
} catch (error) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND' || !/package '(react|react-dom)'/.test(error.message)) throw error
  missing = true
}
if (!missing) {
  ;({ default: CoachRestitution, CoachRestitutionContent: Content } = await import('./CoachRestitution.mjs'))
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
      if (url.endsWith('.jsx') && url.startsWith(src)) return { format: 'module', source:
        `import { createElement as __realCreateElement, Fragment as __realFragment } from 'react';
        const __h = (type, props, ignored, ...children) => __realCreateElement(type || __realFragment, props, ...children);
        ${jsx(readFileSync(new URL(url), 'utf8'))}`, shortCircuit: true }
      return next(url, context)
    },
  })
  try { ({ default: AnalyseTab } = await import('../../../dashboard/AnalyseTab.jsx')) }
  finally { hook.deregister() }
}
const options = { skip: missing ? 'Real React/react-dom absent in pinned copy; Dhurva must run app npm test without SKIP' : false }
const render = (Component, props) => renderToStaticMarkup(h(Component, props))
const data = fixture()
const scope = { enabled: true, client: {}, coachId: 'synthetic-coach', athleteId: data.athleteId, asOf: '2026-11-05' }

test('real React restitution: collapsed coach fold, further folded evidence and no repeated title', options, () => {
  const html = render(Content, { snapshot: data })
  assert.equal((html.match(/<details/g) ?? []).length, 2)
  assert.doesNotMatch(html, /<details[^>]*\bopen|<h2|din restitution|dine egne|synthetic-|NaN|Infinity|undefined/)
  for (const expected of ['Restitution (7-14 dage)', 'Forsigtig restitutionsstatus: God', 'atletens restitution',
    'atletens egne svar', '4/7 dage', '600 kg × gentagelser', 'Programmet ændres ikke.', 'min-height:44px'])
    assert.ok(html.includes(expected), expected)
})

test('real React restitution: no sources means no section; sparse data, loading and errors stay distinct', options, () => {
  for (const patch of [{ readinessRows: [] }, { exerciseLogs: [] }])
    assert.equal(render(Content, { snapshot: { ...data, ...patch } }), '')
  const sparse = render(Content, { snapshot: { ...data, readinessRows: [data.readinessRows.at(-1)] } })
  assert.match(sparse, /For lidt data/); assert.doesNotMatch(sparse, /Forsigtig restitutionsstatus/)
  assert.match(render(Content, {}), /aria-busy="true"/)
  const failure = render(Content, { snapshot: { status: 'error', message: 'synthetic-hidden' }, onRetry() {} })
  assert.match(failure, /role="alert"/); assert.match(failure, /<button type="button"/)
  assert.doesNotMatch(failure, /synthetic-hidden|For lidt data/)
})

test('real React restitution: OFF, wrong athlete and missing source never mount active view', options, () => {
  const poison = new Proxy({}, { get() { throw Error('OFF payload inspected') } })
  assert.equal(render(CoachRestitution, { enabled: false, client: poison, readinessRows: poison, exerciseLogs: poison }), '')
  for (const patch of [{ readinessRows: [] }, { exerciseLogs: [] }, { athleteId: 'synthetic-other' }])
    assert.equal(render(CoachRestitution, { ...scope, readinessRows: data.readinessRows, exerciseLogs: data.exerciseLogs, ...patch }), '')
})

test('real React actual AnalyseTab: restitution under sleep, exact scope and default OFF', options, () => {
  const props = { coachId: scope.coachId, a: { id: scope.athleteId }, selectedAthlete: { id: scope.athleteId },
    athleteLogs: data.exerciseLogs, athletePRHistory: [], athleteReadiness: data.readinessRows, athleteWeightLogs: [],
    exerciseLibrary: [], videoAnalyses: [], videoBaselines: [], weeks: [], videoLiftFilter: 'all' }
  const seen = []
  function Boundary(p) {
    if (p.label === 'Restitution (7-14 dage)') { seen.push(p); return h(Content, { snapshot: data }) }
    return h('p', null, p.label || 'Ugeevaluering')
  }
  const html = render(AnalyseTab, { ...props, weeklyEvaluation: h(Boundary, { componentProps: scope }) })
  assert.ok(html.indexOf('Søvn (4-8 uger)') < html.indexOf('Restitution (7-14 dage)'))
  assert.ok(html.indexOf('Restitution (7-14 dage)') < html.indexOf('4-ugers eksport'))
  assert.equal(seen.length, 1)
  assert.deepEqual(seen[0].componentProps, { ...scope, readinessRows: data.readinessRows, exerciseLogs: data.exerciseLogs })
  assert.doesNotMatch(render(AnalyseTab, props), /Restitution \(7-14 dage\)/)
})
