import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h, act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import HomeSession from './HomeSession.mjs'
import { sessionRecordFixture } from '../session/sessionRecordFixture.mjs'
import { sessionReactDocument } from '../session/sessionQuickSetReactDom.mjs'

// Ordre 1704: den rigtige HomeSession laeser coachens opvarmning én gang pr. atlet
// og viser den i dagens pas. Raekker fra en anden atlets laesning vises aldrig.
async function render(t, reader) {
  const f = sessionRecordFixture(t), doc = sessionReactDocument(), host = doc.createElement('div')
  doc.body.append(host)
  const replacements = { window: doc.defaultView, IS_REACT_ACT_ENVIRONMENT: true,
    setTimeout: f.clock.setTimeout, clearTimeout: f.clock.clearTimeout, setInterval() { return 1 }, clearInterval() {} }
  const originals = Object.fromEntries(Object.keys(replacements).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  for (const [key, value] of Object.entries(replacements)) Object.defineProperty(globalThis, key, { configurable: true, value })
  const root = createRoot(host)
  let rerender
  function App() {
    const [, update] = useState(0)
    rerender = () => update(n => n + 1)
    f.onChange(rerender)
    return h(HomeSession, { ...f.p, readHomeRecordHistory: async () => ({ status: 'ready', complete: true, athleteId: f.p.athlete.id, rows: [] }),
      readHomeRpeLastTime: async () => false, readCoachWarmupTemplates: reader })
  }
  t.after(async () => {
    await act(async () => root.unmount())
    for (const [key, value] of Object.entries(originals)) {
      if (value) Object.defineProperty(globalThis, key, value); else delete globalThis[key]
    }
  })
  await act(async () => { root.render(h(App)); await new Promise(resolve => setImmediate(resolve)) })
  const start = host.querySelectorAll('button').find(b => b.textContent === 'Start dagens pas')
  await act(async () => {
    host.dispatch('click', { type: 'click', target: start, button: 0, bubbles: true, stopPropagation() {} })
    await import('../session/sessionView.mjs')
    await new Promise(resolve => setImmediate(resolve))
  })
  return { f, host }
}

test('ordre 1704: real HomeSession reads own templates once and shows the coach squat warmup', async t => {
  const reads = []
  const { f, host } = await render(t, async ({ athleteId }) => {
    reads.push(athleteId)
    return [{ exercise_category: 'Squat', steps: ['Hoftecirkler 2 x 10'] }]
  })
  assert.deepEqual(reads, [f.p.athlete.id])
  const warm = host.querySelector('dialog').querySelector('[data-detail="warmup"]')
  assert.equal(warm.querySelectorAll('h3').filter(n => n.textContent === 'Fra din coach').length, 1)
  assert.match(warm.textContent, /Hoftecirkler 2 x 10/)
})

test('ordre 1704: failed or empty read keeps the computed ramp', async t => {
  const { host } = await render(t, async () => { throw Error('net') })
  const warm = host.querySelector('dialog').querySelector('[data-detail="warmup"]')
  assert.doesNotMatch(warm.textContent, /Fra din coach/)
  assert.match(warm.textContent, /af arbejdsvægten/)
})
