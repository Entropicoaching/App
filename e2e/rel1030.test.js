import { test } from 'node:test'
import assert from 'node:assert/strict'
import { install } from './rel1030Harness.mjs'
import { reset, createElement as h } from './rel1030Runtime.mjs'
const hooks = install()
const { default: App } = await import('../src/App.jsx')
const { default: Baseline } = await import('./rel1030Baseline.txt')
const { rel1030Enabled, rel1030Feature, rel1030Mobility, REL1030_FEATURES, DEFAULT_REL1030 } = await import('../src/rel1030.mjs')
const { coachRydEnabled, CoachFold } = await import('../src/coachRyd.mjs')
const { coachWeekFlag, renderWeekOverview } = await import('../src/dashboard/coachWeekOverview.mjs')
const { analyseSamletEnabled, renderAnalyseSamlet } = await import('../src/dashboard/analyseSamlet.mjs')
const { analyseSammenlignEnabled, renderComparison, comparisonState } = await import('../src/dashboard/analyseSammenlign.mjs')
const { videoFeedbackPlaybackEnabled } = await import('../src/athlete/videoFeedbackPlayback.mjs')
const { fridayTestEnabled } = await import('../src/e2eTestFlags.mjs')
const { release3TestFlags } = await import('../src/release3TestFlags.mjs')
hooks.deregister()
const gates = {coachRyd:coachRydEnabled, coachUge:coachWeekFlag, analyseSamlet:analyseSamletEnabled, analyseSammenlign:analyseSammenlignEnabled}
const deny = new Proxy({}, {get() { throw Error('Storage access forbidden') }})
function render(Component, search, role = 'athlete', preview = false, props = {}) {
  globalThis.window = {location:{search, href:'https://synthetic.invalid/' + search}}
  reset(role, preview)
  return Component(props)
}
const clean = value => JSON.parse(JSON.stringify(value, (key, v) => typeof v === 'function' ? '[function]' : v))
const view = tree => tree.props.children[0].props.componentProps

test('closed release list and strict default OFF, including malformed and duplicate opt-ins', () => {
  assert.equal(DEFAULT_REL1030, false)
  assert.deepEqual(REL1030_FEATURES, ['hviledage','mobilitetFoerPas','mobilitetFokus','mobilitetHjalp','analyseSamlet','analyseSammenlign','coachRyd','coachUge','videoFeedbackPlayback','analyseConclusion','mobilitetCoach','mobilitetHjemme','programOverblik'])
  for (const search of ['', '?rel1030=0', '?rel1030=true', '?rel1030', '?REL1030=1', '?x=rel1030=1', '?rel1030=1&rel1030=1', '?rel1030=0&rel1030=1']) {
    assert.equal(rel1030Enabled(search), false, search)
    for (const gate of Object.values(gates)) assert.equal(gate(search), false, search)
    const props = {mobilitetFokus:false, unrelated:42}
    assert.equal(rel1030Mobility(props,search), props)
  }
  for (const feature of REL1030_FEATURES) assert.equal(rel1030Feature(feature, '?rel1030=1'), true)
  for (const feature of ['enkelPrototype','forenklinger','appE2E2','appRel3','coachMorning','appData2','coachPlanCopyEnabled','kostValg','__proto__']) assert.equal(rel1030Feature(feature, '?rel1030=1'), false)
  assert.equal(fridayTestEnabled('production', 'https://synthetic.invalid/?rel1030=1'),false)
  assert.deepEqual(release3TestFlags('production','https://synthetic.invalid/?rel1030=1'),{athlete:{},coach:{}})
})

test('all individual gates still work alone and do not enable neighbours', () => {
  for (const [key, gate] of Object.entries(gates)) {
    assert.equal(gate('?' + key + '=1'),true)
    assert.equal(gate('?rel1030=0&' + key + '=1'),true)
    for (const [other, fn] of Object.entries(gates)) if (other !== key) assert.equal(fn('?' + key + '=1'),false)
  }
  assert.equal(videoFeedbackPlaybackEnabled({getItem:key => key === 'vc-epik2-playback' ? '1' : null}, ''),true)
  assert.equal(videoFeedbackPlaybackEnabled({getItem:() => null}, ''),false)
  assert.equal(videoFeedbackPlaybackEnabled(deny, '?rel1030=1'),true)
  assert.equal(videoFeedbackPlaybackEnabled(deny, ''),false)
})

test('actual App renders exact baseline with release OFF in athlete, coach and coach preview branches', () => {
  for (const [role, preview] of [['athlete',false],['coach',false],['coach',true]]) {
    for (const search of ['', '?rel1030=0', '?rel1030=1&rel1030=0']) {
      for (const props of [{},{mobilitetHjalp:true,mobilitetFokus:true,mobilitetFoerPas:true,forenklinger:true,blokFremgang:true,fremgangFokus:true}]) {
        assert.deepEqual(clean(render(App,search,role,preview,props)),clean(render(Baseline,search,role,preview,props)))
      }
    }
  }
})

test('actual App enables exactly mobility props across all role branches, preserving existing props', () => {
  for (const [role, preview] of [['athlete',false],['coach',false],['coach',true]]) {
    const before=clean(view(render(Baseline,'',role,preview)))
    const after=clean(view(render(App,'?rel1030=1',role,preview)))
    const expected={...before,mobilitetHjalp:true}
    if (role !== 'coach' || preview) Object.assign(expected,{mobilitetFokus:true,mobilitetFoerPas:true})
    assert.deepEqual(after,expected)
    assert.equal(view(render(App,'?rel1030=1',role,preview,{blokFremgang:true})).blokFremgang,true)
  }
  delete globalThis.window
  reset()
  assert.equal(view(App()).mobilitetFokus,false)
})

test('actual gated synthetic DOM and handlers expose release features', () => {
  assert.equal(CoachFold({enabled:coachRydEnabled('?rel1030=1'),title:'Review',children:'Content'}).type,'details')
  assert.equal(renderWeekOverview(h,{enabled:coachWeekFlag(''),entries:[]}),null)
  assert.ok(renderWeekOverview(h,{enabled:coachWeekFlag('?rel1030=1'),entries:[]}))
  assert.equal(analyseSamletEnabled('?rel1030=1'),true)
  let selected
  const tree=renderAnalyseSamlet(h,{lift:'squat',chooseLift:value => {selected=value},chooseAnalysis:value => {selected=value}})
  const nodes=n => n && typeof n==='object' ? [n,...n.props.children.flat(Infinity).flatMap(nodes)] : []
  const button=nodes(tree).find(n => n.type==='button' && typeof n.props.onClick==='function')
  button.props.onClick()
  assert.ok(selected)
  assert.equal(analyseSammenlignEnabled('?rel1030=1'),true)
  assert.ok(renderComparison(h,comparisonState(),() => {}))
})
