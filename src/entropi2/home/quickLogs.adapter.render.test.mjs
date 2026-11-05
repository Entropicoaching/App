import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { loadViews, seed, session, ownAthlete, otherAthlete } from '../../athlete/coachOwnTrainingFixture.mjs'

// Genuine React hooks and SSR through the existing closed AthleteView fixture.
const { default: AthleteView, dispose } = await loadViews({ realReact: true })
test.after(dispose)
const NativeDate = globalThis.Date
globalThis.Date = class extends NativeDate {
  constructor(...args) { super(...(args.length ? args : ['2026-11-04T12:00:00Z'])) }
  static now() { return new NativeDate('2026-11-04T12:00:00Z').getTime() }
}
test.after(() => { globalThis.Date = NativeDate })
function shortcuts(role, athlete, preview = role === 'coach') {
  seed({ athlete, requestedTab: 'hjem' })
  const html = renderToStaticMarkup(h(AthleteView, { entropi2: true, session, role,
    coachAthleteId: preview ? athlete.id : null, onExitPreview: preview ? () => {} : undefined }))
  if (athlete === otherAthlete) { assert.doesNotMatch(html, /data-home-quick-logs/); return '' }
  assert.equal((html.match(/data-home-quick-logs/g) || []).length, 1)
  const row = html.slice(html.indexOf('data-home-quick-logs'), html.indexOf('data-film-set'))
  assert.match(row, />Dagsform<\/button>/)
  assert.match(row, />Vægt i dag<\/button>/)
  assert.doesNotMatch(row, /<form/)
  return row
}

test('real React actual AthleteView enables both shortcuts for athlete and own coach training', () => {
  for (const role of ['athlete', 'coach']) assert.doesNotMatch(shortcuts(role, ownAthlete), /disabled=""/)
})

test('real React actual AthleteView omits writing shortcuts in coach and athlete previews', () => {
  for (const role of ['coach', 'athlete']) assert.equal(shortcuts(role, otherAthlete, true), '')
})
