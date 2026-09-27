import { test } from 'node:test'
import assert from 'node:assert/strict'
import { unikkeRekorder } from './personalRecords.js'

test('unikkeRekorder (ORDRE 456, A5): hver (øvelse, vægt, reps) én gang, første registrering, rækkefølgen bevares', () => {
  const rows = [
    { id: 3, exercise_name: 'Bænkpres', weight: 72.5, reps: 6, logged_at: '2026-09-27T10:02:00Z' },
    { id: 2, exercise_name: 'Bænkpres', weight: 72.5, reps: 6, logged_at: '2026-09-27T10:01:00Z' },
    { id: 1, exercise_name: 'bænkpres ', weight: '72.5', reps: 6, logged_at: '2026-09-27T10:03:00Z' },
    { id: 4, exercise_name: 'Squat', weight: 100, reps: 5, logged_at: '2026-09-27T09:00:00Z' },
    { id: 5, exercise_name: 'Squat', weight: 100, reps: 4, logged_at: '2026-09-27T09:00:00Z' },
  ]
  assert.deepEqual(unikkeRekorder(rows).map(r => r.id), [2, 4, 5])
  assert.deepEqual(unikkeRekorder(null), [])
  assert.deepEqual(unikkeRekorder([{ exercise_name: 'Dødløft', weight: 140, reps: 3, created_at: '2026-09-27' }]).length, 1)
})
