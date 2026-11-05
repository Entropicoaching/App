import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import AthleteHome from './AthleteHome.mjs'
import QuickLogs from './QuickLogs.mjs'

const props = { enabled: true, athlete: { id: 'synthetic-athlete' }, today: '2026-11-04',
  now: new Date('2026-11-04T12:00:00Z'), weightLogs: [], readinessLog: null,
  storage: { getItem: () => null },
  saveReadiness() {}, setReadinessInput() {}, logWeight() {}, setWeightInput() {} }

test('real React: shortcuts occur once beneath the session overview and do not duplicate check-in reminders', () => {
  const html = renderToStaticMarkup(h(AthleteHome, props))
  assert.equal((html.match(/data-home-quick-logs/g) || []).length, 1)
  assert.ok(html.indexOf('data-home-quick-logs') > html.indexOf('Dit næste pas'))
  assert.ok(html.indexOf('data-home-quick-logs') < html.indexOf('data-film-set'))
  assert.match(html, />Dagsform<\/button>/); assert.match(html, />Vægt i dag<\/button>/)
  const quick = html.slice(html.indexOf('data-home-quick-logs'), html.indexOf('data-film-set'))
  assert.doesNotMatch(quick, /<form|check-in|Logget i dag/)
  assert.match(html.slice(html.indexOf('data-film-set')), /data-home-checkin/)
  assert.equal((html.match(/data-home-checkin=/g) || []).length, 1)
  assert.equal((html.match(/data-home-reminder=/g) || []).length, 1)
  const unknownStorage = renderToStaticMarkup(h(AthleteHome, { ...props, storage: null }))
  assert.equal((unknownStorage.match(/data-home-checkin=/g) || []).length, 1)
  assert.doesNotMatch(unknownStorage, /data-home-reminder=/)
})

test('real React: dated status is accessible, missing callbacks are disabled, and OFF is empty', () => {
  const html = renderToStaticMarkup(h(QuickLogs, { ...props,
    readinessLog: { athlete_id: props.athlete.id, logged_date: props.today },
    weightLogs: [{ athlete_id: props.athlete.id, logged_at: props.today, weight: 82.5 }] }))
  assert.equal((html.match(/aria-label="[^"]*Logget i dag"/g) || []).length, 2)
  assert.equal((renderToStaticMarkup(h(QuickLogs, { ...props, saveReadiness: null, logWeight: null })).match(/disabled=""/g) || []).length, 2)
  assert.equal(renderToStaticMarkup(h(QuickLogs, { ...props, enabled: false })), '')
})
