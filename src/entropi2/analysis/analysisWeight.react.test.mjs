import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import Analysis from './Analysis.mjs'

const id = 'synthetic-analysis-weight', now = new Date('2026-11-05T12:00:00Z')
const props = extra => ({ entropi2: true, now, athlete: { id }, fremgangLogs: [], historicalMealLogs: [],
  weightStatus: { athleteId: id, state: 'ready' },
  weightLogs: [{ athlete_id: id, logged_at: '2026-11-03', weight: 81.25 },
    { athlete_id: id, logged_at: '2026-11-04', weight: 82.75 }], ...extra })
const html = p => renderToStaticMarkup(h(Analysis, p))

test('real React: failed weight read has an exposed alert/retry and no retained metrics', () => {
  const rendered = html(props({ weightStatus: { athleteId: id, state: 'error' }, retryWeight() {} }))
  assert.match(rendered, /role="alert"[^>]*>Din vægt kunne ikke hentes/)
  assert.match(rendered, /<button[^>]*>Hent igen<\/button>/)
  assert.ok(rendered.indexOf('data-analysis-weight-status') < rendered.indexOf('data-analysis-help'))
  assert.doesNotMatch(rendered, /81,3|82,8|dage med registreret kropsvægt|seneste vejning|Dine registreringer kunne ikke hentes/)
})

test('real React: loading hides old values; success restores dated data; successful empty stays quiet', () => {
  const loading = html(props({ weightStatus: { athleteId: id, state: 'loading' }, retryWeight() {} }))
  assert.match(loading, /aria-busy="true"/)
  assert.match(loading, /role="status"[^>]*>Henter vægtdata/)
  assert.doesNotMatch(loading, /81,3|82,8|Hent igen/)
  const ready = html(props())
  assert.match(ready, /Vægtdata: seneste vejning 04.11.2026/)
  assert.match(ready, /81,3 kg den 03.11.2026 til 82,8 kg den 04.11.2026/)
  assert.match(ready, /2 dage med registreret kropsvægt/)
  assert.doesNotMatch(html(props({ weightLogs: [] })), /seneste vejning|Hent igen|kunne ikke hentes|0 kg/)
})

test('real React: strict OFF and a foreign read receipt cannot expose another athlete snapshot', () => {
  assert.equal(Analysis({ entropi2: false, get weightStatus() { throw Error('OFF data') } }), null)
  assert.equal(html({ entropi2: false }), '')
  const foreign = html(props({ weightStatus: { athleteId: 'synthetic-other', state: 'ready' } }))
  assert.doesNotMatch(foreign, /Vægtdata er ikke klar endnu|Hent igen|kunne ikke hentes/)
  assert.doesNotMatch(foreign, /81,3|82,8|dage med registreret kropsvægt/)
  assert.doesNotMatch(html(props({ weightStatus: null })), /Vægtdata er ikke klar|Hent igen|81,3|82,8/)
})
