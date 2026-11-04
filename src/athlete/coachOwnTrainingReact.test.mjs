import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { loadViews, seed, begin, session, ownAthlete, otherAthlete } from './coachOwnTrainingFixture.mjs'

const { default: AthleteView, dispose } = await loadViews({ realReact: true })
test.after(dispose)
const NativeDate = globalThis.Date
globalThis.Date = class extends NativeDate {
  constructor(...args) { super(...(args.length ? args : ['2026-11-04T12:00:00Z'])) }
  static now() { return new NativeDate('2026-11-04T12:00:00Z').getTime() }
}
test.after(() => { globalThis.Date = NativeDate })
const html = (athlete, requestedTab = 'hjem', extra = {}) => {
  seed({ athlete, requestedTab }); begin()
  return renderToStaticMarkup(h(AthleteView, { role: 'coach', session, coachAthleteId: athlete.id,
    onExitPreview() {}, ...extra }))
}

test('real React renders the actual coach AthleteView and its E2 Home rather than an isolated Home component', () => {
  const own = html(ownAthlete)
  assert.match(own, /data-entropi2-athlete/)
  assert.match(own, /data-entropi2-home-session/)
  assert.match(own, /Klar til dit pas, Testprofil/)
  assert.match(own, /Testpas/)
  assert.match(own, /Coach view/)
  assert.doesNotMatch(own, /<fieldset[^>]*disabled/)
  const preview = html(otherAthlete)
  assert.match(preview, /data-entropi2-home-session/)
  assert.match(preview, /Forhåndsvisning/)
  assert.match(preview, /<fieldset[^>]*disabled/)
  assert.match(preview, /Start dagens pas|Start næste pas/)
  assert.match(preview, /data-test-boundary="BundNav"/)
})

test('real React coach screens cover nutrition, analysis, mobility, conversation and explicit OFF', () => {
  for (const athlete of [ownAthlete, otherAthlete]) {
    assert.match(html(athlete, 'kost'), /data-entropi2-kost/)
    assert.match(html(athlete, 'fremgang'), /data-entropi2-analysis/)
    assert.match(html(athlete, 'mobilisering'), /data-entropi2-mobility/)
    assert.match(html(athlete, 'beskeder'), /Beskeder og video|Samlet samtale/)
    for (const tab of ['hjem', 'kost', 'fremgang', 'mobilisering', 'beskeder']) {
      const off = html(athlete, tab, { entropi2: false })
      assert.doesNotMatch(off, /data-entropi2-athlete|data-entropi2-home-session|<fieldset/)
    }
  }
})
