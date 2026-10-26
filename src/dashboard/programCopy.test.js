import test from 'node:test'
import assert from 'node:assert/strict'
import { copyProgramWeeks, copyBlockName, progressedPrescription, skippedProgressions } from './programCopy.js'

const exercise = (name = 'Squat', extra = {}) => ({
  id: 'source-exercise', session_id: 'source-session', name, sets: 3, reps: '5',
  intensity: 'RPE 8', note: 'Pause', exercise_order: 4, recommended_weight: 100, ...extra,
})
const week = (id, number, extra = {}) => ({
  id, athlete_id: 'athlete', week_number: number, block_name: 'Styrke',
  start_date: '2026-12-28', coach_note: 'Rolig start', block_description: 'Stærkere løft',
  sessions: [{ id: 'source-session', title: 'Mandag', session_order: 2, weekday: 0,
    exercises: [exercise(), exercise('Row', { id: 'assistance', exercise_order: 5 })] }], ...extra,
})
function database(fail = () => null) {
  const rows = { weeks: [], sessions: [], exercises: [] }, calls = []
  let sequence = 0
  return { rows, calls, from(table) {
    let op, value, id
    async function execute(single) {
      const call = { table, op, value, id }
      calls.push(call)
      const failure = fail(call)
      if (failure instanceof Error) throw failure
      if (failure) return { error: failure, data: null }
      if (op === 'insert') {
        const row = { ...structuredClone(value), id: `new-${++sequence}` }
        rows[table].push(row)
        return { data: single ? row : null, error: null }
      }
      const sessions = new Set(rows.sessions.filter(s => s.week_id === id).map(s => s.id))
      rows.weeks = rows.weeks.filter(w => w.id !== id)
      rows.sessions = rows.sessions.filter(s => !sessions.has(s.id))
      rows.exercises = rows.exercises.filter(e => !sessions.has(e.session_id))
      return { data: null, error: null }
    }
    const query = {
      insert(payload) { op = 'insert'; value = payload; return query },
      delete() { op = 'delete'; return query },
      eq(field, key) { assert.equal(field, 'id'); id = key; return query },
      select() { return query }, single() { return execute(true) },
      then(resolve, reject) { return execute(false).then(resolve, reject) },
    }
    return query
  } }
}

