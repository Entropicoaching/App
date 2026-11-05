import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { mount } from './readinessFocusFixture.mjs'
import { manualClock } from '../tracking/hurtig/testFixtures.mjs'

const componentUrl = new URL('./QuickLogs.mjs', import.meta.url).href
const hooks = registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'react' && context.parentURL === componentUrl) return {
    url: new URL('./readinessFocusFixture.mjs', import.meta.url).href, shortCircuit: true,
  }
  return next(specifier, context)
} })
const { default: QuickLogs } = await import(componentUrl)
hooks.deregister()
function fixture(t, extra = {}) {
  const time = manualClock(), writes = []
  const athlete = { id: 'synthetic-accessibility' }, today = '2026-11-04'
  const props = { enabled: true, athlete, today, quickClock: time.clock,
    getNow: () => new Date('2026-11-04T12:00:00Z'),
    readinessInput: { sleep: '', energy: null, motivation: null, stress: null, soreness: null },
    weightInput: '', weightLogs: [],
    trackingData: { status: 'ready', complete: true, athleteId: athlete.id, today,
      readinessRows: [{ athlete_id: athlete.id, logged_date: '2026-11-03',
        energy: 2, motivation: 4, stress: 2, soreness_level: 1 }] },
    saveReadiness: () => writes.push('readiness'), logWeight: () => writes.push('weight'),
    setReadinessInput: value => { props.readinessInput = value(props.readinessInput) },
    setWeightInput: value => { props.weightInput = value }, ...extra }
  const view = mount(QuickLogs, props)
  t.after(() => { view.unmount(); assert.equal(time.handles(), 0); assert.deepEqual(writes, []) })
  return { view, props }
}
const heading = view => view.nodes(node => node.type === 'h2')[0]
for (const energyFirst of [false, true]) test(`full-form transition focuses the mounted heading; energy first: ${energyFirst}`, t => {
  const { view, props } = fixture(t)
  const opener = view.button('Dagsform')
  if (energyFirst) view.click('Energi 5')
  const edit = view.button('Ret øvrige svar')
  view.click('Ret øvrige svar')
  assert.equal(edit.isConnected, false)
  assert.equal(view.focus, heading(view))
  assert.equal(view.focus.isConnected, true)
  assert.equal(view.focus.props.tabIndex, -1)
  assert.equal(props.readinessInput.energy, energyFirst ? '5' : '2')
  const count = view.focusCalls.length
  view.render()
  assert.equal(view.focusCalls.length, count, 'no repeated focus on unrelated rendering')
  view.click('Luk')
  assert.equal(view.focus, opener, 'return to stable Dagsform, never a removed fast-form button')
  assert.equal(opener.isConnected, true)
})

test('score changes keep focus on their button, including fast selection, full form and weight switching', t => {
  const { view, props } = fixture(t)
  for (const label of ['Energi 2', 'Energi 4']) {
    const button = view.click(label)
    assert.equal(view.focus, button)
    assert.equal(view.button(label).props['aria-pressed'], true)
  }
  view.click('Ret øvrige svar')
  const firstHeading = heading(view)
  for (const label of ['Energi 1', 'Motivation 2', 'Stress 3', 'Ømhed 5']) {
    const button = view.click(label)
    assert.equal(view.focus, button)
  }
  assert.deepEqual(props.readinessInput, { sleep: '', energy: '1', motivation: '2', stress: '3', soreness: '5' })
  const weight = view.button('Vægt i dag')
  view.click('Vægt i dag')
  assert.equal(firstHeading.isConnected, true, 'same full-panel heading is reused')
  assert.equal(view.focus, heading(view))
  view.click('Luk'); assert.equal(view.focus, weight)
  assert.equal(firstHeading.isConnected, false)
  view.click('Dagsform')
  assert.notEqual(heading(view), firstHeading)
  assert.equal(view.focus, heading(view))
  const section = view.nodes(node => node.type === 'section' && node.props['aria-labelledby'])[0]
  section.props.onKeyDown({ key: 'Escape' }); view.render()
  assert.equal(view.focus, view.button('Dagsform'))
})

function luminance(hex) {
  const rgb = hex.match(/[a-f\d]{2}/gi).map(value => parseInt(value, 16) / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722
}
const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + 0.05) /
  (Math.min(luminance(a), luminance(b)) + 0.05)
function assertSelection(view, label, value) {
  const buttons = view.nodes(node => node.props['aria-label']?.startsWith(`${label} `))
  assert.equal(buttons.length, 5)
  assert.equal(buttons.filter(node => node.props['aria-pressed']).length, 1)
  for (const node of buttons) {
    const selected = node.props['aria-label'] === `${label} ${value}`
    assert.equal(node.props['aria-pressed'], selected)
    const markers = node.children.filter(child => child?.type === 'span')
    assert.equal(markers.length, selected ? 1 : 0)
    if (selected) {
      assert.equal(markers[0].props['aria-hidden'], true)
      assert.match(markers[0].children.join(''), /✓/)
      assert.ok(contrast(node.props.style.borderColor, '#1c1c18') >= 3)
      assert.ok(contrast(node.props.style.borderColor, node.props.style.background) >= 3)
      assert.ok(contrast(node.props.style.color, node.props.style.background) >= 4.5)
    }
    assert.ok(node.props.style.minWidth >= 44)
    assert.ok(node.props.style.minHeight >= 44)
    assert.equal(node.props.style.boxSizing, 'border-box')
    assert.equal(node.props.style.borderWidth, 2)
  }
}
test('fast energy and all four full-form score groups have visible non-colour selection and contrast', t => {
  const { view } = fixture(t)
  for (const value of [1, 2, 3, 4, 5]) { view.click(`Energi ${value}`); assertSelection(view, 'Energi', value) }
  view.click('Ret øvrige svar')
  for (const label of ['Energi', 'Motivation', 'Stress', 'Ømhed'])
    for (const value of [1, 2, 3, 4, 5]) { view.click(`${label} ${value}`); assertSelection(view, label, value) }
})

test('detached heading refs are cleared before effects; OFF and preview remove every control', t => {
  for (const extra of [{ enabled: false }, { sessionReadOnly: true }]) {
    const { view } = fixture(t)
    view.click('Ret øvrige svar')
    const oldHeading = heading(view)
    view.render(extra)
    assert.equal(view.tree, null)
    assert.equal(oldHeading.isConnected, false)
    assert.equal(view.focus, null)
    view.render()
    assert.equal(view.focus, null)
  }
})
