import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { install } from './frem3Loader.mjs'
import { mount, nodes, text } from './frem3Dom.mjs'

install()
const { default: Fremgang } = await import('./FremgangTab.jsx')
const { default: Enkel } = await import('./EnkelFremgangTab.jsx')
const css = readFileSync(new URL('../entropi2/entropi2.css', import.meta.url), 'utf8')
const cssRule = css.match(/\[data-entropi2-athlete\] \[data-rekord-historik-knap\]\s*\{([^}]+)\}/)?.[1]
const props = { rel1101: false, allWeeks: [], currentWeek: { sessions: [] }, exerciseLogs: [],
  enkelDel: 'rekorder', fremgangLoading: false,
  fremgangLogs: [100, 105, 110].map((weight, i) => ({ weight, reps_completed: 5,
    logged_at: `2026-10-${String(1 + i * 7).padStart(2, '0')}T12:00:00Z`, exercises: { name: 'Squat' } })) }

for (const Component of [Fremgang, Enkel]) {
  test(`${Component.name}: actual history button matches the scoped 44 px rule and keeps its disclosure`, () => {
    const view = mount(Component, props)
    const button = tree => nodes(tree, n => n.props['data-rekord-historik-knap'] !== undefined)[0]
    const closed = button(view.render())
    assert.ok(closed)
    assert.equal(closed.props.style.minHeight, 32, 'OFF inline style is preserved')
    assert.match(cssRule ?? '', /min-height:\s*44px\s*!important/)
    assert.match(text(closed), /Historik/)
    assert.equal(closed.props['aria-expanded'], false)
    closed.props.onClick()
    const opened = button(view.render())
    assert.equal(opened.props['aria-expanded'], true)
    assert.equal(text(opened).trim(), 'Skjul')
  })
}