for (const name of ['Squat', 'Bænkpres', 'Bench press', 'Dødløft', 'Sumo dødløft', 'Squat (comp)', 'Bænkpres - backoff']) {
  test(`progression genkender hovedøvelsen ${name}`, () => {
    const ex = exercise(name)
    assert.deepEqual(progressedPrescription(ex, 'weight'), { reps: '5', recommended_weight: 102.5 })
    assert.deepEqual(progressedPrescription(ex, 'reps'), { reps: '6', recommended_weight: 100 })
    assert.equal(ex.recommended_weight, 100)
    assert.equal(ex.reps, '5')
  })
}
for (const name of ['Row', 'Leg press', 'Rumænsk dødløft', 'Pause squat', 'Close grip bænkpres']) {
  test(`progression bevarer assistanceøvelsen ${name}`, () => {
    for (const mode of ['none', 'weight', 'reps']) {
      assert.deepEqual(progressedPrescription(exercise(name), mode), { reps: '5', recommended_weight: 100 })
    }
  })
}
test('repsintervaller øges i begge ender, fri tekst og ugyldige tal bevares', () => {
  for (const [before, after] of [['3-5', '4-6'], ['3 – 5', '4 – 6'], ['0', '1'], ['AMRAP', 'AMRAP'], ['8 pr. side', '8 pr. side'], ['5/5/5', '5/5/5'], ['5-3', '5-3'], [null, null]]) {
    assert.equal(progressedPrescription(exercise('Squat', { reps: before }), 'reps').reps, after)
  }
})
test('manglende vægte opfindes ikke, nul og decimalkomma bevares korrekt', () => {
  for (const value of [null, undefined, '', 'ukendt', -5]) {
    assert.equal(progressedPrescription(exercise('Squat', { recommended_weight: value }), 'weight').recommended_weight, value ?? null)
  }
  assert.equal(progressedPrescription(exercise('Squat', { recommended_weight: 0 }), 'weight').recommended_weight, 2.5)
  assert.equal(progressedPrescription(exercise('Squat', { recommended_weight: '102,5' }), 'weight').recommended_weight, 105)
  assert.equal(skippedProgressions([week('w', 1, { sessions: [{ exercises: [exercise('Squat', { recommended_weight: null }), exercise('Row', { recommended_weight: null })] }] })], 'weight').length, 1)
})
test('ugekopi bevarer alle planfelter og nye relationer uden at ændre kilden', async () => {
  const source = week('source', 52), original = structuredClone(source), db = database()
  const copied = await copyProgramWeeks({ client: db, athleteId: 'athlete', existingWeeks: [source], sourceWeeks: [source] })
  assert.equal(copied.length, 1)
  assert.deepEqual(db.rows.weeks[0], { id: 'new-1', athlete_id: 'athlete', week_number: 53, block_name: 'Styrke', start_date: '2027-01-04', coach_note: 'Rolig start', block_description: 'Stærkere løft' })
  assert.deepEqual(db.rows.sessions[0], { id: 'new-2', week_id: 'new-1', title: 'Mandag', session_order: 2, weekday: 0 })
  assert.deepEqual(db.rows.exercises[0], { ...source.sessions[0].exercises[0], id: 'new-3', session_id: 'new-2' })
  assert.equal(db.rows.exercises.length, 2)
  assert.deepEqual(source, original)
})
for (const mode of ['none', 'weight', 'reps']) test(`blokkopi med ${mode} fortsætter ugenumre og datoer`, async () => {
  const source = [week('w1', 1), week('w2', 2, { start_date: '2026-12-28' }), week('w3', 3, { start_date: '2027-01-04', sessions: [] })]
  const db = database()
  await copyProgramWeeks({ client: db, athleteId: 'athlete', existingWeeks: [week('tail', 52), ...source], sourceWeeks: source, progression: mode, blockName: 'Styrke (kopi)' })
  assert.deepEqual(db.rows.weeks.map(w => [w.week_number, w.start_date, w.block_name]), [[53, '2027-01-04', 'Styrke (kopi)'], [54, '2027-01-11', 'Styrke (kopi)'], [55, '2027-01-18', 'Styrke (kopi)']])
  assert.equal(db.rows.sessions.length, 2)
  assert.equal(db.rows.exercises.length, 4)
  for (const ex of db.rows.exercises) {
    assert.equal(ex.recommended_weight, mode === 'weight' && ex.name === 'Squat' ? 102.5 : 100)
    assert.equal(ex.reps, mode === 'reps' && ex.name === 'Squat' ? '6' : '5')
  }
})
test('blokkopi får sit eget navn uden at blive slået sammen med den sidste blok', () => {
  assert.equal(copyBlockName('Styrke', [week('w', 1)]), 'Styrke (kopi)')
  assert.equal(copyBlockName('Styrke', [week('w', 1, { block_name: 'Styrke (kopi)' })]), 'Styrke (kopi 2)')
  assert.equal(copyBlockName(null, []), 'Blok (kopi)')
})
for (const table of ['weeks', 'sessions', 'exercises']) {
  for (const thrown of [false, true]) test(`fejl i ${table}, kastet=${thrown}, rydder kun forsøgets kopier`, async () => {
    let count = 0
    const db = database(call => call.table === table && call.op === 'insert' && ++count === 2 ? thrown ? new Error('Offline') : { message: 'Afvist' } : null)
    const sources = [week('w1', 1), week('w2', 2)]
    await assert.rejects(copyProgramWeeks({ client: db, athleteId: 'athlete', existingWeeks: sources, sourceWeeks: sources }), /Kopieringen fejlede/)
    assert.deepEqual(db.rows, { weeks: [], sessions: [], exercises: [] })
    assert.ok(db.calls.filter(c => c.op === 'delete').every(c => c.id.startsWith('new-')))
  })
}
test('fejl i oprydning fortæller at der kan være en delvis kopi', async () => {
  const db = database(call => call.table === 'sessions' || call.op === 'delete' ? { message: 'Afvist' } : null)
  await assert.rejects(copyProgramWeeks({ client: db, athleteId: 'athlete', existingWeeks: [], sourceWeeks: [week('w1', 1)] }), /delvis kopi/)
})
test('ukendt progression afvises før første skrivning', async () => {
  const db = database()
  await assert.rejects(copyProgramWeeks({ client: db, athleteId: 'athlete', existingWeeks: [], sourceWeeks: [week('w1', 1)], progression: 'double' }), /Vælg en progression/)
  assert.deepEqual(db.calls, [])
})
