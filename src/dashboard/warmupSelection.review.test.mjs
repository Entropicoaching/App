// Independent adversarial scenarios for the candidate's actual component.
// Same-engine Codex local review; this file does not claim a fresh reviewer context.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, hooks, elements } from './warmupSelection.react.fixture.mjs'
import { WARMUP_TEMPLATES } from '../entropi2/session/opvarmning/warmupTemplates.mjs'
test.after(() => hooks.deregister())

const named = (f, label) => elements(f.host).filter(n => n.getAttribute('aria-label') === label)

test('local review: saved rows survive selecting, editing and cancelling a different catalogue draft', async () => {
  const rows = Object.freeze([
    Object.freeze({ id: 'synthetic-default', exercise_category: 'Bænkpres', athlete_id: null, steps: Object.freeze(['Standard beholdes']) }),
    Object.freeze({ id: 'synthetic-specific', exercise_category: 'Bænkpres', athlete_id: 'synthetic-a', steps: Object.freeze(['Atlettekst beholdes']) }),
  ])
  const before = JSON.stringify(rows), catalogueBefore = JSON.stringify(WARMUP_TEMPLATES)
  const f = await mount({ warmupTemplates: rows })
  try {
    await f.press(named(f, 'Brug Dødløft · let dag som kladde')[0])
    await f.press(f.buttons('✕')[0])
    await f.text('Syntetisk rettelse uden at gemme')
    await f.press(f.buttons('+ Tilføj')[0])
    assert.match(f.host.textContent, /Atlettekst beholdes/)
    assert.match(f.host.textContent, /Standard beholdes/)
    await f.press(f.buttons('Annuller')[0])
    assert.deepEqual(f.calls, [])
    assert.deepEqual(f.deletes, [])
    assert.equal(JSON.stringify(rows), before)
    assert.equal(JSON.stringify(WARMUP_TEMPLATES), catalogueBefore)
    await f.press(f.buttons('Slet')[1])
    assert.deepEqual(f.deletes, ['synthetic-default'])
  } finally { await f.close() }
})

test('local review: initial null athlete has only standard choices and one Gem with a null target', async () => {
  const f = await mount({ a: null })
  try {
    assert.equal(f.buttons('Brug som kladde').length, 9)
    assert.equal(f.buttons('Opret').length, 3)
    assert.doesNotMatch(f.host.textContent, /Atlet-specifik/)
    await f.press(named(f, 'Brug Bænkpres · teknikdag som kladde')[0])
    assert.equal(f.buttons('Gem').length, 1)
    assert.deepEqual(f.state.editingWarmup, { category: 'Bænkpres', athleteId: null })
    await f.change({ a: { id: 'synthetic-review', name: null } })
    assert.equal(f.buttons('Gem').length, 1)
    assert.equal(f.calls.length, 0)
    await f.press(f.buttons('Gem')[0])
    const template = WARMUP_TEMPLATES.find(t => t.id === 'e2-warmup-bench-technique')
    assert.deepEqual(f.calls, [['Bænkpres', template.steps, null]])
  } finally { await f.close() }
})

test('local review: numeric zero athlete id stays distinct from standard null', async () => {
  const f = await mount({ a: { id: 0, name: 'Syntetisk nul' } })
  try {
    assert.equal(f.buttons('Brug som kladde').length, 18)
    await f.press(named(f, 'Brug Squat · teknikdag som kladde')[0])
    assert.deepEqual(f.state.editingWarmup, { category: 'Squat', athleteId: 0 })
    assert.equal(f.buttons('Gem').length, 1)
    await f.press(f.buttons('Gem')[0])
    assert.equal(f.calls[0][2], 0)
  } finally { await f.close() }
})
