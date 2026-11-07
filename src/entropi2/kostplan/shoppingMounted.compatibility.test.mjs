// Actual React/ReactDOM; synthetic document/storage/client, no business stubs.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h, act, StrictMode, useLayoutEffect } from 'react'
import { createRoot } from 'react-dom/client'
import * as nativeHost from '../../athlete/coachOwnTrainingFixture.mjs'
import Entropi2Kost from '../Entropi2Kost.mjs'
import { sessionReactDocument } from '../session/sessionQuickSetReactDom.mjs'
import { fixture, athleteId, date, flush } from './atlet/daySession.fixture.mjs'
import { propsOf } from '../nutrition/diaryTemplate.fixture.mjs'

async function mounted(storage, fn) {
  const doc = sessionReactDocument(), host = doc.createElement('div')
  doc.body.append(host)
  const values = { window: doc.defaultView, IS_REACT_ACT_ENVIRONMENT: true, localStorage: storage }
  const original = new Map(Object.keys(values).map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]))
  for (const [k, value] of Object.entries(values)) Object.defineProperty(globalThis, k, { configurable: true, value })
  const root = createRoot(host)
  try { await fn(root, host) }
  finally {
    try { await act(async () => root.unmount()) }
    finally { for (const [k, descriptor] of original) { if (descriptor) Object.defineProperty(globalThis, k, descriptor); else delete globalThis[k] } }
  }
}

test('historical facade exposes genuine React layout dispatcher, dependency updates and StrictMode cleanup', async () => {
  assert.equal(nativeHost.useLayoutEffect, useLayoutEffect)
  const events = [], storage = fixture().storage
  function Probe({ id }) {
    nativeHost.useLayoutEffect(() => { events.push(`setup:${id}`); return () => events.push(`cleanup:${id}`) }, [id])
    return h('span', null, id)
  }
  await mounted(storage, async (root, host) => {
    await act(async () => root.render(h(StrictMode, null, h(Probe, { id: 'A' }))))
    assert.deepEqual(events, ['setup:A', 'cleanup:A', 'setup:A'])
    await act(async () => root.render(h(StrictMode, null, h(Probe, { id: 'B' }))))
    assert.equal(host.textContent, 'B')
    assert.deepEqual(events, ['setup:A', 'cleanup:A', 'setup:A', 'cleanup:A', 'setup:B'])
  })
  assert.equal(events.at(-1), 'cleanup:B')
})

test('actual mounted StrictMode entry shares three pending schema probes across shopping and day facades without suppressing either reader', async () => {
  let release
  const gate = new Promise(resolve => { release = resolve })
  const f = fixture({ before: call => call.limit === 0 ? gate : undefined }); f.approve()
  try {
    await mounted(f.storage, async (root, host) => {
      const props = { enabled: true, athlete: { id: athleteId, kcal_target: 2000, protein_target: 150 }, date, client: f.client, foods: [] }
      const show = () => act(async () => { root.render(h(StrictMode, null, h(Entropi2Kost, props))); await flush() })
      await show()
      await act(async () => { release(); for (let i = 0; i < 5; i++) await flush() })
      assert.equal(f.plan.calls.filter(c => c.limit === 0).length, 3)
      assert.match(host.textContent, /Dagens kostplan/)
      assert.match(host.textContent, /Alle valgte datoer er læst fra godkendte versioner/)
      assert.ok(host.querySelector('[data-entropi2-kost]'))
      assert.equal(host.querySelector('[data-shopping-complete]').getAttribute('data-shopping-complete'), 'true')
      const planReads = f.plan.calls.filter(c => c.limit !== 0).length
      const retry = Array.from(host.querySelectorAll('button')).find(n => n.textContent === 'Hent indkøbsgrundlag igen')
      await act(async () => { await propsOf(retry).onClick(); for (let i = 0; i < 5; i++) await flush() })
      assert.ok(f.plan.calls.filter(c => c.limit === 0).length > 3)
      assert.ok(f.plan.calls.filter(c => c.limit !== 0).length > planReads)
      assert.equal(f.plan.writes().length, 0); assert.equal(f.rows.length, 0)
      props.enabled = false
      const offTouches = []
      // Match the real client's non-enumerable method boundary: React's dev
      // profiler enumerates changed prop objects and would itself read a getter.
      props.client = Object.defineProperty({}, 'from', { get() { offTouches.push(new Error('OFF transport read').stack); return f.client.from } })
      await show(); assert.equal(host.textContent, '')
      assert.deepEqual(offTouches, [])
      props.enabled = true; props.athlete = null
      await show(); assert.equal(host.textContent, '')
      assert.deepEqual(offTouches, [])
    })
  } finally { release() }
})
