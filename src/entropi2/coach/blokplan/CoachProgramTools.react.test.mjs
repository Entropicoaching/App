// Real React server rendering, discovered by the app's npm test runner.
// No test loader, browser, network or substituted React implementation.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createElement as h } from 'react'
import { renderToStaticMarkup as render } from 'react-dom/server'
import Tools, { BlockToolContent, CompareToolContent } from './CoachProgramTools.mjs'
import Templates from '../../program/skabeloner/ProgramTemplatesView.mjs'
import { templateFromWeek } from '../../program/skabeloner/portalTemplates.mjs'
import { fixture, today } from '../planlaegning/syntheticFixture.mjs'
import { fixture as comparison, today as compareToday } from '../sammenlign/syntheticFixture.mjs'

test('real React: three initially folded tools and no eager IO', () => {
  const props = { enabled: true, athleteId: 'synthetic-athlete', weeks: [], client: { from() { throw Error('Eager read') } } }
  const html = render(h(Tools, props))
  assert.equal((html.match(/<details/g) || []).length, 3)
  assert.doesNotMatch(html, /<details[^>]*\bopen/)
  for (const label of ['Forslag til næste blok', 'Sammenlign to uger', 'Programskabeloner']) assert.ok(html.includes(label))
})

test('real React: OFF does not read identities, data, client or storage', () => {
  const props = { enabled: false }
  for (const key of ['athleteId', 'weeks', 'client']) Object.defineProperty(props, key, { get() { throw Error('OFF access') } })
  assert.equal(Tools(props), null)
  assert.equal(render(h(Tools, { enabled: false })), '')
})

test('real React: block content shown, empty and failed; invalid edits disable save', () => {
  const result = { state: 'ready', snapshot: fixture() }
  const html = render(h(BlockToolContent, { result, today, edits: {}, onChange() {} }))
  assert.match(html, /aria-label="Næste blok"/); assert.match(html, /Gem blokudkast lokalt/)
  assert.equal((html.match(/<fieldset/g) || []).length, 4)
  const invalid = render(h(BlockToolContent, { result, today, edits: { 1: { lifts: { Squat: { sets: '' } } } }, onChange() {} }))
  assert.match(invalid, /role="alert"/); assert.match(invalid, /disabled=""/)
  const empty = render(h(BlockToolContent, { result: { state: 'ready', snapshot: {} }, today }))
  assert.match(empty, /mangler/); assert.doesNotMatch(empty, /<input/)
  assert.match(render(h(BlockToolContent, { result: { state: 'error', message: 'Syntetisk læsefejl' } })), /role="alert"/)
})

test('real React: comparison shown, empty and failed', () => {
  const html = render(h(CompareToolContent, { result: { state: 'ready', snapshot: comparison() }, today: compareToday }))
  assert.match(html, /Sammenlign to uger/); assert.match(html, /<table/)
  assert.match(render(h(CompareToolContent, { result: null })), /Vælg to uger/)
  assert.match(render(h(CompareToolContent, { result: { state: 'error', message: 'Syntetisk læsefejl' } })), /role="alert"/)
})

test('real React: template shown, empty and failed', () => {
  const base = { libraryState: 'ready', weeks: [], sourceId: '', name: '', library: [], draft: null }
  const empty = render(h(Templates, base))
  assert.match(empty, /Ingen gemte skabeloner/); assert.match(empty, /Ingen uger/)
  assert.match(render(h(Templates, { ...base, error: 'Syntetisk lagerfejl' })), /role="alert"/)
  const template = { version: 1, name: 'Syntetisk skabelon', weeks: [{ weekNumber: 1, sessions: [] }] }
  const html = render(h(Templates, { ...base, library: [template], draft: template }))
  assert.match(html, /Brug som udkast/); assert.match(html, /Gem programudkast lokalt/)
})

test('portal source mounts actual tools after the final week list, with shared default and explicit OFF seam', () => {
  const source = readFileSync(new URL('../../../dashboard/ProgramTab.jsx', import.meta.url), 'utf8')
  assert.match(source, /import CoachProgramTools from '\.\.\/entropi2\/coach\/blokplan\/CoachProgramTools.mjs'/)
  assert.match(source, /coachProgramToolsEnabled = Entropi2.DEFAULT_ENTROPI2/)
  assert.ok(source.lastIndexOf('<CoachProgramTools') > source.lastIndexOf('weeks.map('))
  assert.match(source, /<CoachProgramTools enabled=\{coachProgramToolsEnabled\} athleteId=\{selectedAthlete\?\.id\}/)
})

test('real React: unknown block and comparison diagnostics never cross presentation boundary', () => {
  for (const Component of [BlockToolContent, CompareToolContent]) {
    const html = render(h(Component, { result: { state: 'error', message: 'Failed to fetch synthetic-id' } }))
    assert.match(html, /Programgrundlaget kunne ikke hentes. Prøv igen./)
    assert.doesNotMatch(html, /Failed to fetch|synthetic-id/)
  }
})

test('real React: unconfirmed template library has one alert and disabled creation, never false empty claims', () => {
  const html = render(h(Templates, { libraryState: 'error', weeks: [{ id: 'synthetic-week', week_number: 1 }],
    sourceId: 'synthetic-week', name: 'Syntetisk navn', library: [], draft: null, error: 'Skabeloner kunne ikke læses.' }))
  assert.equal((html.match(/role="alert"/g) || []).length, 1)
  assert.doesNotMatch(html, /Ingen gemte skabeloner|Ingen uger at oprette/)
  assert.match(html, /disabled=""/)
})

test('real React: valid template preview uses all Danish weekdays and set notation without mutating prescriptions', () => {
  const week = { athlete_id: 'synthetic-athlete', sessions: Array.from({ length: 7 }, (_, weekday) => ({
    title: 'Syntetisk pas', weekday, exercises: [
      { name: 'Squat', sets: 1, reps: '1', intensity: 'RPE 7,5' },
      { name: 'Bænkpres', sets: 1, reps: '5', intensity: '' },
    ] })) }
  const draft = templateFromWeek(week, 'Syntetisk skabelon', 'synthetic-athlete'), before = structuredClone(draft)
  const html = render(h(Templates, { libraryState: 'ready', weeks: [], name: '', sourceId: '', library: [draft], draft }))
  for (const day of ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag']) assert.ok(html.includes(day))
  assert.match(html, /1 gentagelse · mål-RPE 7,5/)
  assert.match(html, /5 gentagelser/)
  assert.equal((html.match(/mål-RPE/g) || []).length, 7)
  assert.doesNotMatch(html, /ugedag [1-7]|reps|@ RPE|7\.5/)
  assert.deepEqual(draft, before)
})
