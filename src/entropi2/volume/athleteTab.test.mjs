import './tabJsxLoader.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
const { default: VolumenTab } = await import('../../athlete/VolumenTab.jsx')

const props = { now: '2026-11-04', volumeLoading: false, volumeLogs: [
  { exercises: { name: 'Squat' }, logged_at: '2026-11-03' },
  { exercises: { name: 'Bænkpres' }, logged_at: '2026-10-28' },
] }
const render = extra => renderToStaticMarkup(createElement(VolumenTab, { ...props, ...extra }))

test('existing tab defaults to the new weekly screen with a single heading and folded details', () => {
  const html = render()
  assert.match(html, /data-entropi2-volume/)
  assert.equal((html.match(/<h1\b/g) || []).length, 1)
  assert.match(html, /uge 45, 2026/)
  assert.match(html, /uge 44, 2026/)
  assert.match(html, /Knæ-strækkere/)
  assert.match(html, /Brystmuskel/)
  assert.match(html, /0,5/)
  assert.match(html, /<details><summary/)
  assert.doesNotMatch(html, /<details[^>]*\bopen|Seneste 4 uger|Direkte sæt \/ i alt/)
})

test('loaded empty, loading, unavailable and explicit error remain distinct', () => {
  assert.match(render({ volumeLogs: [] }), /ikke gennemført sæt i disse to uger/)
  assert.match(render({ volumeLoading: true }), /Henter din volumen/)
  assert.match(render({ volumeLogs: null }), /ikke klar endnu/)
  const failed = render({ volumeError: true })
  assert.match(failed, /role="alert"/)
  assert.match(failed, /kunne ikke hentes/)
  assert.doesNotMatch(failed, /<table|ikke gennemført/)
})

test('explicit OFF and nonboolean values preserve the legacy screen', () => {
  for (const entropi2 of [false, null, 0, 1, 'true']) {
    const html = render({ entropi2 })
    assert.doesNotMatch(html, /data-entropi2-volume/)
    assert.match(html, /Din volumen\./)
    assert.match(html, /Volumen pr. muskelgruppe/)
  }
})
