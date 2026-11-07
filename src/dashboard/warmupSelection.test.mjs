import test from 'node:test'
import assert from 'node:assert/strict'
import { WARMUP_TEMPLATES } from '../entropi2/session/opvarmning/warmupTemplates.mjs'
import { warmupCatalogueFor, warmupCatalogueDraft } from './warmupSelection.mjs'

test('selection helper: exact category/id, explicit day, exact context and detached steps', () => {
  const before = JSON.stringify(WARMUP_TEMPLATES)
  for (const category of ['Squat', 'Bænkpres', 'Dødløft']) {
    const choices = warmupCatalogueFor(category)
    assert.deepEqual(choices.map(t => t.day_type), ['tung', 'let', 'teknik'])
    for (const template of choices) for (const athleteId of [null, 'synthetic-a', 'synthetic-b', 0]) {
      const draft = warmupCatalogueDraft(template.id, category, athleteId)
      assert.deepEqual(draft, { category, athleteId, steps: template.steps })
      assert.deepEqual(Object.keys(draft), ['category', 'athleteId', 'steps'])
      assert.notEqual(draft.steps, template.steps)
      draft.steps.push('Syntetisk coachtekst')
      assert.equal(JSON.stringify(WARMUP_TEMPLATES), before)
    }
    choices.pop()
    assert.equal(warmupCatalogueFor(category).length, 3)
  }
})

test('selection helper: no unknown category, Overkrop mapping, guessed template or default athlete', () => {
  for (const category of [undefined, null, '', 'Overkrop', 'squat', 'Baenkpres', 'Doedloeft']) {
    assert.deepEqual(warmupCatalogueFor(category), [])
    assert.equal(warmupCatalogueDraft('e2-warmup-squat-heavy', category, null), null)
  }
  for (const id of [undefined, null, '', 'unknown', 'e2-warmup-upper-heavy', 'e2-warmup-bench-heavy'])
    assert.equal(warmupCatalogueDraft(id, 'Squat', null), null)
  assert.equal(warmupCatalogueDraft('e2-warmup-squat-heavy', 'Squat', undefined), null)
})
