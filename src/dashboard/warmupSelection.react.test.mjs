import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, hooks, elements } from './warmupSelection.react.fixture.mjs'
import { WARMUP_TEMPLATES } from '../entropi2/session/opvarmning/warmupTemplates.mjs'
test.after(() => hooks.deregister())
const choices = WARMUP_TEMPLATES.filter(t => t.exercise_category !== 'Overkrop')
const useButton = (f, template, standard = false) => elements(f.host).filter(n =>
  n.getAttribute('aria-label') === `Brug ${template.title} som kladde`)[standard ? 1 : 0]
const disabled = node => node.getAttribute('disabled') !== null

for (const template of choices) for (const standard of [false, true]) {
  test(`real React: ${template.title}, ${standard ? 'standard null' : 'athlete'}, preview/select/cancel/save`, async () => {
    const before = JSON.stringify(WARMUP_TEMPLATES), f = await mount()
    try {
      assert.equal(f.state.editingWarmup, null)
      assert.deepEqual(f.state.warmupDraftSteps, [])
      assert.deepEqual(f.calls, [])
      const button = useButton(f, template, standard)
      const preview = button.parentNode
      assert.match(preview.textContent, new RegExp(`Dagtype: ${template.day_type}`))
      assert.ok(preview.textContent.includes(template.rationale))
      for (const step of template.steps) assert.ok(preview.textContent.includes(step))
      assert.doesNotMatch(f.host.textContent, /Overkrop/)
      // Native disclosure state changes only the synthetic host; no product handler saves.
      preview.open = true
      await f.event(preview, 'toggle')
      assert.deepEqual(f.calls, [])
      assert.equal(f.state.editingWarmup, null)
      await f.press(button)
      const context = { category: template.exercise_category, athleteId: standard ? null : 'synthetic-a' }
      assert.deepEqual(f.state.editingWarmup, context)
      assert.deepEqual(f.state.warmupDraftSteps, template.steps)
      assert.notEqual(f.state.warmupDraftSteps, template.steps)
      assert.deepEqual(f.calls, [])
      await f.text('  Syntetisk personlig tekst  ')
      await f.press(f.buttons('+ Tilføj')[0])
      const edited = [...template.steps, 'Syntetisk personlig tekst']
      assert.deepEqual(f.state.warmupDraftSteps, edited)
      await f.change({ warmupTemplates: [...f.p.warmupTemplates] })
      assert.deepEqual(f.state.warmupDraftSteps, edited)
      for (const other of f.buttons('Brug som kladde')) assert.equal(disabled(other), true)
      for (const other of [...f.buttons('Opret'), ...f.buttons('Rediger'), ...f.buttons('Tilpas til atlet')])
        assert.equal(disabled(other), true)
      await f.press(f.buttons('Annuller')[0])
      assert.equal(f.state.editingWarmup, null)
      assert.equal(f.state.warmupNewStep, '')
      assert.deepEqual(f.calls, [])
      await f.press(useButton(f, template, standard))
      assert.deepEqual(f.state.warmupDraftSteps, template.steps)
      await f.text('Syntetisk gemt rettelse')
      await f.press(f.buttons('+ Tilføj')[0])
      const savedSteps = [...template.steps, 'Syntetisk gemt rettelse']
      await f.change({ saving: true })
      assert.equal(disabled(f.buttons('Gem')[0]), true)
      await f.event(f.buttons('Gem')[0], 'click')
      assert.deepEqual(f.calls, [])
      await f.change({ saving: false })
      await f.press(f.buttons('Gem')[0])
      assert.deepEqual(f.calls, [[context.category, savedSteps, context.athleteId]])
      assert.equal(JSON.stringify(WARMUP_TEMPLATES), before)
    } finally { await f.close() }
  })
}

test('real React: switching athletes never retargets or replaces an edited draft', async () => {
  const f = await mount(), template = choices[0]
  try {
    await f.press(useButton(f, template))
    await f.text('Bevar denne tekst')
    await f.press(f.buttons('+ Tilføj')[0])
    const edited = [...f.state.warmupDraftSteps]
    await f.change({ a: { id: 'synthetic-b', name: 'Syntetisk B' } })
    assert.equal(f.buttons('Gem').length, 0)
    assert.equal(f.state.editingWarmup.athleteId, 'synthetic-a')
    assert.deepEqual(f.state.warmupDraftSteps, edited)
    for (const button of f.buttons('Brug som kladde')) {
      assert.equal(disabled(button), true)
      await f.event(button, 'click')
    }
    assert.deepEqual(f.state.warmupDraftSteps, edited)
    assert.equal(f.state.editingWarmup.athleteId, 'synthetic-a')
    await f.change({ a: { id: 'synthetic-a', name: 'Syntetisk A' } })
    await f.press(f.buttons('Gem')[0])
    assert.deepEqual(f.calls, [['Squat', edited, 'synthetic-a']])
    await f.press(f.buttons('Annuller')[0])
    await f.change({ a: { id: 'synthetic-b', name: 'Syntetisk B' } })
    await f.press(useButton(f, choices[5]))
    assert.deepEqual(f.state.editingWarmup, { category: 'Bænkpres', athleteId: 'synthetic-b' })
    await f.press(f.buttons('Gem')[0])
    assert.deepEqual(f.calls[1], ['Bænkpres', choices[5].steps, 'synthetic-b'])
  } finally { await f.close() }
})

test('real React: standard draft stays null across athlete changes; no athlete renders one standard editor', async () => {
  const f = await mount(), template = choices[8]
  try {
    await f.press(useButton(f, template, true))
    for (const a of [{ id: 'synthetic-b', name: 'B' }, null, undefined, {}, { id: null, name: 'Default' }]) {
      await f.change({ a })
      assert.equal(f.buttons('Gem').length, 1)
      assert.deepEqual(f.state.editingWarmup, { category: 'Dødløft', athleteId: null })
      assert.deepEqual(f.calls, [])
    }
    await f.press(f.buttons('Gem')[0])
    assert.deepEqual(f.calls, [['Dødløft', template.steps, null]])
    await f.press(f.buttons('Annuller')[0])
    assert.equal(f.buttons('Brug som kladde').length, 9)
    await f.press(useButton(f, choices[0]))
    assert.deepEqual(f.state.editingWarmup, { category: 'Squat', athleteId: null })
  } finally { await f.close() }
})

test('real React: saving blocks catalogue before any draft, and existing custom draft is never overwritten', async () => {
  const own = { id: 'synthetic-own', athlete_id: 'synthetic-a', exercise_category: 'Squat', steps: ['Bevar specialtekst'] }
  const f = await mount({ saving: true, warmupTemplates: [own] })
  try {
    for (const button of f.buttons('Brug som kladde')) {
      assert.equal(disabled(button), true)
      await f.event(button, 'click')
    }
    assert.equal(f.state.editingWarmup, null)
    assert.deepEqual(f.calls, [])
    await f.change({ saving: false })
    await f.press(f.buttons('Rediger')[0])
    await f.text('Ikke tilføjet endnu')
    for (const button of f.buttons('Brug som kladde')) await f.event(button, 'click')
    for (const button of [...f.buttons('Opret'), ...f.buttons('Rediger')]) await f.event(button, 'click')
    assert.deepEqual(f.state.warmupDraftSteps, own.steps)
    assert.equal(f.state.warmupNewStep, 'Ikke tilføjet endnu')
    assert.deepEqual(f.calls, [])
    await f.press(f.buttons('Annuller')[0])
    assert.deepEqual(own.steps, ['Bevar specialtekst'])
    assert.deepEqual(f.calls, [])
  } finally { await f.close() }
})
