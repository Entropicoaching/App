import test from 'node:test'
import assert from 'node:assert/strict'
import { createDocument, elements } from '../onboarding/firstVisitDom.mjs'
import { manualClock } from '../tracking/hurtig/testFixtures.mjs'

// App npm test discovers this file. Never substitute synthetic React here.
let h, act, useState, createRoot, QuickLogs, missing = false
try {
  ;({ createElement: h, act, useState } = await import('react'))
  ;({ createRoot } = await import('react-dom/client'))
} catch (error) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND' || !/Cannot find package '(react|react-dom)'/.test(error.message)) throw error
  missing = true
}
if (!missing) ({ default: QuickLogs } = await import('./QuickLogs.mjs'))
const gate = { skip: missing ? 'Pinned copy lacks real React/react-dom; required Dhurva merge gate, installation forbidden.' : false }

async function fixture(t) {
  const doc = createDocument(), host = doc.createElement('div'), time = manualClock(), focuses = []
  doc.body.appendChild(host)
  const connected = node => {
    for (let current = node; current; current = current.parentNode) if (current === doc.body) return true
    return false
  }
  const create = doc.createElement
  doc.createElement = tag => {
    const node = create(tag), focus = node.focus.bind(node)
    node.focus = () => { assert.ok(connected(node), 'focus target must be mounted'); focuses.push(node); focus() }
    return node
  }
  const previous = new Map(['window', 'IS_REACT_ACT_ENVIRONMENT'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  Object.defineProperty(globalThis, 'window', { configurable: true, value: doc.defaultView })
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, value: true })
  const athlete = { id: 'synthetic-readiness-react' }, today = '2026-11-04'
  function Harness({ extra }) {
    const [input, setInput] = useState({ sleep: '', energy: null, motivation: null, stress: null, soreness: null })
    return h(QuickLogs, { enabled: true, athlete, today, quickClock: time.clock,
      getNow: () => new Date('2026-11-04T12:00:00Z'),
      trackingData: { status: 'ready', complete: true, athleteId: athlete.id, today,
        readinessRows: [{ athlete_id: athlete.id, logged_date: '2026-11-03',
          energy: 2, motivation: 4, stress: 2, soreness_level: 1 }] },
      readinessInput: input, setReadinessInput: setInput, weightInput: '', weightLogs: [],
      setWeightInput() {}, saveReadiness() { assert.fail('focus/selection must not save') },
      logWeight() { assert.fail('focus/selection must not save weight') }, ...extra })
  }
  const root = createRoot(host)
  t.after(async () => {
    try { await act(async () => root.unmount()); assert.equal(time.handles(), 0) }
    finally {
      for (const [key, descriptor] of previous) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]
      }
    }
  })
  const render = async extra => { await act(async () => root.render(h(Harness, { extra }))) }
  const button = label => elements(host).find(node => node.tagName === 'BUTTON' &&
    (node.getAttribute('aria-label') === label || node.textContent === label))
  const dispatch = async (target, type, extra = {}) => {
    assert.ok(target)
    const event = { type, target, button: 0, bubbles: true, preventDefault() {}, stopPropagation() {}, ...extra }
    await act(async () => {
      host.events.get(`${type}:capture`)?.(event)
      assert.ok(host.events.get(`${type}:bubble`), 'React delegated event installed')
      host.events.get(`${type}:bubble`)(event)
    })
  }
  const click = async label => {
    const target = button(label); assert.ok(target); assert.equal(target.disabled, false)
    target.focus(); await dispatch(target, 'click'); return target
  }
  await render()
  return { doc, host, focuses, connected, render, button, click, dispatch,
    heading: () => elements(host).find(node => node.tagName === 'H2') }
}

for (const energyFirst of [false, true]) test(`real ReactDOM: expand focuses mounted heading, then close returns to Dagsform; energy first: ${energyFirst}`, gate, async t => {
  const f = await fixture(t), opener = f.button('Dagsform')
  if (energyFirst) {
    for (const value of [2, 5]) {
      const score = await f.click(`Energi ${value}`)
      assert.equal(f.doc.activeElement, score)
    }
  }
  const edit = await f.click('Ret øvrige svar')
  assert.equal(f.connected(edit), false)
  assert.equal(f.doc.activeElement, f.heading())
  assert.equal(f.heading().getAttribute('tabindex'), '-1')
  const count = f.focuses.length
  await f.render()
  assert.equal(f.focuses.length, count)
  const score = await f.click('Motivation 2')
  assert.equal(f.doc.activeElement, score)
  await f.click('Luk')
  assert.equal(f.doc.activeElement, opener)
  assert.ok(f.connected(opener))
  await f.click('Dagsform')
  assert.equal(f.doc.activeElement, f.heading())
  await f.dispatch(f.heading(), 'keydown', { key: 'Escape', keyCode: 27 })
  assert.equal(f.doc.activeElement, opener)
})

test('real ReactDOM: visible checkmarks track aria-pressed across fast energy and every full score group', gate, async t => {
  const f = await fixture(t)
  const assertSelected = (label, value) => {
    const buttons = elements(f.host).filter(node => node.tagName === 'BUTTON' &&
      node.getAttribute('aria-label')?.startsWith(`${label} `))
    assert.equal(buttons.length, 5)
    assert.equal(buttons.filter(node => node.getAttribute('aria-pressed') === 'true').length, 1)
    for (const button of buttons) {
      const selected = button.getAttribute('aria-label') === `${label} ${value}`
      assert.equal(button.getAttribute('aria-pressed'), String(selected))
      const marks = elements(button).filter(node => node.tagName === 'SPAN')
      assert.equal(marks.length, selected ? 1 : 0)
      if (selected) {
        assert.equal(marks[0].getAttribute('aria-hidden'), 'true')
        assert.match(marks[0].textContent, /✓/)
        assert.equal(button.style.borderColor, '#b8b4a8')
      }
    }
  }
  for (const value of [1, 2, 3, 4, 5]) { await f.click(`Energi ${value}`); assertSelected('Energi', value) }
  await f.click('Ret øvrige svar')
  for (const label of ['Energi', 'Motivation', 'Stress', 'Ømhed'])
    for (const value of [1, 2, 3, 4, 5]) { await f.click(`${label} ${value}`); assertSelected(label, value) }
  for (const extra of [{ enabled: false }, { sessionReadOnly: true }]) {
    await f.render(extra)
    assert.equal(f.host.textContent, '')
    assert.equal(elements(f.host).filter(node => node.tagName === 'BUTTON').length, 0)
  }
})
