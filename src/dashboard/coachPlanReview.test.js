// Fresh counterexamples against the final modules, independent of the main fixtures.
import test from 'node:test'
import assert from 'node:assert/strict'
import { install } from './coachPlanLoader.mjs'
import { mount, nodes, text, button, io } from './coachPlanDom.mjs'
const hook = install()
const { default: Copy } = await import('./CoachPlanCopy.jsx')
const { default: Program } = await import('./ProgramTab.jsx')
const { createCopyDraft, sessionDate, sendCopyDraft } = await import('./coachPlanCopy.mjs')
hook.deregister()
const week = { id: 'source', athlete_id: 'alpha', week_number: 1, start_date: '2026-10-19', sessions: [{ title: 'Only', weekday: 6, exercises: [{ name: 'Lift', sets: 1 }] }] }
function fake({ failTable, cleanupFails = false, throwTable, pause } = {}) {
  const calls = []
  return { calls, from(table) { return {
    insert(row) {
      calls.push({ table, row })
      const result = async () => {
        if (pause && table === 'weeks') await pause
        if (table === throwTable) throw new Error('Transport rejected')
        return { data: { id: table + '42' }, error: table === failTable ? { message: 'Write rejected' } : null }
      }
      return { select() { return { single: result } }, then(a, b) { return result().then(a, b) } }
    },
    delete() { calls.push({ table, delete: true }); return { eq(key, value) {
      assert.equal(key, 'id'); assert.equal(value, 'weeks42')
      return { async eq(key2, value2) {
        assert.equal(key2, 'athlete_id'); assert.equal(value2, 'alpha')
        return { error: cleanupFails ? { message: 'Cleanup rejected' } : null }
      } }
    } } },
  } } }
}
const props = { weeks: [week], athleteId: 'alpha', enabled: true, onSent() {} }

test('Counterexample 1: cleanup failure blocks stale Send and new copies', async () => {
  io.database = fake({ failTable: 'exercises', cleanupFails: true })
  const app = mount(Copy, props)
  button(app.render(), 'Kopiér til næste uge').props.onClick()
  const send = button(app.render(), 'Send til atleten').props.onClick
  await send(); const count = io.database.calls.length
  await send()
  assert.equal(io.database.calls.length, count)
  assert.equal(button(app.render(), 'Send til atleten').props.disabled, true)
  assert.match(text(app.render()), /delvist gemt/)
  button(app.render(), 'Annuller kladde').props.onClick()
  assert.equal(button(app.render(), 'Kopiér til næste uge').props.disabled, true)
})

test('Counterexample 2: old weeks after athlete switch cannot seed another athlete', () => {
  assert.throws(() => createCopyDraft(week, 'beta'), /anden atlet/)
  const app = mount(Copy, { ...props, athleteId: 'beta' })
  button(app.render(), 'Kopiér til næste uge').props.onClick()
  assert.match(text(app.render()), /anden atlet/)
  assert.equal(nodes(app.render(), n => n.type === 'fieldset').length, 0)
})

test('Counterexample 3: failures on week, session, exercise and thrown transport never report success', async () => {
  const draft = createCopyDraft(week, 'alpha')
  for (const options of [{ failTable: 'weeks' }, { failTable: 'sessions' }, { failTable: 'exercises' }, { throwTable: 'sessions' }]) {
    const db = fake(options)
    await assert.rejects(sendCopyDraft(db, draft, [week], 'alpha'))
    assert.equal(db.calls.filter(c => c.delete).length, options.failTable === 'weeks' ? 0 : 1)
  }
})

test('Counterexample 4: weekday dates and flexible days survive both clock changes', () => {
  for (const [start, sunday] of [['2026-03-16', '2026-03-29'], ['2026-10-12', '2026-10-25']]) {
    const draft = createCopyDraft({ ...week, start_date: start }, 'alpha')
    assert.equal(sessionDate(draft, { weekday: 6 }), sunday)
    assert.equal(sessionDate(draft, { weekday: null }), null)
    assert.equal(sessionDate(draft, { weekday: 7 }), null)
  }
})

test('Counterexample 5: removing the last session prevents Send even via handler', async () => {
  io.database = fake()
  const app = mount(Copy, props)
  button(app.render(), 'Kopiér til næste uge').props.onClick()
  button(app.render(), 'Fjern pas 1').props.onClick()
  const send = button(app.render(), 'Send til atleten')
  assert.equal(send.props.disabled, true)
  await send.props.onClick()
  assert.equal(io.database.calls.length, 0)
})

test('Counterexample 6: pending Send cannot open an old week in a new athlete profile', async () => {
  let release
  const pause = new Promise(resolve => { release = resolve })
  io.database = fake({ pause })
  const opened = []
  const p = { weeks: [week], selectedAthlete: { id: 'alpha' }, athleteLogs: [], assignEdits: {}, programShownWeeks: () => [], programActiveStart: () => null,
    coachPlanCopyEnabled: true, setOpenWeekId: id => opened.push(id), fetchWeeks() {}, showFlash() {} }
  const app = mount(Program, p)
  button(app.render(), 'Kopiér til næste uge').props.onClick()
  const promise = button(app.render(), 'Send til atleten').props.onClick()
  app.render({ ...p, selectedAthlete: { id: 'beta' }, weeks: [] })
  release(); await promise
  assert.deepEqual(opened, [])
  assert.equal(io.database.calls[0].row.athlete_id, 'alpha')
})

test('Counterexample 7: unordered source weeks use highest number, explicit open week wins', () => {
  for (const [openWeekId, expected] of [[undefined, 5], ['source', 2]]) {
    const app = mount(Copy, { ...props, openWeekId, weeks: [{ ...week, id: 'other', week_number: 4 }, week] })
    button(app.render(), 'Kopiér til næste uge').props.onClick()
    const label = nodes(app.render(), n => n.type === 'label' && text(n).startsWith('Ugenummer'))[0]
    assert.equal(nodes(label, n => n.type === 'input')[0].props.value, expected)
  }
})
