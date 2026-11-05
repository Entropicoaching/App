// Source and actual view checks only: no browser rendering or CSS engine claim.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { nutritionReportView } from './reportView.mjs'
import { buildNutritionReport } from './nutritionReport.mjs'
import { input } from './reportFixture.mjs'
import { createElement, expand, nodes, text } from './viewFixture.mjs'

const css = readFileSync(new URL('../../entropi2.css', import.meta.url), 'utf8').replaceAll('\r\n', '\n')
const luminance = hex => {
  const [r, g, b] = hex.match(/[a-f0-9]{2}/gi).map(v => parseInt(v, 16) / 255)
    .map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05)

test('actual ready report has a stable marker; loading/error/OFF keep their existing guards', () => {
  const report = buildNutritionReport(input())
  const tree = expand(nutritionReportView(createElement, { enabled: true, report }))
  assert.equal(tree.props['data-entropi2-kostrapport'], true)
  assert.equal(nodes(tree).filter(node => node.type === 'h2' && text(node) === 'Plan og registreret kost').length, 1)
  assert.ok(nodes(tree).some(node => node.type === 'h3'))
  for (const state of ['loading', 'error']) {
    const stateTree = nutritionReportView(createElement, { enabled: true, state,
      get report() { throw Error('stale report read') } })
    assert.equal(stateTree.props['data-entropi2-kostrapport'], undefined)
  }
  for (const enabled of [undefined, false, null, 'true', 1])
    assert.equal(nutritionReportView(() => { throw Error('OFF element') }, { enabled,
      get report() { throw Error('OFF report') } }), null)
})

for (const width of [390, 1280]) for (const theme of ['light', 'dark']) {
  test(`report heading source contract at ${width}px in ${theme}: explicit color, only under coach ON root`, () => {
    const selector = '[data-entropi2-coach-root] [data-entropi2-kostrapport] :is(h2, h3)'
    const rule = [...css.matchAll(/([^{}]+)\{\s*color:\s*(#[a-f0-9]{6});\s*\}/gi)]
      .find(match => match[1].trim().endsWith(selector))
    assert.ok(rule)
    assert.equal(rule[2], '#edeae2')
    // A top-level rule, before all media queries: width/theme cannot disable it.
    assert.ok(rule.index < css.indexOf('@media'))
    assert.equal(css.split(selector).length, 2)
    for (const background of ['#141410', '#1c1c18']) assert.ok(contrast(rule[2], background) >= 4.5)
    const host = readFileSync(new URL('../../../Dashboard.jsx', import.meta.url), 'utf8')
    assert.ok(host.includes("{...(e2 ? { 'data-entropi2-coach-root': '' } : {})}"))
    const view = expand(nutritionReportView(createElement, { enabled: true, report: buildNutritionReport(input()) }))
    assert.equal(view.props.style.minWidth, 0)
    assert.equal(view.props.style.width, '100%')
    assert.equal(view.props.style.overflowWrap, 'anywhere')
  })
}
