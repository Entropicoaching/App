import test from 'node:test'
import assert from 'node:assert/strict'
import { install } from './coachPlanLoader.mjs'
import { mount, nodes, text, button, io } from './coachPlanDom.mjs'
const guard = install()
const { createCopyDraft, sessionDate, validateCopyDraft, sendCopyDraft, DEFAULT_COACH_PLAN_COPY } = await import('./coachPlanCopy.mjs')
const { default: Copy } = await import('./CoachPlanCopy.jsx')
const { default: Program } = await import('./ProgramTab.jsx')
guard.deregister()

const source = (date = '2026-03-23') => ({ id: 'w1', athlete_id: 'a', week_number: 8, start_date: date,
  block_name: 'Basis', coach_note: 'Rolig uge', block_description: 'Styrke', sessions: [
    { id: 's1', title: 'A', weekday: 0, session_order: 0, exercises: [{ id: 'ex1', name: 'Squat', sets: 3, reps: '5', intensity: 'RPE 7', recommended_weight: 100, note: 'Pause', exercise_order: 0 }] },
    { id: 's2', title: 'B', weekday: 6, session_order: 1, exercises: [] },
  ] })
function database(fail = '') {
  const calls = []
  const db = { calls, from(table) {
    return { insert(row) {
      calls.push({ table, row: structuredClone(row) })
      const result = { data: { id: table + '-new' }, error: fail === table ? { message: 'Synthetic failure' } : null }
      return { select() { return { async single() { return result } } }, then(resolve, reject) { return Promise.resolve(result).then(resolve, reject) } }
    }, delete() {
      calls.push({ table, delete: true })
      return { eq() { return { async eq() { return { error: fail === 'cleanup' ? { message: 'cleanup' } : null } } } } }
    } }
  } }
  return db
}
function fixture(props = {}) {
  const week = source()
  io.database = database()
  const sent = []
  const app = mount(Copy, { enabled: true, weeks: [week], athleteId: 'a', onSent: id => sent.push(id), ...props })
  return { app, sent, db: io.database, copy() { button(app.render(), 'Kopiér til næste uge').props.onClick(); return app.render() } }
}
function field(tree, label, value, index = 0) {
  const labels = nodes(tree, node => node.type === 'label' && text(node).startsWith(label))
  const input = nodes(labels[index], node => ['input', 'textarea', 'select'].includes(node.type))[0]
  assert.ok(input, label)
  input.props.onChange({ target: { value } })
}

test('Calendar week, month, year, leap day and both DST changes preserve calendar dates', () => {
  for (const [from, to] of [['2026-03-23', '2026-03-30'], ['2026-10-19', '2026-10-26'], ['2026-01-26', '2026-02-02'], ['2026-12-28', '2027-01-04'], ['2028-02-28', '2028-03-06']]) {
    const draft = createCopyDraft(source(from), 'a')
    assert.equal(draft.start_date, to)
    assert.equal(draft.week_number, 9)
    assert.equal(sessionDate(draft, draft.sessions[0]), to)
  }
  const draft = createCopyDraft(source('2026-03-25'), 'a')
  assert.equal(sessionDate(draft, draft.sessions[0]), '2026-04-06')
  assert.equal(sessionDate(draft, { weekday: null }), null)
  assert.throws(() => createCopyDraft(source('2026-02-30'), 'a'))
})

test('Copy is detached, whitelisted and retains exactly the source sessions', () => {
  const week = source(); week.sessions.pop()
  week.sessions[0].exercises[0].logs = ['private synthetic marker']
  const before = structuredClone(week)
  const draft = createCopyDraft(week, 'a')
  assert.equal(draft.sessions.length, 1)
  assert.equal(draft.sessions[0].exercises[0].id, undefined)
  assert.equal(draft.sessions[0].exercises[0].logs, undefined)
  draft.sessions[0].exercises[0].sets = 2
  assert.deepEqual(week, before)
})

test('Flag is strict default OFF and produces no controls or writes', () => {
  assert.equal(DEFAULT_COACH_PLAN_COPY, false)
  for (const enabled of [undefined, false, 'true', 1]) {
    const f = fixture({ enabled })
    assert.equal(f.app.render(), null)
    assert.equal(f.db.calls.length, 0)
  }
})

