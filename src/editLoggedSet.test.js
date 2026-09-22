import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applySetEdit } from './editLoggedSet.js'
import { nextSetInSession } from './nextSet.js'

const ex1 = { id: 'e1', name: 'Squat', sets: 4 }
const session = { id: 's1', title: 'Uge 1 · Mandag', exercises: [ex1] }

test('applySetEdit ændrer den ramte log-række uden at fjerne andre rækker (ret sletter ikke)', () => {
  const logs = [
    { id: 'l1', exercise_id: 'e1', set_number: 1, weight: 60, reps_completed: 5 },
    { id: 'l2', exercise_id: 'e1', set_number: 2, weight: 60, reps_completed: 5 },
    { id: 'l3', exercise_id: 'e1', set_number: 3, weight: 60, reps_completed: 5 },
  ]
  const after = applySetEdit(logs, 'e1', 2, { weight: 62.5, reps_completed: 5 })
  assert.equal(after.length, 3) // ingen række forsvundet, ingen ny tilføjet
  assert.deepEqual(after.map(l => l.set_number), [1, 2, 3])
  assert.equal(after[1].weight, 62.5) // samme id, nye felter
  assert.equal(after[1].id, 'l2')
  assert.equal(after[0], logs[0]) // urørte rækker er samme reference (ikke genopbygget)
  assert.equal(after[2], logs[2])
})

test('applySetEdit rammer intet, hvis exercise_id/set_number ikke findes (ingen sletning, ingen ny række)', () => {
  const logs = [{ id: 'l1', exercise_id: 'e1', set_number: 1, weight: 60, reps_completed: 5 }]
  const after = applySetEdit(logs, 'e1', 9, { weight: 100, reps_completed: 1 })
  assert.deepEqual(after, logs)
})

// ORDRE 320 · blok 1 — den egentlige regressionstest for docs/KRITIK-314.md
// fund 3: "ret" på sæt 2 må ALDRIG få nextSetInSession til at springe
// bagud (den gamle onUndoLastSet-genbrug slettede log-rækken, hvilket gjorde
// sæt 2 "uloggede" igen og skjulte sæt 3). Med applySetEdit ændres kun
// felterne på den eksisterende række, så det aktuelle sæt er uændret efter
// en "ret"-redigering af et TIDLIGERE sæt.
test('ret på et tidligere sæt (applySetEdit) ændrer ikke hvilket sæt der er "aktuelt" (nextSetInSession)', () => {
  const loggedThroughSet3 = [1, 2, 3].map(n => ({ id: `l${n}`, exercise_id: 'e1', set_number: n, weight: 60, reps_completed: 5 }))
  const before = nextSetInSession(session, loggedThroughSet3)
  assert.equal(before.setNumber, 4) // sæt 4 er aktuelt (1-3 er logget)

  const afterEditingSet2 = applySetEdit(loggedThroughSet3, 'e1', 2, { weight: 62.5, reps_completed: 5 })
  const after = nextSetInSession(session, afterEditingSet2)
  assert.equal(after.setNumber, 4) // stadig sæt 4 — uændret efter "ret"+"Godkendt" på sæt 2
  assert.equal(afterEditingSet2.length, 3) // sæt 3 er stadig synligt/logget, ikke blevet "usynligt"
})
