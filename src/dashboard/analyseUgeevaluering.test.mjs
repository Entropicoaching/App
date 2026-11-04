import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import View, { AnalyseWeekContent } from './AnalyseUgeevaluering.mjs'

const athleteId = 'synthetic-athlete', asOf = '2026-11-04'
const source = rows => ({ athleteId, state: 'ready', complete: true, rows })
const batch = () => ({ coachId: 'synthetic-coach', athleteId, asOf,
  sources: Object.fromEntries(['training', 'nutrition', 'weight', 'readiness'].map(key => [key, source([])])) })
const render = extra => renderToStaticMarkup(h(AnalyseWeekContent, { enabled: true, athleteId, asOf, ...extra }))

test('real React: OFF, loading, empty and failure stay distinct', () => {
  assert.equal(renderToStaticMarkup(h(View, { enabled: false })), '')
  assert.match(render(), /Henter ugens datagrundlag/)
  const empty = render({ batch: batch() })
  assert.match(empty, /Ingen registreringer i perioden/)
  assert.match(empty, /Datagrundlag pr. uge/)
  const bad = batch(); bad.sources.weight = { athleteId, state: 'error', complete: false }
  const failure = render({ batch: bad, retry() {} })
  assert.match(failure, /role="alert"/); assert.match(failure, /Prøv ugeevalueringen igen/)
  assert.doesNotMatch(failure, /Ingen registreringer i perioden/)
})
test('real React: actual weekly flags, coverage and neutral explanation appear with folded details', () => {
  const data = batch()
  data.sources.readiness = source([1, 2, 3, 4].map(n => ({ athlete_id: athleteId, logged_date: `2026-11-0${n}`, sleep_hours: 5 })))
  data.sources.weight = source(['2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25', '2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04'].map((day, i) => ({ athlete_id: athleteId, logged_at: day, weight: i < 4 ? 80 : 82 })))
  const html = render({ batch: data })
  assert.match(html, /Til gennemgang: Søvn/); assert.match(html, /Til gennemgang: Vægt/)
  assert.match(html, /Om vægtflaget/); assert.match(html, /kropssammensætning/)
  assert.match(html, /Datagrundlag pr. uge/); assert.match(html, /4\/7 dage/)
  assert.match(html, /<details>/); assert.doesNotMatch(html, /<details open|cyklus|menstru/i)
  // The trend explanation uses different thresholds. Only conversation/caveat
  // are shared; the actual weekly rule and observations remain authoritative.
  assert.doesNotMatch(html, /Tre på hinanden følgende 7-dagesperioder/)
  assert.equal((html.match(/<h2>Ugeevaluering<\/h2>/g) || []).length, 1)
})
