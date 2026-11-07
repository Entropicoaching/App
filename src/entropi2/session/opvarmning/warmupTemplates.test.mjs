import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { WARMUP_TEMPLATES } from './warmupTemplates.mjs'
import { focusPlan } from '../../../athlete/mobilityFocus.mjs'

const categories = ['Squat', 'Bænkpres', 'Dødløft', 'Overkrop']
const days = ['tung', 'let', 'teknik']

test('exactly one template for each requested lift and day combination', () => {
  assert.equal(WARMUP_TEMPLATES.length, 12)
  for (const category of categories) for (const day of days) {
    const matches = WARMUP_TEMPLATES.filter(t => t.exercise_category === category && t.day_type === day)
    assert.equal(matches.length, 1, `${category}: ${day}`)
  }
  assert.equal(new Set(WARMUP_TEMPLATES.map(t => t.id)).size, 12)
  assert.equal(new Set(WARMUP_TEMPLATES.map(t => t.rationale)).size, 12)
  assert.equal(new Set(WARMUP_TEMPLATES.map(t => JSON.stringify(t.steps))).size, 12)
})

test('existing text-step contract plus explicit catalogue metadata, no stored identity', () => {
  for (const template of WARMUP_TEMPLATES) {
    assert.deepEqual(Object.keys(template).sort(),
      ['athlete_id', 'day_type', 'exercise_category', 'id', 'rationale', 'steps', 'title'])
    assert.equal(template.athlete_id, null)
    assert.match(template.id, /^e2-warmup-[a-z]+-(heavy|light|technique)$/)
    assert.ok(categories.includes(template.exercise_category))
    assert.ok(days.includes(template.day_type))
    assert.ok(template.title.startsWith(`${template.exercise_category} · `))
    for (const value of [template.title, template.rationale, ...template.steps]) {
      assert.equal(typeof value, 'string')
      assert.equal(value, value.trim())
      assert.ok(value.length > 0)
      assert.doesNotMatch(value, /[<>\u0000-\u001f\ufffd]/u)
    }
    assert.ok(Array.isArray(template.steps) && template.steps.length > 0)
    assert.equal(new Set(template.steps).size, template.steps.length)
  }
})

test('no unsourced numeric dose, load, duration or percentage in catalogue instructions', () => {
  for (const template of WARMUP_TEMPLATES) {
    for (const text of [template.title, template.rationale, ...template.steps])
      assert.doesNotMatch(text, /[\p{N}%]|\b(?:kg|sekunder|minutter|reps|procent)\b/iu)
  }
})

test('catalogue and nested steps are immutable; adapter can edit a detached copy', () => {
  assert.ok(Object.isFrozen(WARMUP_TEMPLATES))
  assert.throws(() => WARMUP_TEMPLATES.push({}), TypeError)
  for (const template of WARMUP_TEMPLATES) {
    assert.ok(Object.isFrozen(template))
    assert.ok(Object.isFrozen(template.steps))
    const before = JSON.stringify(template)
    assert.throws(() => { template.athlete_id = 'synthetic-only' }, TypeError)
    assert.throws(() => template.steps.push('synthetic-only'), TypeError)
    const draft = { exercise_category: template.exercise_category, steps: [...template.steps] }
    draft.steps.push('Syntetisk coachrettelse')
    assert.equal(JSON.stringify(template), before)
    assert.equal(draft.steps.length, template.steps.length + 1)
  }
})

const focusNeeds = { Squat: 'Mere dybde', Bænkpres: 'Skulderposition', Dødløft: 'Hofteposition' }
for (const category of Object.keys(focusNeeds)) for (const day of days) {
  test(`actual existing focusPlan consumes selected ${category}/${day} as text steps`, () => {
    const template = WARMUP_TEMPLATES.find(t => t.exercise_category === category && t.day_type === day)
    const before = JSON.stringify(template)
    // Empty synthetic library keeps all template instructions as coach notes.
    // A different category must not leak into the selected lift's notes.
    const unrelated = Object.freeze({ exercise_category: 'synthetic-other',
      steps: Object.freeze(['Må ikke vises']) })
    const plan = focusPlan(category, focusNeeds[category], {}, [unrelated, template])
    assert.deepEqual(plan, { exercises: [], notes: [...template.steps] })
    assert.equal(JSON.stringify(template), before)
  })
}

test('Overkrop is not silently mapped into an unsupported legacy focus category', () => {
  const templates = WARMUP_TEMPLATES.filter(t => t.exercise_category === 'Overkrop')
  assert.deepEqual(focusPlan('Overkrop', 'Skulderposition', {}, templates), { exercises: [], notes: [] })
  assert.deepEqual(focusPlan('Bænkpres', 'Skulderposition', {}, templates), { exercises: [], notes: [] })
})

test('new data and test files are strict UTF-8 without BOM, CRLF or replacement characters', () => {
  for (const name of ['warmupTemplates.mjs', 'warmupTemplates.test.mjs']) {
    const bytes = readFileSync(new URL(name, import.meta.url))
    assert.notDeepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf])
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    assert.doesNotMatch(text, /\r|\ufffd/u)
    assert.ok(text.endsWith('\n'))
  }
})
