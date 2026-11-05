// Supplementary interaction checks on actual copied modules. NOT real React/DOM.
import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { readFileSync } from 'node:fs'
import { jsx } from '../../../coachRyd2Jsx.mjs'
import { createHost, descendants, textContent } from '../../checkin/syntheticReact.mjs'

const tabURL = new URL('../../../dashboard/StaevneTab.jsx', import.meta.url).href
const srcURL = new URL('../../../', import.meta.url).href
const fixtureURL = new URL('../../checkin/syntheticReact.mjs', import.meta.url).href
const stub = source => `data:text/javascript,${encodeURIComponent(source)}`
const portalKey = Symbol.for('synthetic.coach.weight.interaction')
globalThis[portalKey] = { enabled: true }
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'react' && context.parentURL?.startsWith(srcURL))
      return { url: stub(`export * from ${JSON.stringify(fixtureURL)}; export const Fragment='synthetic-fragment'; export const useEffect=()=>{};`), shortCircuit: true }
    if (context.parentURL === tabURL) {
      if (specifier === '../supabase') return { url: stub("export const supabase = new Proxy({}, {get(){throw Error('unexpected backend read')}})"), shortCircuit: true }
      if (specifier === '../dashboardShared') return { url: stub('export const s={}'), shortCircuit: true }
      if (specifier === '../exerciseSetView') return next(new URL('../../../exerciseSetView.js', import.meta.url).href, context)
      if (specifier === '../entropi2/flag.mjs') return { url: stub("export const entropi2Enabled=()=>globalThis[Symbol.for('synthetic.coach.weight.interaction')].enabled"), shortCircuit: true }
    }
    return next(specifier, context)
  },
  load(url, context, next) {
    if (url === tabURL) return { format: 'module', shortCircuit: true,
      source: "import {createElement as h, Fragment} from 'react'; const __h=(type,props,ignored,...children)=>h(type??Fragment,props,...children);\n" + jsx(readFileSync(new URL(url), 'utf8')) }
    return next(url, context)
  },
})
const { default: CoachWeightPlan, EnabledCoachWeightPlan } = await import('./CoachWeightPlan.mjs')
const { default: StaevneTab } = await import(tabURL)
after(() => { hooks.deregister(); delete globalThis[portalKey] })
const profile = extra => ({ id: 'synthetic-a', competition_date: '2099-11-30', weight_class: 78, ...extra })
const setup = () => createHost(CoachWeightPlan, { enabled: true, role: 'coach', athlete: profile(), meetType: 'sbd' })
const nodes = host => descendants(host.tree)
function change(host, selector, value, checked = false) {
  const control = nodes(host).find(selector)
  assert.ok(control)
  control.props.onChange({ target: checked ? { checked: value } : { value } })
  host.render()
}
function complete(host, hours = '24', weight = '80') {
  change(host, node => node.type === 'input' && node.props.type === 'text', weight)
  change(host, node => node.type === 'select', hours)
  for (let i = 0; i < 2; i++) {
    nodes(host).filter(node => node.type === 'input' && node.props.type === 'checkbox')[i].props.onChange({ target: { checked: true } })
    host.render()
  }
}

test('synthetic: input handlers produce actual safe model output, and revoking confirmation removes it', () => {
  const host = setup()
  assert.equal(host.tree.type, 'details')
  assert.notEqual(host.tree.props.open, true)
  assert.match(textContent(host.tree), /Ingen beregning endnu/)
  assert.doesNotMatch(textContent(host.tree), /Uge 1/)
  complete(host)
  assert.match(textContent(host.tree), /Uge 1|Uge 4/)
  assert.match(textContent(host.tree), /78 kg som pejlemærke/)
  assert.equal(nodes(host).some(node => node.type === 'button' || node.type === 'form'), false)
  change(host, node => node.type === 'input' && node.props.type === 'checkbox', false, true)
  assert.doesNotMatch(textContent(host.tree), /Uge 1|Efter vejning/)
})

