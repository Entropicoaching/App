import test from 'node:test'
import assert from 'node:assert/strict'
import { createCopyDraft, validateCopyDraft, sendCopyDraft, sessionDate, DEFAULT_COACH_PLAN_COPY } from './coachPlanCopy.mjs'

const owner = 'synthetic-number-owner'
const source = () => ({
  id: 'source-week', athlete_id: owner, week_number: 2, start_date: '2026-10-19',
  block_name: 'Basis', coach_note: 'Rolig', block_description: 'Styrke',
  sessions: [{ id: 'source-session', title: 'Pas', weekday: 0, session_order: 9,
    exercises: [{ id: 'source-exercise', name: 'Squat', sets: 3, reps: '5', intensity: 'RPE 7',
      note: 'Pause', recommended_weight: '102,5', exercise_order: 8, logs: ['synthetic'] }] }],
})
function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze)
    Object.freeze(value)
  }
  return value
}

// Only the database boundary is fake; validation and writes use the actual module.
function database({ failTable, transport = false, cleanupFails = false, cleanupThrows = false } = {}) {
  const calls = []
  return { calls, from(table) {
    calls.push({ from: table })
    return {
      insert(row) {
        calls.push({ table, row: structuredClone(row) })
        const result = async () => {
          if (table === failTable && transport) throw Error('synthetic transport')
          return { data: { id: `${table}-new` }, error: table === failTable ? { message: 'synthetic failure' } : null }
        }
        return { select() { return { single: result } }, then(a, b) { return result().then(a, b) } }
      },
      delete() {
        const filters = []
        const query = { eq(key, value) { filters.push([key, value]); return query },
          then(a, b) {
            calls.push({ delete: table, filters: structuredClone(filters) })
            const result = cleanupThrows ? Promise.reject(Error('synthetic cleanup transport'))
              : Promise.resolve({ error: cleanupFails ? { message: 'synthetic cleanup failure' } : null })
            return result.then(a, b)
          } }
        return query
      },
    }
  } }
}

