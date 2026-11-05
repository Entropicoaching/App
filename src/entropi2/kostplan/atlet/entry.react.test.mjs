// Mandatory React/ReactDOM reconciliation check, using the app's synthetic DOM.
// No React loader, skipped test, browser or external service.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h, act } from 'react'
import { createRoot } from 'react-dom/client'
import Entropi2Kost from '../../Entropi2Kost.mjs'
import { sessionReactDocument } from '../../session/sessionQuickSetReactDom.mjs'
import { fixture, athleteId, date, flush } from './daySession.fixture.mjs'

test('real ReactDOM: tracker stays usable across direct/plan parents; session, weight callbacks and cleanup survive', async () => {
  let release
  const gate = new Promise(resolve => { release = resolve })
  const f = fixture({ before: () => gate }); f.approve()
  const doc = sessionReactDocument(), host = doc.createElement('div'), calls = []
  doc.body.append(host)
  const replacements = { window: doc.defaultView, IS_REACT_ACT_ENVIRONMENT: true, localStorage: f.storage }
  const originals = new Map(Object.keys(replacements).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  for (const [key, value] of Object.entries(replacements)) Object.defineProperty(globalThis, key, { configurable: true, value })
  let root
  const props = { enabled: true, athlete: { id: athleteId, kcal_target: 2000, protein_target: 150 }, date,
    client: f.client, foods: [], weightLogs: [], weightStatus: { athleteId, state: 'error' },
    retryWeight: () => calls.push('first') }
  const show = () => act(async () => { root.render(h(Entropi2Kost, props)); await flush() })
  const tracker = () => host.querySelector('[data-entropi2-kost]')
  const retry = () => tracker().querySelectorAll('section').find(n => n.textContent.startsWith('Din vægt'))
    .querySelectorAll('button').find(n => n.textContent === 'Hent igen')
  try {
    root = createRoot(host); await show()
    const direct = tracker()
    assert.ok(direct)
    assert.match(direct.textContent, /Log hurtigt/)
    assert.doesNotMatch(host.textContent, /Dagens kostplan|Dagens kost kunne ikke hentes/)
    assert.equal(direct.parentElement.tagName, 'DIV')
    const content = direct.firstChild
    const draft = direct.querySelector('[data-focus="field-Måltid"]')
    assert.ok(draft); draft.value = 'Syntetisk kladde'; draft.dispatch('input', { target: draft })
    await act(async () => { release(); await flush() })
    const folded = tracker()
    assert.notEqual(folded, direct)
    assert.equal(direct.textContent, '')
    assert.equal(folded.parentElement.tagName, 'DETAILS')
    assert.equal(folded.firstChild, content)
    assert.equal(folded.querySelector('[data-focus="field-Måltid"]').value, 'Syntetisk kladde')
    assert.match(folded.textContent, /Log hurtigt/)
    assert.match(host.textContent, /Dagens kostplan/)
    assert.equal(f.plan.calls.filter(c => c.limit === 0).length, 3)
    props.retryWeight = () => calls.push('latest')
    await show()
    assert.equal(tracker(), folded)
    await act(async () => retry().click())
    assert.deepEqual(calls, ['latest'])
    assert.equal(f.rows.length, 0); assert.deepEqual(f.writes, []); assert.equal(f.plan.writes().length, 0)
    props.enabled = false
    await show()
    assert.equal(host.textContent, '')
    assert.equal(folded.textContent, '')
  } finally {
    release()
    try { if (root) await act(async () => root.unmount()) }
    finally {
      for (const [key, descriptor] of originals) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor)
        else delete globalThis[key]
      }
    }
  }
})
