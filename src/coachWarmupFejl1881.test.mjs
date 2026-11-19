import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h, act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { readCoachWarmup } from './entropi2/session/opvarmning/coachWarmup.mjs'
import HomeSession from './entropi2/home/HomeSession.mjs'
import { sessionRecordFixture } from './entropi2/session/sessionRecordFixture.mjs'
import { sessionReactDocument } from './entropi2/session/sessionQuickSetReactDom.mjs'

// Ordre 1881: en fejlet laesning af coachens opvarmning skelnes fra "ingen skabelon".
const NOTICE = 'Coachens opvarmning kunne ikke hentes. Her er et forslag.'
const squat = { exercise_category: 'Squat', steps: ['Hoftecirkler 2 x 10'] }
const client = result => ({ from: () => ({ select: () => ({ eq: () => Promise.resolve(result) }) }) })

test('ordre 1881: readCoachWarmup separates failed reads from no templates', async () => {
  assert.deepEqual(await readCoachWarmup({ athleteId: 'a', client: client({ data: [squat] }) }), { templates: [squat], failed: false })
  assert.deepEqual(await readCoachWarmup({ athleteId: 'a', client: client({ data: [] }) }), { templates: [], failed: false })
  assert.deepEqual(await readCoachWarmup({ athleteId: 'a', client: client({ error: { message: 'x' }, data: null }) }), { templates: [], failed: true })
  assert.deepEqual(await readCoachWarmup({ athleteId: 'a', client: client({ data: null }) }), { templates: [], failed: true })
  assert.deepEqual(await readCoachWarmup({ athleteId: 'a', client: { from() { throw Error('net') } } }), { templates: [], failed: true })
  assert.deepEqual(await readCoachWarmup({ athleteId: '' }), { templates: [], failed: false })
})

async function render(t, reader) {
  const f = sessionRecordFixture(t), doc = sessionReactDocument(), host = doc.createElement('div')
  doc.body.append(host)
  const replacements = { window: doc.defaultView, IS_REACT_ACT_ENVIRONMENT: true,
    setTimeout: f.clock.setTimeout, clearTimeout: f.clock.clearTimeout, setInterval() { return 1 }, clearInterval() {} }
  const originals = Object.fromEntries(Object.keys(replacements).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  for (const [key, value] of Object.entries(replacements)) Object.defineProperty(globalThis, key, { configurable: true, value })
  const root = createRoot(host)
  function App() {
    const [, update] = useState(0)
    f.onChange(() => update(n => n + 1))
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
    await import('./entropi2/session/sessionView.mjs')
    await new Promise(resolve => setImmediate(resolve))
  })
  return host.querySelector('dialog').querySelector('[data-detail="warmup"]')
}

test('ordre 1881: failed read (error result) shows one line above the computed ramp', async t => {
  const warm = await render(t, async () => ({ templates: [], failed: true }))
  assert.equal(warm.textContent.split(NOTICE).length - 1, 1)
  assert.doesNotMatch(warm.textContent, /Fra din coach/)
  assert.match(warm.textContent, /af arbejdsvægten/)
  assert.ok(warm.textContent.indexOf(NOTICE) < warm.textContent.indexOf('af arbejdsvægten'))
})

test('ordre 1881: throwing read shows the same line', async t => {
  const warm = await render(t, async () => { throw Error('net') })
  assert.equal(warm.textContent.split(NOTICE).length - 1, 1)
  assert.match(warm.textContent, /af arbejdsvægten/)
})

test('ordre 1881: no template or a fetched template shows no line', async t => {
  const none = await render(t, async () => ({ templates: [], failed: false }))
  assert.doesNotMatch(none.textContent, /kunne ikke hentes/)
  assert.match(none.textContent, /af arbejdsvægten/)
})

test('ordre 1881: fetched coach warmup shows as before without the line', async t => {
  const warm = await render(t, async () => ({ templates: [squat], failed: false }))
  assert.doesNotMatch(warm.textContent, /kunne ikke hentes/)
  assert.match(warm.textContent, /Hoftecirkler 2 x 10/)
})

test('ordre 1881: older list-only reader still works without the line', async t => {
  const legacy = await render(t, async () => [squat])
  assert.doesNotMatch(legacy.textContent, /kunne ikke hentes/)
  assert.match(legacy.textContent, /Hoftecirkler 2 x 10/)
})
