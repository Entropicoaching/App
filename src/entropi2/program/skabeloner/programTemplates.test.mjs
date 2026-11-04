import test from 'node:test'
import assert from 'node:assert/strict'
import { createProgramTemplate, validateProgramTemplate, PROGRAM_TEMPLATE_VERSION } from './programTemplates.mjs'

const fixture = () => ({ version: 1, name: '  Basis  ', description: '  Coachudkast  ', weeks: [
  { weekNumber: 1, sessions: [{ name: '  Pas A  ', dayOfWeek: 1, exercises: [
    { exerciseKey: ' squat ', name: ' Squat ', sets: [{ reps: 5, rpe: 7.5 }, { reps: 8, rpe: null }] },
    { exerciseKey: 'row', name: 'Row', sets: [{ reps: 10, rpe: 8 }] },
  ] }, { name: 'Pas B', dayOfWeek: 7, exercises: [
    { exerciseKey: 'press', name: 'Press', sets: [{ reps: 3, rpe: 9 }] },
  ] }] }, { weekNumber: 2, sessions: [] },
] })
const create = value => createProgramTemplate(value, { enabled: true })
const exercise = value => value.weeks[0].sessions[0].exercises[0]
const freeze = value => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }
  return value
}
const rejected = value => {
  const result = validateProgramTemplate(value)
  assert.equal(result.valid, false)
  assert.ok(result.errors.length > 0)
  assert.ok(result.errors.every(e => e.path.startsWith('$') && e.code && e.message))
  assert.deepEqual(create(value), { state: 'invalid', template: null, errors: result.errors })
  return result.errors
}

test('strict default OFF never inspects template, including truthy non-booleans', () => {
  const poison = new Proxy({}, { get() { throw Error('read') }, getPrototypeOf() { throw Error('inspect') } })
  assert.equal(createProgramTemplate(poison), null)
  for (const enabled of [false, undefined, null, 0, 1, 'true', '1', [], {}])
    assert.equal(createProgramTemplate(poison, { enabled }), null)
})

test('valid multi-week plan preserves ordered mixed prescriptions, rest week and day positions', () => {
  assert.equal(PROGRAM_TEMPLATE_VERSION, 1)
  const result = create(fixture())
  assert.equal(result.state, 'ready')
  assert.deepEqual(result.errors, [])
  assert.equal(result.template.name, 'Basis')
  assert.equal(result.template.description, 'Coachudkast')
  assert.equal(result.template.weeks[0].sessions[0].name, 'Pas A')
  assert.equal(exercise(result.template).exerciseKey, 'squat')
  assert.equal(exercise(result.template).name, 'Squat')
  assert.deepEqual(exercise(result.template).sets, [{ reps: 5, rpe: 7.5 }, { reps: 8, rpe: null }])
  assert.equal(result.template.weeks[0].sessions[1].dayOfWeek, 7)
  assert.deepEqual(result.template.weeks[1], { weekNumber: 2, sessions: [] })
  assert.deepEqual(validateProgramTemplate(result.template), { valid: true, errors: [] })
})

test('reuse returns fully detached editable drafts and accepts deeply frozen source', () => {
  const original = freeze(fixture()), before = JSON.stringify(original)
  const first = create(original).template, second = create(first).template, third = create(first).template
  second.weeks[0].sessions[0].name = 'Ændret'
  exercise(second).sets[0].reps = 99
  exercise(second).sets.push({ reps: 1, rpe: 1 })
  second.weeks.push({ weekNumber: 3, sessions: [] })
  assert.equal(first.weeks[0].sessions[0].name, 'Pas A')
  assert.equal(exercise(first).sets[0].reps, 5)
  assert.deepEqual(first, third)
  assert.equal(JSON.stringify(original), before)
  assert.notEqual(first.weeks, original.weeks)
  assert.notEqual(first.weeks[0], original.weeks[0])
  assert.notEqual(exercise(first), exercise(original))
})

test('top-level type, version and required fields fail closed', () => {
  for (const value of [null, undefined, true, 1, '', [], new Date(), new Map()]) rejected(value)
  for (const version of [undefined, null, '1', 0, 2, NaN]) rejected({ ...fixture(), version })
  for (const field of ['name', 'weeks', 'version']) {
    const value = fixture(); delete value[field]; rejected(value)
  }
})

