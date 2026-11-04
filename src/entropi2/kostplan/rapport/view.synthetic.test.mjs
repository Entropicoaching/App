import test from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'
import { buildNutritionReport } from './nutritionReport.mjs'
import { activePlan, input, meal } from './reportFixture.mjs'
import { expand, nodes, text } from './viewFixture.mjs'

register('./viewFixtureLoader.mjs', import.meta.url)
const { default: View } = await import('./KostrapportCoach.mjs')
const render = (data = input()) => expand(View({ enabled: true, report: buildNutritionReport(data) }))

test('synthetic structure: OFF reads only enabled, and loading/error never read stale reports', () => {
  for (const enabled of [false, undefined, null, 1, 'true']) {
    assert.equal(View(new Proxy({ enabled }, { get(target, key) {
      if (key !== 'enabled') throw Error('OFF read')
      return target.enabled
    } })), null)
  }
  for (const state of ['loading', 'error']) {
    assert.ok(View({ enabled: true, state, get report() { throw Error('stale snapshot') } }))
  }
})

test('synthetic structure: clear weekly macros, coverage, uncapped daily percentages, weight and folded details', () => {
  const tree = render(), content = text(tree)
  for (const expected of ['Energi', 'Protein', 'Kulhydrat', 'Fedt', '3.500 kcal', '4.000 kcal plan for loggede dage',
    '87,5 % af mål', '125 % af mål', '2 af 7 dage med kostlog', '5 uden log', 'Gennemsnit: 81 kg', '+2 kg']) {
    assert.ok(content.includes(expected), expected)
  }
  const details = nodes(tree).filter(n => n.type === 'details')
  assert.equal(details.length, 2); assert.ok(details.every(n => !n.props.open))
  assert.equal(nodes(tree).filter(n => n.type === 'time').length, 7)
  assert.equal(nodes(tree).filter(n => n.type === 'button').length, 0)
  assert.ok(nodes(tree).filter(n => n.type === 'summary').every(n => n.props.style.minHeight >= 44))
  assert.match(tree.props.style.overflowWrap, /anywhere/)
  assert.ok(nodes(tree).some(n => n.props.style?.gridTemplateColumns?.includes('min(100%')))
})

test('synthetic structure: no logs has no zero intake or weekly zero percentage; plans stay visible per day', () => {
  const tree = render(input({ mealLogs: [] })), content = text(tree)
  assert.match(content, /ingen kostlog i perioden/)
  assert.match(content, /Ingen kostlog · dagens indtag er ukendt/)
  assert.match(content, /2.000 kcal plan/)
  assert.doesNotMatch(content, /0 kcal registreret|0 % af mål|NaN|Infinity|undefined/)
})

test('synthetic structure: no plan and unknown nutrients are explicit, with known metrics retained', () => {
  const tree = render(input({ plans: [], mealLogs: [meal('2026-11-02', 'x', { protein: null })], weightLogs: [] }))
  assert.match(text(tree), /Ingen aktiveret plan/)
  assert.match(text(tree), /Nogle næringsdata mangler/)
  assert.match(text(tree), /Ukendt registreret/)
  assert.match(text(tree), /Mål mangler/)
  assert.match(text(tree), /Ikke nok vejninger/)
  assert.ok(nodes(tree).some(n => n.props.role === 'alert'))
  assert.doesNotMatch(text(tree), /NaN|Infinity|undefined/)
})

test('synthetic structure: overlapping plans show alerts and upcoming days remain outside the summary', () => {
  const tree = render(input({ date: '2026-11-04', plans: [activePlan(), activePlan({ id: 'overlap' })] }))
  assert.match(text(tree), /Planhistorikken overlapper/)
  assert.match(text(tree), /Flere planer er aktiveret/)
  assert.match(text(tree), /Kommende dag · ikke med i opgørelsen/)
  assert.match(text(tree), /2 af 3 dage med kostlog/)
})

test('synthetic structure: error/retry, loading status and missing integration are distinct', () => {
  let calls = 0
  const tree = expand(View({ enabled: true, state: 'error', onRetry: () => calls++ }))
  const button = nodes(tree).find(n => n.type === 'button')
  assert.equal(button.props.type, 'button'); assert.ok(button.props.style.minHeight >= 44)
  button.props.onClick(); assert.equal(calls, 1)
  assert.match(text(tree), /kunne ikke hentes/)
  assert.equal(nodes(expand(View({ enabled: true, state: 'loading' })))[0].props.role, 'status')
  assert.match(text(expand(View({ enabled: true }))), /ikke tilsluttet/)
})