const valid = [
  ['number', 3, 3], ['integer text', '3', 3], ['comma integer', '3,0', 3],
  ['dot integer', '3.0', 3], ['trimmed comma', '  3,00  ', 3], ['trimmed dot', '\t3.00\n', 3],
  ['minimum', 1, 1], ['comma minimum', '1,0', 1], ['leading decimal comma', ',1e1', 1],
  ['leading decimal dot', '.1e1', 1], ['exponent', '3e0', 3], ['comma exponent', '0,3e1', 3],
  ['plus', '+3,0', 3], ['safe maximum', Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
  ['safe maximum comma', '9007199254740991,0', Number.MAX_SAFE_INTEGER],
]
for (const [label, value, expected] of valid) {
  test(`normalized week and sets: ${label}; exact payloads and immutable input`, async () => {
    const original = freeze(source()), before = structuredClone(original)
    const draft = createCopyDraft(original, owner)
    draft.week_number = value
    draft.sessions[0].exercises[0].sets = value
    const draftBefore = structuredClone(draft), db = database()
    assert.equal(validateCopyDraft(freeze(draft), [], owner), null)
    assert.equal(await sendCopyDraft(db, draft, [], owner), 'weeks-new')
    assert.deepEqual(db.calls, [
      { from: 'weeks' }, { table: 'weeks', row: {
        athlete_id: owner, block_name: 'Basis', coach_note: 'Rolig', block_description: 'Styrke',
        start_date: '2026-10-26', week_number: expected,
      } },
      { from: 'sessions' }, { table: 'sessions', row: {
        week_id: 'weeks-new', title: 'Pas', weekday: 0, session_order: 0,
      } },
      { from: 'exercises' }, { table: 'exercises', row: {
        name: 'Squat', sets: expected, reps: '5', intensity: 'RPE 7', note: 'Pause',
        recommended_weight: 102.5, exercise_order: 0, session_id: 'sessions-new',
      } },
    ])
    // Assert the serialized boundary too: NaN would silently become null here.
    assert.deepEqual(JSON.parse(JSON.stringify(db.calls)), db.calls)
    assert.equal(Number.isSafeInteger(db.calls[1].row.week_number), true)
    assert.equal(Number.isSafeInteger(db.calls[5].row.sets), true)
    assert.deepEqual(original, before)
    assert.deepEqual(draft, draftBefore)
  })
}

const invalid = [
  ['zero', 0], ['negative zero', -0], ['comma zero', '0,0'], ['dot zero', '0.0'],
  ['trimmed zero', ' 0,00 '], ['negative', -1], ['negative comma', '-1,0'],
  ['negative dot', '-1.0'], ['fraction', 3.5], ['comma fraction', '3,5'],
  ['dot fraction', '3.5'], ['subnormal', Number.MIN_VALUE], ['underflow', '1e-999'],
  ['blank', ''], ['spaces', ' \t\n'], ['undefined', undefined],
  ['NaN', NaN], ['infinity', Infinity], ['negative infinity', -Infinity],
  ['NaN text', 'NaN'], ['infinity text', 'Infinity'], ['overflow', '1e309'],
  ['maximum float', Number.MAX_VALUE], ['unsafe', Number.MAX_SAFE_INTEGER + 1],
  ['unsafe comma', '9007199254740992,0'], ['unsafe dot', '9007199254740992.0'],
  ['unit', '3 sets'], ['mixed separators', '3,0.0'], ['multiple comma', '3,,0'],
  ['multiple dot', '3..0'], ['internal space', '3 0'], ['hex', '0x3'],
  ['boolean', true], ['array', [3]], ['object', {}], ['bigint', 3n],
]
for (const [field, message] of [
  ['week_number', 'Kontrollér ugenummer og startdato.'], ['sets', 'Sæt skal være et positivt heltal.'],
]) {
  for (const [label, value] of [...invalid, ...(field === 'week_number' ? [['null', null]] : [])]) {
    test(`invalid ${field}: ${label}; zero database calls`, async () => {
      const draft = createCopyDraft(freeze(source()), owner), db = database()
      if (field === 'week_number') draft.week_number = value
      else draft.sessions[0].exercises[0].sets = value
      const before = structuredClone(draft)
      assert.equal(validateCopyDraft(freeze(draft), [], owner), message)
      await assert.rejects(sendCopyDraft(db, draft, [], owner), { message })
      assert.deepEqual(db.calls, [])
      assert.deepEqual(draft, before)
    })
  }
}

test('nullable sets stays null; absent source fields retain the existing nullable copy contract', async () => {
  for (const value of [null, undefined]) {
    const original = source()
    original.sessions[0].exercises[0].sets = value
    const draft = createCopyDraft(freeze(original), owner), db = database()
    assert.equal(draft.sessions[0].exercises[0].sets, null)
    assert.equal(validateCopyDraft(draft, [], owner), null)
    await sendCopyDraft(db, freeze(draft), [], owner)
    assert.equal(db.calls[5].row.sets, null)
    assert.equal(JSON.parse(JSON.stringify(db.calls))[5].row.sets, null)
  }
})

test('normalized week collisions and date collisions reject before all writes', async () => {
  for (const draftNumber of [3, '3,0', ' 3.00 ']) {
    for (const existingNumber of [3, '3,0', ' 3.00 ']) {
      const draft = createCopyDraft(source(), owner), db = database()
      draft.week_number = draftNumber
      const weeks = freeze([{ week_number: existingNumber, start_date: '2026-12-01' }])
      assert.equal(validateCopyDraft(freeze(draft), weeks, owner), 'Målugen findes allerede. Ret ugenummer eller dato i kladden.')
      await assert.rejects(sendCopyDraft(db, draft, weeks, owner), /Målugen findes allerede/)
      assert.deepEqual(db.calls, [])
    }
  }
  const draft = createCopyDraft(source(), owner), db = database()
  await assert.rejects(sendCopyDraft(db, draft, [{ week_number: 99, start_date: draft.start_date }], owner), /Målugen findes allerede/)
  assert.deepEqual(db.calls, [])
})

test('a late invalid exercise prevents even the first week insert', async () => {
  const draft = createCopyDraft(source(), owner), db = database()
  draft.sessions.push({ title: 'Sidste pas', weekday: 6, exercises: [{ name: 'Row', sets: '0,0', recommended_weight: null }] })
  await assert.rejects(sendCopyDraft(db, freeze(draft), [], owner), /Sæt skal være et positivt heltal/)
  assert.deepEqual(db.calls, [])
})

test('source week uses the parser and overflowing next week is rejected before writes', async () => {
  const original = source()
  original.week_number = ' 2,0 '
  assert.equal(createCopyDraft(freeze(original), owner).week_number, 3)
  const extreme = { ...source(), week_number: Number.MAX_SAFE_INTEGER }
  const draft = createCopyDraft(freeze(extreme), owner), db = database()
  await assert.rejects(sendCopyDraft(db, freeze(draft), [], owner), /Kontrollér ugenummer/)
  assert.deepEqual(db.calls, [])
})

test('owner boundary, default flag and calendar dates remain intact', async () => {
  assert.equal(DEFAULT_COACH_PLAN_COPY, false)
  assert.throws(() => createCopyDraft(freeze(source()), 'other'), /anden atlet/)
  const draft = createCopyDraft(freeze(source()), owner), db = database()
  draft.week_number = '3,0'
  await assert.rejects(sendCopyDraft(db, freeze(draft), [], 'other'), /anden atlet/)
  assert.deepEqual(db.calls, [])
  assert.equal(sessionDate(draft, { weekday: 0 }), '2026-10-26')
  assert.equal(sessionDate(draft, { weekday: 6 }), '2026-11-01')
  assert.equal(sessionDate(draft, { weekday: null }), null)
})

for (const failTable of ['weeks', 'sessions', 'exercises']) {
  for (const transport of [false, true]) {
    test(`${failTable} ${transport ? 'transport' : 'returned'} failure keeps normalized draft and scoped cleanup`, async () => {
      const draft = createCopyDraft(source(), owner)
      draft.week_number = '3,0'
      draft.sessions[0].exercises[0].sets = '3,0'
      const before = structuredClone(draft), db = database({ failTable, transport })
      await assert.rejects(sendCopyDraft(db, freeze(draft), [], owner), /synthetic/)
      assert.equal(db.calls[1].row.week_number, 3)
      if (failTable === 'exercises') assert.equal(db.calls[5].row.sets, 3)
      assert.deepEqual(db.calls.filter(c => c.delete), failTable === 'weeks' ? [] : [
        { delete: 'weeks', filters: [['id', 'weeks-new'], ['athlete_id', owner]] },
      ])
      assert.deepEqual(draft, before)
    })
  }
}

for (const options of [{ cleanupFails: true }, { cleanupThrows: true }]) {
  test(`failed cleanup preserves needsReview warning: ${JSON.stringify(options)}`, async () => {
    const draft = createCopyDraft(source(), owner), db = database({ failTable: 'exercises', ...options })
    draft.sessions[0].exercises[0].sets = '3,0'
    await assert.rejects(sendCopyDraft(db, freeze(draft), [], owner), error => {
      assert.equal(error.needsReview, true)
      assert.equal(error.message, 'Ugen blev kun delvist gemt. Kontrollér programmet før et nyt forsøg.')
      return true
    })
    assert.deepEqual(db.calls.at(-1), { delete: 'weeks', filters: [['id', 'weeks-new'], ['athlete_id', owner]] })
  })
}

const equivalentIntegers = [
  ['120e-1', 12], ['120.e-1', 12], ['12.e0', 12], ['.12e2', 12],
  ['0.12E+2', 12], ['+00012.000e-0', 12], ['120000e-00004', 12],
  ['0000012.', 12], ['\t+001.200E+01\n', 12], ['1.2e1', 12],
  ['10000000000000000e-16', 1], ['.00000000000000001e17', 1],
  ['1e+0000000000000000000000000000000000000000000000000000', 1],
  ['90071992547409910e-1', Number.MAX_SAFE_INTEGER],
  ['9007199254740991.000000000000000000', Number.MAX_SAFE_INTEGER],
]
for (const [dot, expected] of equivalentIntegers) {
  for (const text of new Set([dot, dot.replace('.', ',')])) {
    test(`exact decimal/exponent integer: ${JSON.stringify(text)}`, async () => {
      const draft = createCopyDraft(freeze(source()), owner), db = database()
      draft.week_number = text
      draft.sessions[0].exercises[0].sets = text
      const before = structuredClone(draft)
      assert.equal(validateCopyDraft(freeze(draft), [], owner), null)
      assert.equal(await sendCopyDraft(db, draft, [], owner), 'weeks-new')
      assert.equal(db.calls[1].row.week_number, expected)
      assert.equal(db.calls[5].row.sets, expected)
      assert.deepEqual(JSON.parse(JSON.stringify(db.calls)), db.calls)
      assert.deepEqual(draft, before)
      const blocked = database()
      await assert.rejects(sendCopyDraft(blocked, draft, [{ week_number: expected }], owner), /Målugen/)
      assert.deepEqual(blocked.calls, [])
      const reverse = database(), canonical = { ...draft, week_number: expected }
      await assert.rejects(sendCopyDraft(reverse, canonical, [{ week_number: text }], owner), /Målugen/)
      assert.deepEqual(reverse.calls, [])
    })
  }
}

const nonIntegers = [
  '1.0000000000000001', '4503599627370496.5',
  '9007199254740991.0000000000000001', '9007199254740990.9',
  '10000000000000001e-16', '45035996273704965e-1',
  '90071992547409909e-1', '99999999999999999e-17',
  '10.00000000000000001e-1', '1.0000000000000001e+0',
  '120.000000000000000001e-1', '.99999999999999999',
  '1e-0000000000000000000000000000000000000000000000000001',
  '1e-9999999999999999999999999999999999999999999999999999',
  '1e+9999999999999999999999999999999999999999999999999999',
  '0e+9999999999999999999999999999999999999999999999999999',
  '0e-9999999999999999999999999999999999999999999999999999',
  '1.0000000000000001e16', '9007199254740992.000',
]
const malformed = ['.', ',', '+', 'e1', '.e1', '1e', '1e+', '1e-', '1e1.0', '1e1,0',
  '1e++1', '1e+-1', '1e--1', '1E 1', '+ 1.0', '1. 0', '1.0 e0',
  '-1.0', '-.1e1', '1,0.0', '1.0,0', '1..0', '1,,0', '0o14', '０.１e1']
for (const field of ['week_number', 'sets']) {
  for (const text of new Set([...nonIntegers.flatMap(dot => [dot, dot.replace('.', ',')]), ...malformed])) {
    test(`original ${field} text rejects without rounding: ${JSON.stringify(text)}`, async () => {
      const draft = createCopyDraft(freeze(source()), owner), db = database()
      // Put invalid sets last so validation must cover the entire draft before writing.
      if (field === 'week_number') draft.week_number = text
      else draft.sessions.push({ title: 'Late', weekday: null, exercises: [{ name: 'Row', sets: text, recommended_weight: null }] })
      const before = structuredClone(draft)
      assert.equal(typeof validateCopyDraft(freeze(draft), [], owner), 'string')
      await assert.rejects(sendCopyDraft(db, draft, [], owner))
      assert.deepEqual(db.calls, [])
      assert.deepEqual(draft, before)
    })
  }
}

test('decimal/exponent grid agrees with an exact rational oracle at both write fields', async () => {
  // Independent test oracle: construct rational numbers and divide BigInts.
  // Product code instead counts decimal places/trailing zeros, without powers.
  for (const coefficient of ['1', '12', '100', '9007199254740991', '10000000000000001']) {
    for (const places of [0, 1, 5, 16, 17]) for (let exponent = -6; exponent <= 6; exponent++) {
      const digits = coefficient.padStart(places + 1, '0')
      const mantissa = places ? `${digits.slice(0, -places)}.${digits.slice(-places)}` : `${digits}.`
      const numerator = BigInt(coefficient) * 10n ** BigInt(Math.max(exponent, 0))
      const denominator = 10n ** BigInt(places + Math.max(-exponent, 0))
      const exact = numerator / denominator
      const accepted = numerator % denominator === 0n && exact > 0n && exact <= BigInt(Number.MAX_SAFE_INTEGER)
      for (const separator of ['.', ',']) for (const field of ['week_number', 'sets']) {
        const text = `+${mantissa.replace('.', separator)}E${exponent >= 0 ? '+' : ''}${exponent}`
        const draft = createCopyDraft(freeze(source()), owner), db = database()
        if (field === 'week_number') draft.week_number = text
        else draft.sessions[0].exercises[0].sets = text
        const before = structuredClone(draft), label = `${field}=${text}`
        assert.equal(validateCopyDraft(freeze(draft), [], owner) === null, accepted, label)
        if (accepted) {
          await sendCopyDraft(db, draft, [], owner)
          assert.equal(field === 'week_number' ? db.calls[1].row.week_number : db.calls[5].row.sets, Number(exact), label)
          assert.deepEqual(JSON.parse(JSON.stringify(db.calls)), db.calls, label)
        } else {
          await assert.rejects(sendCopyDraft(db, draft, [], owner), label)
          assert.deepEqual(db.calls, [], label)
        }
        assert.deepEqual(draft, before, label)
      }
    }
  }
})

test('numeric inputs keep their existing binary Number semantics', async () => {
  for (const value of [1.0000000000000001, 4503599627370496.5, Number.MAX_SAFE_INTEGER]) {
    const draft = createCopyDraft(freeze(source()), owner), db = database()
    draft.week_number = value
    draft.sessions[0].exercises[0].sets = value
    await sendCopyDraft(db, freeze(draft), [], owner)
    assert.equal(db.calls[1].row.week_number, value)
    assert.equal(db.calls[5].row.sets, value)
  }
})

test('source week text is checked before incrementing and source remains immutable', () => {
  for (const text of ['1.0000000000000001', '4503599627370496.5', '10000000000000001e-16']) {
    for (const separator of ['.', ',']) {
      const original = freeze({ ...source(), week_number: text.replace('.', separator) }), before = structuredClone(original)
      assert.throws(() => createCopyDraft(original, owner), /gyldigt ugenummer/)
      assert.deepEqual(original, before)
    }
  }
  for (const text of ['120.e-1', '+.12e2', '120000e-4']) {
    const original = freeze({ ...source(), week_number: text }), before = structuredClone(original)
    assert.equal(createCopyDraft(original, owner).week_number, 13)
    assert.deepEqual(original, before)
  }
})
