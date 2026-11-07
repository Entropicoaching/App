// Required real React/ReactDOM with the existing in-memory DOM. No loader,
// replacement React, browser, server, storage service or optional dependency gate.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h, act } from 'react'
import { createRoot } from 'react-dom/client'
import Entropi2Kost from '../../Entropi2Kost.mjs'
import { sessionReactDocument } from '../../session/sessionQuickSetReactDom.mjs'
import { fixture, athleteId, date, flush } from './daySession.fixture.mjs'
import { tableNames } from '../coach/activation.fixture.mjs'

async function withRoot(f, run) {
  const doc = sessionReactDocument(), host = doc.createElement('div')
  doc.body.append(host)
  const globals = { window: doc.defaultView, IS_REACT_ACT_ENVIRONMENT: true, localStorage: f.storage }
  const originals = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, value })
  const root = createRoot(host)
  const props = { enabled: true, athlete: { id: athleteId, kcal_target: 2400, protein_target: 160 }, date,
    client: f.client, foods: [], weightLogs: [] }
  const show = () => act(async () => { root.render(h(Entropi2Kost, props)); await flush() })
  try { await run({ host, props, show }) }
  finally {
    try { await act(async () => root.unmount()) }
    finally {
      for (const [key, descriptor] of originals) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor)
        else delete globalThis[key]
      }
    }
  }
}

test('real ReactDOM daily targets: actual Entropi2Kost wiring updates both views without losing a tracker draft, then handles one synthetic click', async () => {
  let release
  const gate = new Promise(resolve => { release = resolve })
  const f = fixture({ before: () => gate }); f.approve()
  await withRoot(f, async ({ host, show, props }) => {
    try {
      await show()
      const tracker = () => host.querySelector('[data-entropi2-kost]')
      const hero = () => tracker().querySelector('[data-kost-del="maal"]')
      assert.match(hero().textContent, /Profilens mål.*2.400 kcal.*160 g/)
      const field = tracker().querySelector('[data-focus="field-Måltid"]')
      field.value = 'Syntetisk ufærdigt måltid'; field.dispatch('input', { target: field })
      const content = tracker().firstChild
      await act(async () => { release(); await flush() })
      assert.equal(tracker().firstChild, content)
      assert.equal(tracker().querySelector('[data-focus="field-Måltid"]').value, 'Syntetisk ufærdigt måltid')
      assert.match(hero().textContent, /Aktiv plans indhold.*500 kcal.*50 g/)
      assert.doesNotMatch(hero().textContent, /2.400|160 g/)
      const status = () => host.querySelectorAll('section').find(n => n.getAttribute('aria-label') === 'Dagens status')
      assert.match(status().textContent, /Tilbage i dag: 500 kcal · 50 g protein/)
      assert.match(tracker().textContent, /500 kcal · 50 g protein/)
      const eat = host.querySelectorAll('button').find(n => n.getAttribute('aria-label') === 'Frokost <syntetisk>: Spist som planlagt')
      // The minimal DOM does not bubble. Deliver the native-shaped event to
      // ReactDOM's actual delegated listeners; never call replacement logic.
      await act(async () => {
        host.dispatch('click', { type: 'click', target: eat, button: 0, bubbles: true, stopPropagation() {} })
        await flush()
      })
      assert.equal(f.rows.length, 1)
      assert.match(status().textContent, /Tilbage i dag: 300 kcal · 30 g protein/)
      assert.match(tracker().textContent, /300 kcal · 30 g protein/)
      assert.match(hero().textContent, /500 kcal.*50 g/)
      assert.equal(tracker().querySelector('[data-focus="field-Måltid"]').value, 'Syntetisk ufærdigt måltid')
      assert.equal(f.plan.writes().length, 0)
      props.enabled = false; await show(); assert.equal(host.textContent, '')
      props.enabled = true; await show()
      assert.match(hero().textContent, /500 kcal.*50 g/)
      assert.match(status().textContent, /1 af 2 måltider spist/)
      assert.equal(f.rows.length, 1)
    } finally { release() }
  })
})

test('real ReactDOM daily targets: owner replacement ignores a delayed prior plan; date/athlete switches restore scoped fallback', async () => {
  let release
  const gate = new Promise(resolve => { release = resolve })
  const f = fixture({ before: () => gate }); f.approve()
  await withRoot(f, async ({ host, props, show }) => {
    try {
      await show()
      const other = fixture(); props.client = other.client
      await show(); await act(async () => { release(); await flush() })
      assert.doesNotMatch(host.textContent, /Dagens kostplan|500 kcal/)
      assert.match(host.textContent, /Profilens mål.*2.400 kcal/)
      props.client = f.client; await show(); assert.match(host.textContent, /Dagens kostplan/)
      props.date = '2026-11-04'; await show()
      assert.doesNotMatch(host.textContent, /Dagens kostplan|500 kcal/)
      props.date = date; props.athlete = { ...props.athlete, id: 'synthetic-other' }; await show()
      assert.doesNotMatch(host.textContent, /Dagens kostplan|500 kcal/)
      assert.equal(f.plan.writes().length, 0); assert.equal(other.plan.writes().length, 0)
    } finally { release() }
  })
})

test('real ReactDOM daily targets: missing schema and unknown approved protein remain explicitly different from profile guesses', async () => {
  const missing = fixture({ missing: true })
  await withRoot(missing, async ({ host, show }) => {
    await show(); assert.match(host.textContent, /Profilens mål/); assert.doesNotMatch(host.textContent, /Dagens kostplan/)
    assert.equal(missing.plan.writes().length, 0)
  })
  const f = fixture(); f.approve()
  const v = structuredClone(f.plan.data[tableNames[1]][0])
  v.meals[0].portions[0].food.nutrientsPer100g.proteinG = null
  f.plan.data[tableNames[1]][0] = v
  await withRoot(f, async ({ host, show }) => {
    await show()
    const hero = host.querySelector('[data-kost-del="maal"]')
    assert.match(hero.textContent, /Aktiv plans indhold.*500 kcal/)
    assert.doesNotMatch(hero.textContent, /160 g|Protein: 50/)
    assert.match(host.textContent, /protein ukendt|mål mangler/)
    assert.equal(f.rows.length, 0)
  })
})