test('text bounds, no coercion, and optional description', () => {
  for (const value of ['', '   ', null, 3, {}, 'x'.repeat(121)]) {
    const t = fixture(); t.name = value; rejected(t)
    const e = fixture(); exercise(e).exerciseKey = value; rejected(e)
    const n = fixture(); exercise(n).name = value; rejected(n)
    const s = fixture(); s.weeks[0].sessions[0].name = value; rejected(s)
  }
  const t = fixture(); delete t.description
  assert.equal(create(t).template.description, '')
  t.name = 'x'.repeat(120); t.description = 'x'.repeat(2000)
  assert.equal(validateProgramTemplate(t).valid, true)
  for (const description of [null, 7, {}, 'x'.repeat(2001)]) rejected({ ...t, description })
})

test('exact week order and integer day range, with multiple sessions per day allowed', () => {
  for (const number of [0, 2, 1.5, '1', null, NaN]) {
    const t = fixture(); t.weeks[0].weekNumber = number; rejected(t)
  }
  const t = fixture(); t.weeks[1].weekNumber = 1; rejected(t)
  for (const day of [0, 8, 1.5, '1', null, NaN, Infinity]) {
    const t = fixture(); t.weeks[0].sessions[0].dayOfWeek = day; rejected(t)
  }
  const sameDay = fixture(); sameDay.weeks[0].sessions[1].dayOfWeek = 1
  assert.equal(validateProgramTemplate(sameDay).valid, true)
})

test('all nested lists reject missing, malformed, sparse and oversized data', () => {
  const slots = [
    [t => t, 'weeks', 52, false],
    [t => t.weeks[0], 'sessions', 14, true],
    [t => t.weeks[0].sessions[0], 'exercises', 30, false],
    [exercise, 'sets', 20, false],
  ]
  for (const [parent, key, max, allowEmpty] of slots) {
    for (const invalid of [null, {}, 'list', undefined, new Array(1), new Array(max + 1)]) {
      const t = fixture(); parent(t)[key] = invalid; rejected(t)
    }
    const t = fixture(); parent(t)[key] = []
    assert.equal(validateProgramTemplate(t).valid, allowEmpty)
    if (!allowEmpty) rejected(t)
    const missing = fixture(); delete parent(missing)[key]; rejected(missing)
  }
})

test('all collection upper bounds are accepted with well-formed content', () => {
  const weeks = fixture(); weeks.weeks = Array.from({ length: 52 }, (_, i) => ({ weekNumber: i + 1, sessions: [] }))
  assert.equal(create(weeks).state, 'ready')
  const sessions = fixture(); sessions.weeks[0].sessions = Array.from({ length: 14 }, () => structuredClone(fixture().weeks[0].sessions[0]))
  assert.equal(create(sessions).state, 'ready')
  const exercises = fixture(); exercises.weeks[0].sessions[0].exercises = Array.from({ length: 30 }, () => structuredClone(exercise(fixture())))
  assert.equal(create(exercises).state, 'ready')
  const sets = fixture(); exercise(sets).sets = Array.from({ length: 20 }, () => ({ reps: 100, rpe: 10 }))
  assert.equal(create(sets).state, 'ready')
})

test('reps use strict integer counts and target RPE uses explicit null or half steps', () => {
  for (const reps of [0, -1, 101, 2.5, '5', NaN, Infinity, null, true]) {
    const t = fixture(); exercise(t).sets[0].reps = reps
    assert.ok(rejected(t).some(e => e.path === '$.weeks[0].sessions[0].exercises[0].sets[0].reps' && e.code === 'reps'))
  }
  for (const rpe of [0, 0.5, 10.5, 7.25, '7', NaN, Infinity, undefined, true]) {
    const t = fixture(); exercise(t).sets[0].rpe = rpe; rejected(t)
  }
  for (const rpe of [null, ...Array.from({ length: 19 }, (_, i) => 1 + i / 2)]) {
    const t = fixture(); exercise(t).sets[0] = { reps: 1, rpe }
    assert.equal(validateProgramTemplate(t).valid, true)
  }
  const t = fixture(); delete exercise(t).sets[0].rpe; rejected(t)
})

test('unknown data and non-object nested rows fail rather than entering a reusable template', () => {
  for (const parent of [t => t, t => t.weeks[0], t => t.weeks[0].sessions[0], exercise, t => exercise(t).sets[0]]) {
    const t = fixture(); parent(t).unexpected = 'synthetic'
    assert.ok(rejected(t).some(e => e.code === 'unknown_field'))
  }
  for (const replace of [t => { t.weeks[0] = null }, t => { t.weeks[0].sessions[0] = [] },
    t => { t.weeks[0].sessions[0].exercises[0] = 'row' }, t => { exercise(t).sets[0] = 5 }]) {
    const t = fixture(); replace(t); rejected(t)
  }
})
