// Hard app gate: actual React and ReactDOM, no skip or React replacement.
import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { readFileSync } from 'node:fs'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { jsx } from '../../../coachRyd2Jsx.mjs'
import CoachWeightPlan, { CoachWeightPlanContent } from './CoachWeightPlan.mjs'
import { emptyPlanDraft } from './coachPlanInput.mjs'

const profile = extra => ({ id: 'synthetic-a', name: 'Syntetisk atlet', competition_date: '2026-11-30', weight_class: 78, ...extra })
const basis = { competitionDate: '2026-11-30', weightClassKg: 78 }
const confirmed = { weightKg: '80', weighInHours: '24', adult: true, healthReviewed: true }
const content = (draft = confirmed, extra = {}) => renderToStaticMarkup(h(CoachWeightPlanContent,
  { basis, draft, prefix: 'synthetic', asOf: '2026-11-01', onChange() { assert.fail('render changed input') }, ...extra }))
function elements(node) {
  if (!node || typeof node !== 'object') return []
  return [node, ...[node.props?.children].flat(Infinity).flatMap(elements)]
}

test('real React: strict OFF and coach guard never inspect the athlete', () => {
  for (const enabled of [undefined, false, 'true', 1, null])
    assert.equal(CoachWeightPlan({ enabled, role: 'coach', get athlete() { assert.fail('OFF read') } }), null)
  for (const role of [undefined, 'athlete', 'admin'])
    assert.equal(CoachWeightPlan({ enabled: true, role, get athlete() { assert.fail('role read') } }), null)
})

test('real React: no panel for absent or invalid production date/class', () => {
  for (const extra of [{ competition_date: null }, { competition_date: '2026-02-30' },
    { weight_class: null }, { weight_class: '' }, { weight_class: '78+' }])
    assert.equal(renderToStaticMarkup(h(CoachWeightPlan, { enabled: true, role: 'coach', athlete: profile(extra) })), '')
})

test('real React: initially folded calculation has labelled empty controls and no presumed evidence', () => {
  const html = renderToStaticMarkup(h(CoachWeightPlan, { enabled: true, role: 'coach', athlete: profile() }))
  assert.match(html, /<summary[^>]*>Vægt og vejning<\/summary>/)
  assert.doesNotMatch(html, /<details[^>]*\bopen|Uge 1|checked=""|<button|<form/)
  assert.match(html, /Ingen beregning endnu/)
  assert.match(html, /Intet gemmes eller sendes til atleten/)
  assert.match(html, /Profilvægt bruges ikke automatisk/)
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1])
  for (const id of ids) assert.ok(html.includes(`for="${id}"`))
  assert.equal((html.match(/type="checkbox"/g) ?? []).length, 2)
})