test('synthetic: empty, invalid and unsupported inputs never reuse a previous calculation', () => {
  const host = setup(); complete(host)
  change(host, node => node.type === 'input' && node.props.type === 'text', '80kg')
  assert.match(textContent(host.tree), /Kropsvægt skal være et tal/)
  assert.doesNotMatch(textContent(host.tree), /Uge 1/)
  change(host, node => node.type === 'input' && node.props.type === 'text', '80')
  change(host, node => node.type === 'select', '')
  assert.doesNotMatch(textContent(host.tree), /Uge 1/)
  change(host, node => node.type === 'select', '2')
  change(host, node => node.type === 'input' && node.props.type === 'text', '90')
  assert.match(textContent(host.tree), /Ingen akut vandreduktion ved 2 timers/)
})

test('synthetic: athlete, date, class, meet-type and OFF changes discard temporary evidence', () => {
  for (const extra of [{ athlete: profile({ id: 'synthetic-b' }) },
    { athlete: profile({ competition_date: '2099-12-07' }) }, { athlete: profile({ weight_class: 83 }) }, { meetType: 'bench' }]) {
    const host = setup(); complete(host)
    host.render({ ...host.props, ...extra })
    assert.equal(nodes(host).find(node => node.type === 'input' && node.props.type === 'text').props.value, '')
    assert.equal(nodes(host).filter(node => node.type === 'input' && node.props.type === 'checkbox').every(node => node.props.checked === false), true)
    assert.doesNotMatch(textContent(host.tree), /Uge 1/)
  }
  const host = setup(); complete(host)
  host.render({ ...host.props, enabled: false }); assert.equal(host.tree, null)
  host.render({ ...host.props, enabled: true }); assert.match(textContent(host.tree), /Ingen beregning endnu/)
})

test('synthetic: no backend, storage or profile mutations during input or rendering', () => {
  const athlete = Object.freeze({ ...profile(), get bodyweight() { assert.fail('undated weight used') } })
  const host = createHost(CoachWeightPlan, { enabled: true, role: 'coach', athlete })
  complete(host)
  assert.equal(athlete.weight_class, 78)
  // No client or storage adapter is supplied or imported by this calculation.
  assert.match(textContent(host.tree), /Intet gemmes eller sendes/)
})

test('synthetic: wrapper keys isolate state and OFF/athlete guards do not read profile', () => {
  for (const props of [{ enabled: false, role: 'coach' }, { enabled: true, role: 'athlete' }])
    assert.equal(CoachWeightPlan({ ...props, get athlete() { assert.fail('guard read') } }), null)
  const node = CoachWeightPlan({ enabled: true, role: 'coach', athlete: profile() })
  assert.equal(node.type, EnabledCoachWeightPlan)
  assert.equal(CoachWeightPlan({ enabled: true, role: 'coach', athlete: profile({ competition_date: null }) }), null)
})

test('synthetic: actual JSX tab and coach panels keep placement, folded defaults and strict OFF', () => {
  const props = a => ({ a, athletePRs: [], meetPlan: null, meetPlanForm: { meet_type: 'sbd', notes: '' }, meetResults: [] })
  const render = a => createHost(StaevneTab, props(a))
  const athlete = { ...profile(), name: 'Syntetisk atlet' }
  const host = render(athlete)
  const text = textContent(host.tree)
  const forecast = text.indexOf('Prognose til stævnedagen'), weight = text.indexOf('Vægt og vejning')
  assert.ok(forecast >= 0 && weight > forecast && text.lastIndexOf('Stævnehistorik') > weight)
  assert.ok(nodes(host).filter(node => node.type === 'details').every(node => node.props.open !== true))
  for (const extra of [{ competition_date: null }, { weight_class: null }, { competition_date: '2026-02-30' }])
    assert.doesNotMatch(textContent(render({ ...athlete, ...extra }).tree), /Vægt og vejning/)
  globalThis[portalKey].enabled = false
  try {
    const off = render({ id: 'synthetic-a', name: 'Syntetisk atlet',
      get competition_date() { assert.fail('OFF date') }, get weight_class() { assert.fail('OFF class') } })
    assert.doesNotMatch(textContent(off.tree), /Vægt og vejning|Prognose til stævnedagen/)
  } finally { globalThis[portalKey].enabled = true }
})
