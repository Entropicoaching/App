// Discovered by the app's npm test. Requires real React; no fallback or skip.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { installProgramReactLoader } from '../entropi2/program/blok/programReactLoader.mjs'
import { programQolFixture } from './programQolFixture.mjs'
installProgramReactLoader()
const { default: Program } = await import('./ProgramTab.jsx')
const render = extra => renderToStaticMarkup(createElement(Program, programQolFixture(extra)))
const folds = html => [...html.matchAll(/<details\b([^>]*data-program-session-actions[^>]*)>(.*?)<\/details>/gs)]

test('React: bulk actions occur only inside initially closed native details with readable 44px summaries', () => {
  const html = render({ WEEKDAYS_LONG: ['Lang syntetisk ugedag'] })
  assert.equal(folds(html).length, 2)
  for (const [, attributes, content] of folds(html)) {
    assert.doesNotMatch(attributes, /\bopen(?:[\s=>]|$)/)
    assert.match(content, /<summary[^>]*aria-label="Flere handlinger for passet · Pas 1-[01] · pas [12], uge 1"/)
    const summaryStyle = /<summary[^>]*style="([^"]*)"/.exec(content)[1]
    for (const rule of ['min-height:44px', 'min-width:44px', 'font-size:14px', 'letter-spacing:normal',
      'text-transform:none', 'white-space:normal', 'overflow-wrap:anywhere']) assert.ok(summaryStyle.split(';').includes(rule), rule)
    assert.equal((content.match(/<button\b/g) || []).length, 2)
    assert.match(content, />Spring resten over<\/button>/)
    assert.match(content, />Auto-udfyld<\/button>/)
    assert.doesNotMatch(content, /sæt logget|aria-expanded|<input/)
  }
  const primary = html.replace(/<details\b[^>]*data-program-session-actions[^>]*>.*?<\/details>/gs, '')
  assert.doesNotMatch(primary, /Auto-udfyld|Spring resten over/)
  assert.match(primary, /aria-expanded="false"[^>]*aria-label="Pas 1-0 · pas 1, uge 1"/)
  assert.match(primary, /1 øvelse · 0\/1 sæt logget/)
  assert.match(primary, /Næste pas/)
})

test('React: readiness states, long weekday and progress use at least 14px without uppercase or extra spacing', () => {
  for (const readinessLog of [null, { readiness_score: 30 }, { readiness_score: 60 }]) {
    const html = render({ readinessLog, WEEKDAYS_LONG: ['Lang syntetisk ugedag'] })
    const tags = [...html.matchAll(/<(?:div|span)\b[^>]*style="([^"]*)"[^>]*>([^<]+)<\/(?:div|span)>/g)]
      .filter(m => /^(Parathed |Log dagens parathed|Lang syntetisk ugedag|1 øvelse ·)/.test(m[2]))
    assert.ok(tags.length >= 4)
    for (const [, style] of tags) for (const rule of ['font-size:14px', 'letter-spacing:normal', 'text-transform:none',
      'white-space:normal', 'overflow-wrap:anywhere']) assert.ok(style.split(';').includes(rule), rule)
  }
})

test('React: read-only and upcoming previews omit the fold; strict OFF retains legacy bulk actions', () => {
  for (const extra of [{ readOnly: true }, { viewingWeekIdx: 2, programNaesteUge: true }]) {
    const html = render(extra)
    assert.equal(folds(html).length, 0)
    assert.doesNotMatch(html, /Auto-udfyld|Spring resten over/)
  }
  for (const entropi2 of [false, null, 0, 1, 'true']) {
    const html = render({ entropi2, WEEKDAYS_LONG: ['Mandag'] })
    assert.equal(folds(html).length, 0)
    assert.match(html, />Auto-udfyld<\/button>/)
    assert.match(html, /font-size:0\.52rem;letter-spacing:0\.04em[^>]*>Mandag<\/span>/)
    assert.doesNotMatch(html, /summary:focus-visible/)
  }
})
