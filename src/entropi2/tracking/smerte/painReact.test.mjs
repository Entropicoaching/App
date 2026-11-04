import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import PainHistory from './PainHistory.mjs'

// Deliberately requires real app dependencies; no skip or replacement renderer.
const data = daily => ({ state: 'ready', complete: true, athleteId: 'synthetic-athlete', asOf: '2026-11-04', daily })
const html = props => renderToStaticMarkup(h(PainHistory, props))

test('real React: visible area, dated flag evidence, escaped text and folded history', () => {
  const rendered = html({ enabled: true, weeks: 4, data: data([
    { day: '2026-11-04', source: 'athlete_manual', pain: 7, painLocation: 'Testknæ <script>' },
  ]) })
  assert.match(rendered, /Flag: smerte 7\+/)
  assert.match(rendered, /Datagrundlag: 1 af 1/)
  assert.match(rendered, /2026-11-04: 7\/10/)
  assert.match(rendered, /Testknæ &lt;script&gt;/)
  assert.match(rendered, /Forslag til samtale/)
  assert.match(rendered, /<details><summary/)
  assert.doesNotMatch(rendered, /<details open|<script>|NaN|undefined/)
})

test('real React: empty, loading, error and OFF', () => {
  assert.match(html({ enabled: true, data: data([]) }), /Ingen indtastet smerte med kropsområde/)
  assert.match(html({ enabled: true, data: { state: 'loading' } }), /aria-busy="true"/)
  const failed = html({ enabled: true, data: { state: 'error' }, onRetry() {} })
  assert.match(failed, /role="alert"/)
  assert.match(failed, /Prøv igen/)
  assert.doesNotMatch(failed, /Flag:|Senest/)
  for (const enabled of [undefined, false, 'true', 1]) {
    assert.equal(html({ enabled, data: new Proxy({}, { get() { throw Error('OFF read') } }) }), '')
  }
})
