import test from 'node:test'
import assert from 'node:assert/strict'

import { PROGRAM_TEMPLATES, TEMPLATE_SCHEMA_VERSION, findTemplate } from '../programTemplates.js'

test('v3 har særskilte review-templates for mål, miljø og to, tre og fire dage', () => {
  assert.equal(TEMPLATE_SCHEMA_VERSION, 3)
  assert.deepEqual([...new Set(PROGRAM_TEMPLATES.map(template => template.days))], [2, 3, 4])
  assert.equal(new Set(PROGRAM_TEMPLATES.map(template => template.id)).size, 12)

  for (const template of PROGRAM_TEMPLATES) {
    assert.equal(template.status, 'review')
    assert.equal(template.week.length, template.days)
    assert.ok(['home', 'gym'].includes(template.equipment))
    assert.equal(template.minEquipment, template.equipment)
    assert.deepEqual(template.levels, ['begynder', 'oevet'])
    assert.equal(template.adaptationPolicy, 'same-exercise-next-exposure-v1')
    for (const session of template.week) {
      assert.ok(session.roles.length >= 3)
      assert.ok(session.roles.every(role => /^[a-z-]+$/.test(role)))
    }
  }
  for (const goal of ['general-strength', 'powerlifting-foundation']) {
    for (const days of [2, 3, 4]) {
      assert.ok(PROGRAM_TEMPLATES.some(template => template.id === `${goal}-${days}` && template.equipment === 'gym'))
      assert.ok(PROGRAM_TEMPLATES.some(template => template.id === `${goal}-${days}-home` && template.equipment === 'home'))
    }
  }
})

test('templates indeholder endnu ingen færdige recepter eller øvelsesvalg', () => {
  for (const template of PROGRAM_TEMPLATES) {
    const serialized = JSON.stringify(template)
    assert.equal(serialized.includes('sets'), false)
    assert.equal(serialized.includes('reps'), false)
    assert.equal(serialized.includes('weight'), false)
    assert.equal(serialized.includes('rpe'), false)
  }
  assert.equal(findTemplate('powerlifting-foundation-3').days, 3)
  assert.equal(findTemplate('powerlifting-foundation-3-home').equipment, 'home')
  assert.equal(findTemplate('ukendt'), null)
})
