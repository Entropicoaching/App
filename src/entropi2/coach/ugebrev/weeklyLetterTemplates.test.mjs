import test from 'node:test'
import assert from 'node:assert/strict'
import { WEEKLY_LETTER_TEMPLATES as templates } from './weeklyLetterTemplates.mjs'
import {
  COACH_TEMPLATE_MESSAGES_ENABLED, readCoachTemplates, saveCoachTemplates,
  fillCoachTemplate, createCoachTemplateSender,
} from '../../../dashboard/coachTemplateMessages.mjs'

const expectedNames = [
  'God uge', 'Misset træning', 'Smerte i træningen', 'Stævneforberedelse',
  'Deload', 'Kostopfølgning', 'Søvn', 'Ny blok', 'Travl hverdag',
  'Tilbage efter pause', 'Tvivl om en øvelse', 'Manglende registreringer',
]

function storage() {
  const values = new Map(), writes = []
  return { values, writes, getItem: key => values.get(key) ?? null,
    setItem(key, value) { values.set(key, value); writes.push(key) } }
}

test('twelve distinct drafts match the existing name/text contract and cover the situations', () => {
  assert.equal(templates.length, 12)
  assert.deepEqual(templates.map(row => row.name), expectedNames)
  assert.equal(new Set(templates.map(row => row.text)).size, 12)
  for (const row of templates) {
    assert.deepEqual(Object.keys(row).sort(), ['name', 'text'])
    assert.equal(typeof row.name, 'string')
    assert.ok(row.name.trim() && row.name.length <= 100)
    assert.equal(typeof row.text, 'string')
    assert.ok(row.text.trim() && row.text.length <= 10000)
    assert.equal(row.name, row.name.trim())
    assert.equal(row.text, row.text.trim())
  }
})

test('drafts have a greeting, a focused paragraph and a question without invented numbers or private topics', () => {
  for (const { text } of templates) {
    const paragraphs = text.split('\n\n')
    assert.equal(paragraphs.length, 3)
    assert.ok(paragraphs.every(paragraph => paragraph.trim()))
    assert.ok(text.startsWith('Hej {atlet}. '))
    assert.deepEqual(text.match(/\{[^}]*\}/g), ['{atlet}'])
    assert.equal((text.match(/\?/g) ?? []).length, 1)
    assert.ok(paragraphs[2].endsWith('?'))
    assert.doesNotMatch(text, /[\d%<>]|cyklus|menstru|hormon|diagnos|kalori|\bkcal\b|\bkg\b|\uFFFD/i)
  }
})

test('actual save/read round trip accepts every draft and writes only the selected coach namespace', () => {
  const store = storage(), coachId = 'synthetic-coach:/one'
  const key = 'entropi_coach_message_templates_v1:synthetic-coach%3A%2Fone'
  const foreignKey = 'entropi_coach_message_templates_v1:synthetic-other'
  store.values.set(foreignKey, '[]')
  store.values.set('synthetic-unrelated', 'unchanged')
  const before = JSON.stringify(templates)
  saveCoachTemplates(store, coachId, templates)
  assert.deepEqual(store.writes, [key])
  assert.deepEqual(readCoachTemplates(store, coachId), templates)
  assert.deepEqual(readCoachTemplates(store, 'synthetic-other'), [])
  assert.equal(store.values.get(foreignKey), '[]')
  assert.equal(store.values.get('synthetic-unrelated'), 'unchanged')
  const read = readCoachTemplates(store, coachId)
  read[0].text = 'Synthetic local edit'
  assert.equal(JSON.stringify(templates), before)
  assert.equal(readCoachTemplates(store, coachId)[0].text, templates[0].text)
})

test('actual filler replaces the athlete token literally without changing source drafts', () => {
  const before = JSON.stringify(templates), athleteName = 'synthetic $& $` $\''
  for (const row of templates) {
    const result = fillCoachTemplate(row.text, athleteName)
    assert.equal(result, row.text.split('{atlet}').join(athleteName))
    assert.ok(result.startsWith(`Hej ${athleteName}. `))
    assert.doesNotMatch(result, /\{atlet\}/)
  }
  assert.equal(JSON.stringify(templates), before)
})

test('shared defaults are immutable and the existing sender remains OFF with no I/O', async () => {
  assert.ok(Object.isFrozen(templates))
  assert.ok(templates.every(Object.isFrozen))
  assert.throws(() => { templates[0].text = 'mutation' }, TypeError)
  assert.throws(() => { templates.push({ name: 'mutation', text: 'mutation' }) }, TypeError)
  assert.equal(COACH_TEMPLATE_MESSAGES_ENABLED, false)
  const deny = () => { assert.fail('OFF accessed a dependency') }
  const send = createCoachTemplateSender({ getScope: deny, database: new Proxy({}, { get: deny }) })
  for (const { text } of templates) {
    await assert.rejects(send({ coachId: 'synthetic-coach', athleteId: 'synthetic-athlete', text }),
      /Funktionen er sl/)
  }
})