test('real React: explicit evidence renders the existing model, recovery and safety details', () => {
  const html = content()
  assert.match(html, /Uge 1|Uge 4/)
  assert.match(html, /78 kg som pejlemærke/)
  assert.match(html, /Efter vejning|Sikkerhedsgrænser og kilder/)
  assert.match(html, /ikke aktiveret|søg akut lægehjælp/)
  assert.doesNotMatch(html, /<details[^>]*\bopen|<button|<form/)
  assert.equal((html.match(/href="https:\/\/doi.org\//g) ?? []).length, 3)
})

test('real React: missing/revoked evidence and invalid weight remove all previous targets', () => {
  for (const draft of [emptyPlanDraft(), { ...confirmed, adult: false }, { ...confirmed, healthReviewed: false },
    { ...confirmed, weighInHours: '' }, { ...confirmed, weightKg: '' }]) {
    const html = content(draft)
    assert.match(html, /Ingen beregning endnu/)
    assert.doesNotMatch(html, /Uge 1|Efter vejning/)
  }
  assert.match(content({ ...confirmed, weightKg: '80 kg' }), /role="alert"/)
  assert.doesNotMatch(content(confirmed, { asOf: '2026-11-29' }), /Uge 1/)
})

test('real React: controls forward decimal weight, explicit hours and checkbox changes', () => {
  const changes = []
  const tree = CoachWeightPlanContent({ basis, draft: emptyPlanDraft(), prefix: 'controlled', asOf: '2026-11-01',
    onChange: (...args) => changes.push(args) })
  const controls = elements(tree).filter(node => ['input', 'select'].includes(node.type))
  controls[0].props.onChange({ target: { value: '80,25' } })
  controls[1].props.onChange({ target: { value: '2' } })
  controls[2].props.onChange({ target: { checked: true } })
  controls[3].props.onChange({ target: { checked: false } })
  assert.deepEqual(changes, [['weightKg', '80,25'], ['weighInHours', '2'], ['adult', true], ['healthReviewed', false]])
  const html = content({ ...confirmed, weightKg: '90', weighInHours: '2' })
  assert.match(html, /Ingen akut vandreduktion ved 2 timers/)
})

// Load actual JSX tab. Only existing style/backend/flag edges are synthetic.
const tabURL = new URL('../../../dashboard/StaevneTab.jsx', import.meta.url).href
const key = Symbol.for('synthetic.coach.weight.portal')
const context = { enabled: true, client: new Proxy({}, { get() { assert.fail('backend accessed') } }) }
globalThis[key] = context
const stub = source => `data:text/javascript,${encodeURIComponent(source)}`
const hooks = registerHooks({
  resolve(specifier, parent, next) {
    if (parent.parentURL === tabURL) {
      if (specifier === '../supabase') return { url: stub("export const supabase = globalThis[Symbol.for('synthetic.coach.weight.portal')].client"), shortCircuit: true }
      if (specifier === '../dashboardShared') return { url: stub('export const s = {}'), shortCircuit: true }
      if (specifier === '../exerciseSetView') return next(new URL('../../../exerciseSetView.js', import.meta.url).href, parent)
      if (specifier === '../entropi2/flag.mjs') return { url: stub("export const entropi2Enabled = () => globalThis[Symbol.for('synthetic.coach.weight.portal')].enabled"), shortCircuit: true }
    }
    return next(specifier, parent)
  },
  load(url, options, next) {
    if (url === tabURL) return { format: 'module', shortCircuit: true,
      source: "import { createElement as h, Fragment } from 'react';\nconst __h = (type, props, ignored, ...children) => h(type ?? Fragment, props, ...children);\n" + jsx(readFileSync(new URL(url), 'utf8')) }
    return next(url, options)
  },
})
const { default: StaevneTab } = await import(tabURL)
after(() => { hooks.deregister(); delete globalThis[key] })
const tabProps = a => ({ a, athletePRs: [], meetPlan: null, meetPlanForm: { meet_type: 'sbd', notes: '' }, meetResults: [] })

test('real React: actual tab places folded weight panel below forecast and above history', () => {
  context.enabled = true
  const html = renderToStaticMarkup(h(StaevneTab, tabProps(profile())))
  const forecastAt = html.indexOf('Prognose til stævnedagen'), weightAt = html.indexOf('Vægt og vejning')
  assert.ok(forecastAt >= 0 && weightAt > forecastAt && html.lastIndexOf('Stævnehistorik') > weightAt)
  assert.doesNotMatch(html, /<details[^>]*\bopen/)
  assert.doesNotMatch(renderToStaticMarkup(h(StaevneTab, tabProps(profile({ weight_class: null })))), /Vægt og vejning/)
})

test('real React: actual OFF tab never reads production date/class for this connection', () => {
  context.enabled = false
  const a = { id: 'synthetic-a', name: 'Syntetisk atlet',
    get competition_date() { assert.fail('OFF date read') }, get weight_class() { assert.fail('OFF class read') } }
  assert.doesNotMatch(renderToStaticMarkup(h(StaevneTab, tabProps(a))), /Vægt og vejning|Prognose til stævnedagen/)
})

test('real React: local draft key changes with athlete, date, weight class and meet type', () => {
  const props = { enabled: true, role: 'coach', athlete: profile(), meetType: 'sbd' }
  const initial = CoachWeightPlan(props).key
  for (const extra of [{ athlete: profile({ id: 'synthetic-b' }) }, { athlete: profile({ competition_date: '2026-12-07' }) },
    { athlete: profile({ weight_class: 83 }) }, { meetType: 'bench' }])
    assert.notEqual(CoachWeightPlan({ ...props, ...extra }).key, initial)
})
