import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, hooks, elements } from './warmupSelection.react.fixture.mjs'
test.after(() => hooks.deregister())
const athlete = { id: 'own', athlete_id: 'synthetic-a', exercise_category: 'Squat', steps: ['Syntetisk egen tekst'] }
const standard = { id: 'standard', athlete_id: null, exercise_category: 'Squat', steps: ['Syntetisk standardtekst'] }

test('real React baseline: existing athlete/standard, custom text, remove, cancel, delete and explicit Gem', async () => {
  const f = await mount({ warmupTemplates: [standard, athlete] })
  try {
    assert.match(f.host.textContent, /Syntetisk egen tekst/)
    assert.equal(f.calls.length, 0)
    await f.press(f.buttons('Rediger')[0])
    assert.deepEqual(f.state.editingWarmup, { category: 'Squat', athleteId: 'synthetic-a' })
    assert.deepEqual(f.state.warmupDraftSteps, athlete.steps)
    assert.notEqual(f.state.warmupDraftSteps, athlete.steps)
    await f.text('  Syntetisk tilføjelse  ')
    const input = elements(f.host).find(n => n.tagName === 'INPUT')
    await f.event(input, 'keydown', { key: 'Enter', keyCode: 13, charCode: 13 })
    assert.deepEqual(f.state.warmupDraftSteps, [...athlete.steps, 'Syntetisk tilføjelse'])
    await f.press(f.buttons('✕')[0])
    assert.deepEqual(f.state.warmupDraftSteps, ['Syntetisk tilføjelse'])
    await f.change({ saving: true })
    assert.equal(f.buttons('Gem')[0].getAttribute('disabled'), '')
    assert.equal(f.calls.length, 0)
    await f.change({ saving: false })
    await f.press(f.buttons('Gem')[0])
    assert.deepEqual(f.calls, [['Squat', ['Syntetisk tilføjelse'], 'synthetic-a']])
    await f.press(f.buttons('Annuller')[0])
    assert.equal(f.state.editingWarmup, null)
    assert.deepEqual(athlete.steps, ['Syntetisk egen tekst'])
    await f.press(f.buttons('Slet')[0])
    assert.deepEqual(f.deletes, ['own'])
  } finally { await f.close() }
})

test('real React baseline: standard fallback adapts to athlete and standard edits save null', async () => {
  const f = await mount({ warmupTemplates: [standard] })
  try {
    assert.match(f.host.textContent, /Bruger standard/)
    await f.press(f.buttons('Tilpas til atlet')[0])
    assert.deepEqual(f.state.warmupDraftSteps, standard.steps)
    assert.notEqual(f.state.warmupDraftSteps, standard.steps)
    await f.press(f.buttons('Annuller')[0])
    assert.equal(f.calls.length, 0)
    await f.press(f.buttons('Rediger')[0])
    assert.deepEqual(f.state.editingWarmup, { category: 'Squat', athleteId: null })
    await f.press(f.buttons('Gem')[0])
    assert.deepEqual(f.calls, [['Squat', standard.steps, null]])
  } finally { await f.close() }
})
