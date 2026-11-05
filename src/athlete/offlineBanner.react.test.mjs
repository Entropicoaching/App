// Mandatory app-dependency regression. Missing real React must fail, never skip.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { installOfflineBannerLoader } from './offlineBannerLoader.mjs'
import { markNetworkSuccess } from '../offlineSession.js'

installOfflineBannerLoader()
const { default: Banner } = await import('./IngenForbindelse.jsx')
const snapshot = '2026-11-05T07:00:00Z'
function show(online, props = {}) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: online } })
  markNetworkSuccess()
  try { return renderToStaticMarkup(createElement(Banner, props)) }
  finally {
    if (descriptor) Object.defineProperty(globalThis, 'navigator', descriptor)
    else delete globalThis.navigator
  }
}

test('real React: fresh online data has no offline banner in either mode', () => {
  for (const entropi2 of [false, true]) assert.equal(show(true, { entropi2 }), '')
})

test('real React: cached Entropi 2 program requires network before session start', () => {
  for (const online of [false, true]) {
    const html = show(online, { entropi2: true, offlineSnapshotAt: snapshot })
    assert.match(html, /role="status"/)
    assert.match(html, /Du ser et gemt program\./)
    assert.match(html, /Gå på net og opdatér programmet, før du starter et pas\./)
    assert.match(html, /Program fra kl\./)
    assert.doesNotMatch(html, /Dagens pas og dine sæt virker|gemme sæt lokalt/)
  }
})

test('real React: offline open session explains local storage and deferred sending', () => {
  const html = show(false, { entropi2: true })
  assert.match(html, /Ingen forbindelse\./)
  assert.match(html, /I et åbent pas kan du gemme sæt lokalt\. De sendes, når du har net\./)
  assert.doesNotMatch(html, /Dagens pas og dine sæt virker|Program fra kl\./)
})

test('real React: strict OFF preserves the legacy text for offline and cached data', () => {
  for (const entropi2 of [undefined, false, null, 0, 1, 'true']) {
    for (const [online, offlineSnapshotAt] of [[false, undefined], [false, snapshot], [true, snapshot]]) {
      const html = show(online, { entropi2, offlineSnapshotAt })
      assert.match(html, /Dagens pas og dine sæt virker; resten opdateres, når du har net\./)
      assert.doesNotMatch(html, /Du ser et gemt program|I et åbent pas/)
    }
  }
})
