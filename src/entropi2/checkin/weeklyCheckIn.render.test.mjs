import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import WeeklyCheckIn from './WeeklyCheckIn.mjs'
import { draftKey, emptyDraft, saveDraft } from './weeklyDraft.mjs'
import { memoryStorage } from './syntheticReact.mjs'

const props = { enabled: true, athleteId: 'synthetic-real-react', weekStart: '2026-11-02' }
const previousKey = draftKey(props.athleteId, '2026-10-26')
const render = extra => renderToStaticMarkup(h(WeeklyCheckIn, { ...props, ...extra }))

// Required genuine React gate, discovered by the app's own npm test. A missing
// dependency must fail visibly; the synthetic handler tests do not replace it.
test('real React renders accessible, escaped and explicitly unsaved historical suggestions', () => {
  const storage = memoryStorage()
  saveDraft(previousKey, { ...emptyDraft(), sleep: '0', pain: '0', comment: '<b>Syntetisk</b>' }, storage)
  storage.calls.length = 0
  const html = render({ storage })
  assert.equal((html.match(/Forslag fra sidste uges lokale kladde · ikke gemt/g) ?? []).length, 3)
  assert.equal((html.match(/aria-label="Samme som sidst:/g) ?? []).length, 3)
  assert.match(html, /Bekræft forslag og gem kladde/)
  assert.match(html, /når du trykker Bekræft forslag og gem kladde\./)
  assert.match(html, /Forslag vises kun, hvis sidste uges kladde findes på denne enhed\./)
  assert.match(html, /&lt;b&gt;Syntetisk&lt;\/b&gt;/)
  assert.doesNotMatch(html, /<b>Syntetisk<\/b>|gemmes automatisk/)
  assert.match(html, /De deles ikke med din coach/)
  assert.ok(storage.calls.every(([operation]) => operation === 'get'))
})

test('real React keeps existing current blanks, missing history and OFF honest', () => {
  const storage = memoryStorage()
  saveDraft(previousKey, { ...emptyDraft(), sleep: '8' }, storage)
  saveDraft(draftKey(props.athleteId, props.weekStart), emptyDraft(), storage)
  assert.doesNotMatch(render({ storage }), /Forslag fra sidste uges/)
  const empty = render({ storage: memoryStorage() })
  assert.doesNotMatch(empty, /Samme som sidst|Forslag fra sidste/)
  assert.match(empty, /når du trykker Gem kladde\./)
  assert.match(empty, /Forslag vises kun, hvis sidste uges kladde findes på denne enhed\./)
  assert.equal(render({ enabled: false, storage: { getItem() { assert.fail('OFF storage') } } }), '')
})
