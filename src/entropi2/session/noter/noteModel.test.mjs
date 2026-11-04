import test from 'node:test'
import assert from 'node:assert/strict'
import { NOTE_CHOICES, noteValue, noteText, withSetNote } from './noteModel.mjs'
import { createSessionController } from '../sessionModel.mjs'

const fixture = () => {
  const ex = { id: 'lift-a', sets: 2, reps: '5', recommended_weight: 60 }
  const week = { id: 'week-a', athlete_id: 'synthetic-a', sessions: [{ id: 'session-a', exercises: [ex] }] }
  return { enabled: true, athleteId: 'synthetic-a', allWeeks: [week], currentWeek: week,
    exerciseLogs: [], logInputs: {}, setLogInputs() {}, parsePlannedRpe: () => null }
}

test('four fixed choices, optional text, whitespace and explicit clearing', () => {
  assert.deepEqual(NOTE_CHOICES, ['Let', 'Tungt', 'Smerte', 'Teknik'])
  assert.equal(noteText(), '')
  for (const choice of NOTE_CHOICES) {
    assert.equal(noteText({ choice }), choice)
    assert.equal(noteText({ choice, text: '  Rolig bevægelse  ' }), `${choice}: Rolig bevægelse`)
  }
  assert.equal(noteText({ text: '  Kun tekst  ' }), 'Kun tekst')
  assert.equal(noteText({ choice: 'ukendt', text: ' \n ' }), '')
  assert.equal(withSetNote({ note: 'gammel' }, {}).note, '')
})

test('140 UTF-16 units at model boundary, safe emoji boundary and malformed values', () => {
  assert.equal(noteValue({ text: 'x'.repeat(141) }).text.length, 140)
  assert.equal(noteValue({ text: '😀'.repeat(71) }).text, '😀'.repeat(70))
  assert.equal(noteValue({ text: 'x'.repeat(139) + '😀' }).text, 'x'.repeat(139))
  for (const value of [null, false, 17, { text: 42, choice: {} }]) {
    assert.deepEqual(noteValue(value), { choice: '', text: '' })
  }
  const value = Object.freeze({ choice: 'Teknik', text: 'x'.repeat(200) })
  const input = Object.freeze({ weight: '60', reps: '5', rpe: '', rpe_source: null, extra: 'keep' })
  assert.deepEqual(withSetNote(input, value), { ...input, note: `Teknik: ${'x'.repeat(140)}` })
  assert.equal(value.text.length, 200)
})

test('actual copied session controller passes note in inputOverride and preserves missing RPE', async () => {
  const p = fixture(), calls = []
  p.onLogSet = (...args) => {
    calls.push(args)
    p.exerciseLogs.push({ athlete_id: p.athleteId, exercise_id: args[0].id, set_number: args[1] })
  }
  const controller = createSessionController(() => p)
  controller.start()
  const state = controller.state()
  assert.equal(await controller.approve(state.key,
    withSetNote({ weight: '60', reps: '5', rpe: '' }, { choice: 'Tungt', text: 'Sidste rep' }), state.selection.stamp), true)
  assert.equal(calls.length, 1)
  assert.equal(calls[0][1], 1)
  assert.equal(calls[0][5].note, 'Tungt: Sidste rep')
  assert.equal(calls[0][5].rpe, '')
  assert.deepEqual(calls[0][6], { preserveMissingRpe: true, sessionOnly: true })
  assert.equal(controller.state().next.setNumber, 2)
  assert.equal(controller.state().input.note, undefined)
})

test('actual copied controller: failed save retains caller draft; OFF and changed plan reject old approval', async () => {
  const p = fixture(), draft = Object.freeze({ choice: 'Smerte', text: 'Stop her' })
  let writes = 0
  p.onLogSet = () => { writes++; return false }
  const controller = createSessionController(() => p)
  controller.start()
  const state = controller.state(), input = withSetNote({ weight: '60', reps: '5' }, draft)
  assert.equal(await controller.approve(state.key, input, state.selection.stamp), false)
  assert.equal(noteText(draft), 'Smerte: Stop her')
  p.enabled = false
  assert.equal(await controller.approve(state.key, input, state.selection.stamp), false)
  p.enabled = true
  p.currentWeek.sessions[0].exercises[0].sets = 3
  assert.equal(await controller.approve(state.key, input, state.selection.stamp), false)
  assert.equal(writes, 1)
})
