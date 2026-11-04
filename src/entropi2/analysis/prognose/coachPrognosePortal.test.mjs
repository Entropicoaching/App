import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { readFileSync } from 'node:fs'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { jsx } from '../../../coachRyd2Jsx.mjs'
import CoachMeetPrognose from './CoachMeetPrognose.mjs'

// Load the actual JSX tab with real React. Only the legacy style/backend/flag
// imports are synthetic; the coach panels and forecast modules stay real.
const tabURL = new URL('../../../dashboard/StaevneTab.jsx', import.meta.url).href
const key = Symbol.for('synthetic.coach.prognose.portal')
const context = { enabled: false,
  client: new Proxy({}, { get() { assert.fail('server render accessed backend') } }) }
globalThis[key] = context
const stub = source => `data:text/javascript,${encodeURIComponent(source)}`
const hooks = registerHooks({
  resolve(specifier, parent, next) {
    if (parent.parentURL === tabURL) {
      if (specifier === '../supabase') return { url: stub("export const supabase = globalThis[Symbol.for('synthetic.coach.prognose.portal')].client"), shortCircuit: true }
      if (specifier === '../dashboardShared') return { url: stub('export const s = {}'), shortCircuit: true }
      if (specifier === '../exerciseSetView') return next(new URL('../../../exerciseSetView.js', import.meta.url).href, parent)
      if (specifier === '../entropi2/flag.mjs') return { url: stub("export const entropi2Enabled = () => globalThis[Symbol.for('synthetic.coach.prognose.portal')].enabled"), shortCircuit: true }
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
const props = extra => ({ a: { id: 'synthetic-a', name: 'Syntetisk atlet', competition_date: '2026-11-18' },
  athletePRs: [], meetPlan: null, meetPlanForm: { meet_type: 'sbd', notes: '' }, meetResults: [], ...extra })
function elements(node) {
  if (!node || typeof node !== 'object') return []
  return [node, ...[node.props?.children].flat(Infinity).flatMap(elements)]
}

test('real React: actual Stævne tab places the closed forecast after attempts and before history', () => {
  context.enabled = true
  const p = props(), tree = StaevneTab(p)
  const forecast = elements(tree).find(node => node.type === CoachMeetPrognose)
  assert.ok(forecast)
  assert.equal(forecast.props.client, context.client)
  assert.equal(forecast.props.athleteId, p.a.id)
  assert.equal(forecast.props.meetDate, p.a.competition_date)
  assert.equal(forecast.props.meetType, 'sbd')
  const html = renderToStaticMarkup(h(StaevneTab, p))
  const attempts = html.indexOf('Forsøgsvalg og opvarmning'), forecastAt = html.indexOf('Prognose til stævnedagen')
  assert.ok(attempts >= 0 && forecastAt > attempts && html.lastIndexOf('Stævnehistorik') > forecastAt)
  assert.doesNotMatch(html, /<details open|Skøn:/)
})

test('real React: OFF tab omits the forecast without reading its date; athlete/date/type key scopes local state', () => {
  context.enabled = false
  const a = { id: 'synthetic-a', name: 'Syntetisk atlet', get competition_date() { assert.fail('OFF read date') } }
  assert.doesNotMatch(renderToStaticMarkup(h(StaevneTab, props({ a }))), /Prognose til stævnedagen|Forsøgsvalg og opvarmning/)
  context.enabled = true
  const find = p => elements(StaevneTab(p)).find(node => node.type === CoachMeetPrognose)
  const original = find(props())
  for (const p of [props({ a: { id: 'synthetic-b', name: 'Syntetisk atlet', competition_date: '2026-11-18' } }),
    props({ meetPlanForm: { meet_type: 'bench', notes: '' } }),
    props({ a: { id: 'synthetic-a', name: 'Syntetisk atlet', competition_date: '2026-11-25' } })])
    assert.notEqual(find(p).key, original.key)
})
