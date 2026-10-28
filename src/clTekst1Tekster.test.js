import test from 'node:test'
import assert from 'node:assert/strict'
import { intensityExplanation } from './athlete/intensityExplanation.mjs'
import { mobilityLibrary, MARC_TEXT } from './athlete/mobilityLibrary.mjs'
import { homeworkLibrary, MARC_HOMEWORK_TEXT, DEFAULT_MOBILITY_HOMEWORK } from './mobilityHomework.mjs'
import { nytIAppenText as copy } from './nytIAppenText.mjs'

const placeholder = /tekst fra Marc/i
const dash = /[‒–—―]| - /
const clean = s => { assert.equal(typeof s, 'string'); assert.doesNotMatch(s, placeholder); assert.doesNotMatch(s, dash); assert.ok(s.trim().length > 10) }
const digitsOutsideIntensity = s => s.replace(/^(RPE|RIR) \d+/, '').match(/\d/)

test('intensity explanation: real module, all ten values, full text, same words as before', () => {
  const words = { 6: 'fire', 7: 'tre', 8: 'to', 9: 'en', 10: 'ingen' }
  for (const [v, w] of Object.entries(words)) {
    for (const t of [intensityExplanation(`RPE ${v}`), intensityExplanation(`RIR ${10 - v}`)]) {
      clean(t); assert.equal(digitsOutsideIntensity(t), null)
      assert.match(t.normalize('NFD').replace(/\p{M}/gu, ''), new RegExp(`du kunne have taget ${w} gentagelse`))
      assert.match(t, /Erfaring og teknik påvirker vurderingen/)
    }
  }
  assert.equal(intensityExplanation('RPE 8'), 'RPE 8: du kunne have taget to gentagelser mere. Erfaring og teknik påvirker vurderingen, så sammenlign kun med din egen over tid.')
  for (const x of ['RPE 5', 'RPE 11', 'RIR 5', 'RPE 8.5', '75%', null, 8]) assert.equal(intensityExplanation(x), null)
})

test('mobility library: every pinned exercise carries the filled text, nothing invented', () => {
  clean(MARC_TEXT); assert.equal(MARC_TEXT.match(/\d/), null)
  const library = { Squat: [{ options: ['sq-mob-2','sq-mob-3'].map(id => ({ id, name: id, label: 'l' })) }],
    'Bænkpres': [{ options: [{ id: 'bp-mob-2', name: 'b', label: 'l' }] }],
    'Dødløft — Konventionel': [{ options: [{ id: 'dk-mob-3', name: 'd', label: 'l' }] }],
    'Dødløft — Sumo': [{ options: [{ id: 'ds-mob-1', name: 's', label: 'l' }] }] }
  let n = 0
  for (const lift of ['Squat', 'Bænkpres', 'Dødløft'])
    for (const ex of mobilityLibrary(lift, library).flatMap(g => g.exercises)) { assert.equal(ex.explanation, MARC_TEXT); n++ }
  assert.equal(n, 5)
  assert.deepEqual(mobilityLibrary('Squat', {}), [])
})

test('homework: all five problems carry the filled text, default stays off', () => {
  assert.equal(DEFAULT_MOBILITY_HOMEWORK, false)
  clean(MARC_HOMEWORK_TEXT); assert.equal(MARC_HOMEWORK_TEXT.match(/\d/), null)
  const problems = homeworkLibrary()
  assert.equal(problems.length, 5)
  assert.ok(problems.every(p => p.explanation === MARC_HOMEWORK_TEXT && p.exercises.length > 0 && p.exercises.length <= 4))
})

test('Nyt i appen text: filled, unique labels, ids and roles untouched', () => {
  clean(copy.source); assert.equal(copy.title, 'Nyt i appen'); assert.ok(Object.isFrozen(copy) && Object.isFrozen(copy.items))
  assert.deepEqual(copy.items.map(i => [i.id, i.roles.join('+')]), [['mobilitet','athlete'],['analyse','coach'],['tidsmarkeringer','athlete+coach'],['oprydning','coach'],['fremgang','athlete+coach']])
  for (const i of copy.items) { clean(i.label); assert.equal(i.label.match(/\d/), null) }
  assert.equal(new Set(copy.items.map(i => i.label)).size, 5)
  assert.ok(copy.items.filter(i => i.roles.includes('athlete')).length <= 5)
})

test('voice: user-facing mobility texts are du-form, no third person athlete', () => {
  for (const s of [MARC_TEXT, MARC_HOMEWORK_TEXT]) { assert.match(s, /\b(dit|din|dig|du)\b/i); assert.doesNotMatch(s, /atlet/i) }
})
