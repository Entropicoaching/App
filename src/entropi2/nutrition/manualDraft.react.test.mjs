// Real ReactDOM and mounted product consumer; synthetic DOM/data, no browser.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h, act } from 'react'
import { createRoot } from 'react-dom/client'
import Entropi2Kost from '../Entropi2Kost.mjs'
import { sessionReactDocument } from '../session/sessionQuickSetReactDom.mjs'
import { fixture, athleteId, date, flush } from '../kostplan/atlet/daySession.fixture.mjs'

const key = (host, value) => host.querySelectorAll('[data-focus]').find(n => n.getAttribute('data-focus') === value)
const labels = ['Måltid', 'Energi (kcal)', 'Protein (g)', 'Kulhydrat (g)', 'Fedt (g)']
const values = ['Syntetisk kladde <&>', '125,5', '', '0', '2,5']
const field = (host, label) => key(host, 'field-' + label)
const manualForm = host => field(host, 'Måltid').parentElement.parentElement
function enter(host, data = values) {
  labels.forEach((label, i) => { const n = field(host, label); assert.ok(n, label); n.value = data[i]; n.dispatch('input', { target: n }) })
}
function unchanged(host, data = values) { labels.forEach((label, i) => assert.equal(field(host, label).value, data[i], label)) }

async function mounted(run) {
  let release
  const gate = new Promise(resolve => { release = resolve })
  const f = fixture({ before: () => gate }); f.approve()
  const doc = sessionReactDocument(), host = doc.createElement('div')
  doc.body.append(host)
  const replacements = { window: doc.defaultView, IS_REACT_ACT_ENVIRONMENT: true, localStorage: f.storage }
  const originals = new Map(Object.keys(replacements).map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]))
  for (const [k, value] of Object.entries(replacements)) Object.defineProperty(globalThis, k, { configurable: true, value })
  let root
  const props = { enabled: true, athlete: { id: athleteId }, date, client: f.client,
    foods: [{ name: 'Syntetisk vare', kcal100: 100, protein100: 0, carb100: 0, fat100: 0 }],
    weightLogs: [], weightStatus: { athleteId, state: 'loading' } }
  const show = () => act(async () => { root.render(h(Entropi2Kost, props)); await flush() })
  try {
    root = createRoot(host); await show()
    await run({ f, doc, host, props, show, release })
  } finally {
    release()
    try { if (root) await act(async () => root.unmount()) }
    finally {
      for (const [k, descriptor] of originals) {
        if (descriptor) Object.defineProperty(globalThis, k, descriptor)
        else delete globalThis[k]
      }
    }
  }
}

test('manual real ReactDOM: late plan/weight context preserves all fields, quantity, caret, feedback and explicit save', async () => {
  await mounted(async ({ f, doc, host, props, show, release }) => {
    key(host, 'log-form').open = true
    enter(host)
    const quantity = key(host, 'field-Mængde'); quantity.value = '62,5'; quantity.dispatch('input', { target: quantity })
    await act(async () => { release(); await flush() })
    unchanged(host); assert.equal(key(host, 'field-Mængde').value, '62,5')
    assert.equal(key(host, 'log-form').open, true)
    assert.equal(key(host, 'manual-feedback').textContent, 'Mangler: Protein (g).')
    // The late plan wraps the tracker in a collapsed outer disclosure. Open it
    // before testing focus; the view deliberately never focuses hidden content.
    host.querySelectorAll('summary').find(n => n.textContent === 'Kostlog og vejning').parentElement.open = true
    const name = field(host, 'Måltid'); name.focus(); name.setSelectionRange(3, 7)
    props.weightStatus = { athleteId, state: 'ready' }
    await show()
    unchanged(host)
    assert.ok(doc.activeElement === field(host, 'Måltid'), 'name retains focus')
    assert.deepEqual([doc.activeElement.selectionStart, doc.activeElement.selectionEnd], [3, 7])
    await act(async () => { manualForm(host).dispatch('submit'); await flush() })
    assert.ok(doc.activeElement === field(host, 'Protein (g)'), 'first missing field receives focus')
    assert.equal(field(host, 'Protein (g)').getAttribute('aria-invalid'), 'true')
    unchanged(host); assert.equal(f.rows.length, 0)
    const protein = field(host, 'Protein (g)'); protein.value = '0'; protein.dispatch('input', { target: protein })
    assert.equal(key(host, 'manual-feedback').textContent, '')
    assert.equal(f.rows.length, 0)
    await act(async () => { manualForm(host).dispatch('submit'); await flush() })
    assert.equal(f.rows.length, 1)
    assert.deepEqual(f.rows[0], { id: 'synthetic-diary-1', athlete_id: athleteId, date,
      meal: values[0], kcal: 125.5, protein: 0, carb: 0, fat: 2.5 })
    unchanged(host, labels.map(() => ''))
    assert.equal(f.plan.writes().length, 0)
  })
})

for (const switchTo of ['date', 'athlete']) test('manual real ReactDOM: delayed old context cannot populate or submit after ' + switchTo + ' switch', async () => {
  await mounted(async ({ f, host, props, show, release }) => {
    enter(host)
    const staleForm = manualForm(host), staleProtein = field(host, 'Protein (g)')
    if (switchTo === 'date') props.date = '2026-11-06'
    else props.athlete = { id: 'synthetic-other-athlete' }
    await show()
    await act(async () => { release(); await flush() })
    unchanged(host, labels.map(() => ''))
    assert.equal(key(host, 'log-form').open, false)
    await act(async () => {
      staleProtein.value = '0'; staleProtein.dispatch('input', { target: staleProtein })
      staleForm.dispatch('submit'); await flush()
    })
    unchanged(host, labels.map(() => ''))
    assert.equal(f.rows.length, 0)
    assert.equal(f.calls.filter(c => c.action === 'insert').length, 0)
    assert.equal(f.plan.writes().length, 0)
  })
})
