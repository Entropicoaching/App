import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import CoachMeetPrognose, { CoachPrognoseContent } from './CoachMeetPrognose.mjs'

const rows = Array.from({ length: 10 }, (_, i) => ({ exercise_id: `synthetic-${i}`,
  logged_at: new Date(Date.UTC(2026, 8, 2 + i * 7)).toISOString().slice(0, 10), weight: 100 + i, reps_completed: 3,
  exercises: { name: 'Squat', sessions: { weeks: { block_name: 'Styrke' } } } }))
const content = extra => renderToStaticMarkup(h(CoachPrognoseContent, {
  snapshot: { now: '2026-11-04', status: 'ready', rows }, meetDate: '2026-11-18',
  onMeetDateChange() { assert.fail('render changed date') }, onRetry() { assert.fail('render retried') }, ...extra,
}))

test('real React: strict OFF never touches athlete, clock, history or client', () => {
  for (const enabled of [undefined, false, null, 0, 1, 'true']) {
    const props = { enabled }
    for (const key of ['client', 'athleteId', 'meetDate', 'now', 'meetType'])
      Object.defineProperty(props, key, { get() { throw Error(`OFF read ${key}`) } })
    assert.equal(CoachMeetPrognose(props), null)
  }
})

test('real React: coach disclosure starts closed and performs no reads', () => {
  const html = renderToStaticMarkup(h(CoachMeetPrognose, { enabled: true,
    client: new Proxy({}, { get() { assert.fail('closed panel read client') } }), athleteId: 'synthetic-a' }))
  assert.match(html, /<details[^>]*><summary[^>]*>Prognose til stævnedagen<\/summary><\/details>/)
  assert.doesNotMatch(html, /open=|Skøn:|Stævnedato/)
})

test('real React: forecast shows interval and folds supporting evidence', () => {
  const html = content()
  assert.match(html, /Skøn: 122 kg\. Usikkerhedsinterval: 113–131 kg/)
  assert.match(html, /Stævnedato<input[^>]*type="date"/)
  assert.match(html, /Datoen vælges kun til denne prognose/)
  assert.match(html, /ændrer ikke forsøgsvalg eller gemmer noget/)
  assert.match(html, /<details><summary[^>]*>Datagrundlag/)
  assert.doesNotMatch(html, /<details open|Prøv igen|tilkobling/)
})

test('real React: empty, loading, error, missing date and bench-only output', () => {
  const empty = content({ snapshot: { now: '2026-11-04', status: 'ready', rows: [] } })
  assert.equal((empty.match(/For lidt data/g) ?? []).length, 4)
  assert.doesNotMatch(empty, /Skøn:|Usikkerhedsinterval:/)
  assert.match(content({ snapshot: { status: 'loading' } }), /Henter løftehistorik/)
  const failed = content({ snapshot: { status: 'error', rows } })
  assert.match(failed, /role="alert"/)
  assert.match(failed, /kunne ikke hentes/)
  assert.match(failed, /<button[^>]*>Prøv igen/)
  assert.doesNotMatch(failed, /Skøn:/)
  assert.match(content({ meetDate: '' }), /Vælg en gyldig stævnedato/)
  const bench = content({ meetType: 'bench' })
  assert.match(bench, /Bænkpres/)
  assert.doesNotMatch(bench, /aria-label="Squat"|aria-label="Dødløft"|aria-label="Sumo dødløft"|Skøn:/)
})
