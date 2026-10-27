import { test } from 'node:test'
import assert from 'node:assert/strict'
import { summarizeWeek } from './ugeFeedback.js'
import { coachUgeFeedback, ugeFeedbackTree } from '../dashboard/coachUgeFeedback.js'

const training = { id: 's1', title: 'Mandag', exercises: [{ id: 'sq', name: 'Squat', sets: 1, reps: '5', recommended_weight: 100 }] }
const rest = { id: 'rest', title: 'Tirsdag', exercises: [] }
const week = { start_date: '2026-10-19', sessions: [training, rest] }
const completed = { exercise_id: 'sq', weight: 100, reps_completed: 5, rpe_actual: 8, rpe: 8 }
const h = (tag, props, ...children) => ({ tag, props, children })
const text = node => node == null ? '' : typeof node !== 'object' ? String(node) : (node.children || []).map(text).join(' ')

test('en tom hviledag gør ikke en gennemført træningsuge delvis', () => {
  const feedback = summarizeWeek(week, [completed])
  assert.equal(feedback.status, 'fuld')
  assert.equal(feedback.pas[1].status, 'ingen_saet_planlagt')
  assert.ok(!feedback.spoergsmaal.some(t => t.includes('manglende pas')))
})

test('coachen ser fuldt gennemført uge med en hviledag', () => {
  const feedback = coachUgeFeedback(week, [completed], new Date('2026-11-15T12:00:00Z'))
  const rendered = text(ugeFeedbackTree(h, feedback, 1))
  assert.match(rendered, /Fuldt gennemført/)
  assert.doesNotMatch(rendered, /Delvist gennemført|manglende pas/)
  assert.match(rendered, /Tirsdag: Ingen planlagte sæt/)
})

test('en uge uden pas og en uge kun med hvile er fortsat tomme', () => {
  assert.equal(summarizeWeek({ sessions: [] }, []).status, 'tom')
  assert.equal(summarizeWeek({ sessions: [rest] }, []).status, 'tom')
})

test('en hviledag skjuler ikke manglende træningssæt', () => {
  assert.equal(summarizeWeek({ sessions: [training, rest] }, []).status, 'ingen_logs')
  const incomplete = { ...training, exercises: [{ ...training.exercises[0], sets: 2 }] }
  assert.equal(summarizeWeek({ sessions: [incomplete, rest] }, [completed]).status, 'delvis')
})

test('en gennemført uge uden RPE beholder ukendt gennemsnit og maks', () => {
  const { rpe, rpe_actual, ...withoutRpe } = completed
  void rpe
  void rpe_actual
  const feedback = summarizeWeek(week, [withoutRpe])
  assert.equal(feedback.status, 'fuld')
  assert.equal(feedback.rpe.gennemsnit, null)
  assert.equal(feedback.rpe.max, null)
  assert.equal(feedback.rpe.saetUdenRpe, 1)
})
