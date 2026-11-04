// Runs under the application's npm test with its real React dependencies.
// The local JSX bridge changes syntax only; React and ReactDOM are never replaced.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement, isValidElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { loadBundNav, fixtureProps } from './bundNavHarness.mjs'
import { navigationCases } from './bundNavCases.mjs'
const { BundNav, dispose } = await loadBundNav('react')
test.after(dispose)
navigationCases(BundNav)

test('actual React renders closed native disclosure, route labels and unread accessibility', () => {
  const props = fixtureProps({ tab: 'beskeder', unreadMsgCount: 1, hasMeetPlan: true })
  assert.ok(isValidElement(BundNav(props)))
  const html = renderToStaticMarkup(createElement('div', { 'data-entropi2-athlete': '' }, createElement(BundNav, props)))
  assert.match(html, /aria-label="Hovednavigation"/)
  assert.match(html, /aria-current="page" aria-label="Beskeder, ulæst indhold"/)
  assert.match(html, /<details[^>]*>/)
  assert.doesNotMatch(html, /<details[^>]*\bopen(?:=|[ >])/)
  assert.match(html, /<summary[^>]*>/)
  for (const label of ['Hjem', 'Program', 'Fremgang', 'Kost', 'Beskeder', 'Mere', 'Volumen', 'Mobilitet', 'Stævne'])
    assert.ok(html.includes(label), label)
})