test('Actual component handlers edit, remove a session and cancel with zero writes', () => {
  const f = fixture(); let tree = f.copy()
  assert.match(text(tree), /Intet er sendt/)
  field(tree, 'Vægt', '102,5'); tree = f.app.render()
  field(tree, 'Navn på pas', 'Ny A'); tree = f.app.render()
  field(tree, 'Startdato', '2026-04-06'); tree = f.app.render()
  assert.match(text(tree), /2026-04-12/)
  button(tree, 'Fjern pas 2').props.onClick()
  assert.equal(nodes(f.app.render(), n => n.type === 'h3').length, 1)
  button(f.app.render(), 'Annuller kladde').props.onClick()
  assert.equal(f.db.calls.length, 0)
  assert.equal(f.sent.length, 0)
})

test('Explicit Send alone writes edited copy once, including under double click', async () => {
  const f = fixture(); let tree = f.copy()
  field(tree, 'Sæt', '2'); tree = f.app.render()
  field(tree, 'Vægt', '102,5'); tree = f.app.render()
  button(tree, 'Fjern pas 2').props.onClick(); tree = f.app.render()
  assert.equal(f.db.calls.length, 0)
  const send = button(tree, 'Send til atleten').props.onClick
  await Promise.all([send(), send()]); await send()
  assert.deepEqual(f.sent, ['weeks-new'])
  assert.deepEqual(f.db.calls.map(call => call.table), ['weeks', 'sessions', 'exercises'])
  assert.equal(f.db.calls[0].row.start_date, '2026-03-30')
  assert.equal(f.db.calls[2].row.sets, 2)
  assert.equal(f.db.calls[2].row.recommended_weight, 102.5)
  assert.equal(f.db.calls[2].row.session_id, 'sessions-new')
})

test('Collision, invalid fields, no sessions and wrong athlete prevent writes', async () => {
  const week = source(), draft = createCopyDraft(week, 'a')
  for (const [d, weeks, athlete] of [[draft, [{ week_number: 9 }], 'a'], [draft, [{ start_date: draft.start_date }], 'a'], [draft, [], 'b'], [{ ...draft, sessions: [] }, [], 'a'], [{ ...draft, week_number: '1.5' }, [], 'a']]) {
    const db = database()
    assert.ok(validateCopyDraft(d, weeks, athlete))
    await assert.rejects(sendCopyDraft(db, d, weeks, athlete)); assert.equal(db.calls.length, 0)
  }
  const f = fixture({ weeks: [week, { ...week, id: 'w2', week_number: 9, start_date: '2026-03-30' }], openWeekId: 'w1' })
  assert.equal(button(f.copy(), 'Send til atleten').props.disabled, true)
})

test('Write failures retain editable draft and roll back only the incomplete new week', async () => {
  const f = fixture(); io.database = database('exercises'); f.copy()
  await button(f.app.render(), 'Send til atleten').props.onClick()
  assert.match(text(f.app.render()), /Synthetic failure/)
  assert.equal(nodes(f.app.render(), n => n.type === 'fieldset').length, 1)
  assert.deepEqual(io.database.calls.at(-1), { table: 'weeks', delete: true })
  assert.equal(f.sent.length, 0)
  field(f.app.render(), 'Vægt', '95')
})

test('ProgramTab imports actual feature, OFF matches pinned baseline and athlete key changes', async () => {
  const props = { weeks: [], selectedAthlete: { id: 'a' }, athleteLogs: [], programShownWeeks: () => [], programActiveStart: () => null, assignEdits: {}, videoCoachNotes: [] }
  const g = install()
  // Baseline available only in the hermetic flat copy. Integration does not need it.
  const { existsSync } = await import('node:fs')
  if (existsSync(new URL('input-365-362-ProgramTab.jsx', import.meta.url))) {
    const { default: Base } = await import('./input-365-362-ProgramTab.jsx')
    const shape = tree => JSON.stringify(tree, (_, value) => typeof value === 'function' ? '[handler]' : value)
    for (const weeks of [[], [source()]]) {
      assert.equal(shape(mount(Program, { ...props, weeks }).render()), shape(mount(Base, { ...props, weeks }).render()))
    }
  }
  g.deregister()
  const on = mount(Program, { ...props, coachPlanCopyEnabled: true })
  assert.equal(button(on.render(), 'Kopiér til næste uge').props.disabled, true)
  const live = mount(Program, { ...props, weeks: [source()], coachPlanCopyEnabled: true })
  assert.doesNotMatch(text(live.render()), /Kopiér seneste uge/)
  button(live.render(), 'Kopiér til næste uge').props.onClick()
  assert.match(text(live.render()), /Kladde til næste uge/)
  const switched = live.render({ ...props, weeks: [source()], selectedAthlete: { id: 'b' }, coachPlanCopyEnabled: true })
  assert.doesNotMatch(text(switched), /Kladde til næste uge/)
})
