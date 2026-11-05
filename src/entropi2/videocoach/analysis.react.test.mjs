import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { renderVideoAnalyses } from './analysisView.mjs'
import { AthleteVideoAnalyses } from './VideoCoach.mjs'

// Discovered by the application's npm test. Run by Dhurva with installed React.
test('React SSR: actual analysis component supports honest empty and strict OFF states', () => {
  assert.equal(renderToStaticMarkup(createElement(AthleteVideoAnalyses,
    { controller: { snapshot: () => ({ enabled: false }) } })), '')
  const html = renderToStaticMarkup(createElement(AthleteVideoAnalyses,
    { controller: { snapshot: () => ({ enabled: true, canSend: false, records: [] }) } }))
  assert.match(html, /Ingen videoanalyse/)
  const off = renderVideoAnalyses(createElement, { state: { enabled: false } })
  assert.equal(off, null)
})
