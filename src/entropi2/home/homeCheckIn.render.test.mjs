import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import AthleteHome from './AthleteHome.mjs'
import HomeCheckIn from './HomeCheckIn.mjs'
import WeeklyCheckIn from '../checkin/WeeklyCheckIn.mjs'
import { draftKey, emptyDraft, saveDraft } from '../checkin/weeklyDraft.mjs'
import { memoryStorage } from '../checkin/syntheticReact.mjs'
const props = { enabled: true, athleteId: 'synthetic-a', now: new Date('2026-11-04T12:00:00Z') }
const render = (Component, extra = {}) => renderToStaticMarkup(h(Component, { ...props, storage: memoryStorage(), ...extra }))

test('actual React keeps the missing-draft reminder as the only visible check-in title', () => {
  const html = render(HomeCheckIn, { now: new Date('2026-11-05T12:00:00Z') })
  assert.match(html, /<summary[^>]*data-home-reminder=""[^>]*>Lyst til ugens check-in\? Åbn check-in<\/summary>/)
  assert.equal((html.match(/<summary\b/g) || []).length, 1)
  assert.doesNotMatch(html, /<h[1-6][^>]*>Ugentligt check-in<\/h[1-6]>/)
  assert.doesNotMatch(html, /<h[1-6][^>]*>Lyst til ugens check-in\? Åbn check-in<\/h[1-6]>/)
  assert.match(html, /<section[^>]*aria-label="Ugentligt check-in"/)
  assert.equal((html.match(/<form\b/g) || []).length, 1)
  assert.match(html, /Alle felter er valgfrie/)
})

test('actual React names the local saved/unknown status in its single folded summary', () => {
  const storage = memoryStorage()
  saveDraft(draftKey(props.athleteId, '2026-11-02'), { ...emptyDraft(), comment: 'Syntetisk kladde' }, storage)
  for (const [extra, title] of [
    [{ storage }, 'Ugentligt check-in · Lokal kladde gemt'],
    [{ storage: null }, 'Ugentligt check-in · Lokal status ukendt'],
    [{ now: new Date('2026-11-04T23:00:00Z') }, 'Ugentligt check-in'],
  ]) {
    const html = render(HomeCheckIn, extra)
    assert.match(html, new RegExp(`<summary[^>]*>${title}</summary>`))
    assert.equal((html.match(/<summary\b/g) || []).length, 1)
    assert.doesNotMatch(html, /data-home-reminder/)
    assert.doesNotMatch(html, /<h[1-6][^>]*>Ugentligt check-in<\/h[1-6]>/)
    assert.match(html, /<section[^>]*aria-label="Ugentligt check-in"/)
  }
})

test('actual React keeps the standalone check-in heading intact', () => {
  assert.match(render(WeeklyCheckIn, { weekStart: '2026-11-02' }), /<h2[^>]*>Ugentligt check-in<\/h2>/)
})

test('actual React renders one short reminder after the top session/week/film area', () => {
  const html = render(AthleteHome, { athlete: { id: props.athleteId },
    messages: [{ sender_role: 'coach', content: 'Syntetisk coachbesked' }] })
  assert.equal((html.match(/data-home-reminder/g) || []).length, 1)
  assert.ok(html.indexOf('Dit næste pas') < html.indexOf('data-film-set'))
  assert.ok(html.indexOf('data-film-set') < html.indexOf('data-home-checkin'))
  assert.ok(html.indexOf('data-home-checkin') < html.indexOf('Fra din coach'))
  assert.match(html, /<details[^>]*data-home-checkin=""[^>]*><summary/)
  assert.doesNotMatch(html, /<details[^>]*\bopen=/)
  assert.match(html, /Åbn check-in/)
  assert.match(html, /Ingen kladde gemt endnu/)
  assert.match(html, /De deles ikke med din coach/)
})

test('saved, corrupt and unavailable storage never become missing-draft claims', () => {
  const storage = memoryStorage()
  saveDraft(draftKey(props.athleteId, '2026-11-02'), { ...emptyDraft(), comment: 'Syntetisk kladde' }, storage)
  const saved = render(HomeCheckIn, { storage })
  assert.doesNotMatch(saved, /data-home-reminder/)
  assert.match(saved, /Syntetisk kladde/)
  for (const storage of [null, { getItem() { throw Error('synthetic denied') } }, { getItem() { return '{' } }]) {
    const html = render(HomeCheckIn, { storage })
    assert.doesNotMatch(html, /data-home-reminder/)
    assert.match(html, /<summary[^>]*>Ugentligt check-in · Lokal status ukendt<\/summary>/)
    assert.match(html, /Kladden kunne ikke læses eller gemmes/)
  }
})

test('holiday and OFF do not access draft storage; empty identity stays empty', () => {
  const storage = { getItem() { assert.fail('inert storage') } }
  for (const extra of [{ enabled: false }, { onHoliday: true }, { athleteId: '' }])
    assert.equal(render(HomeCheckIn, { storage, ...extra }), '')
  assert.doesNotMatch(render(AthleteHome, { athlete: { id: props.athleteId }, onHoliday: true }), /data-home-checkin|data-home-reminder/)
  assert.doesNotMatch(render(HomeCheckIn, { now: new Date('2026-11-04T23:00:00Z') }), /data-home-reminder/)
})
