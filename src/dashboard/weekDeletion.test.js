import test from 'node:test'
import assert from 'node:assert/strict'
import { createWeekDeletionQueue } from './weekDeletion.js'

function setup() {
  let now = 0, visible = []
  const timers = new Map(), removed = [], deleted = [], errors = []
  const queue = createWeekDeletionQueue(entries => { visible = entries }, {
    now: () => now,
    later(fn, delay) { const id = Symbol(); timers.set(id, { fn, due: now + delay }); return id },
    cancel(id) { timers.delete(id) },
  })
  const add = (weekId, remove = async () => { removed.push(weekId) }) => queue.schedule({
    weekId, weekNumber: weekId, athleteName: 'Testatlet', remove,
    onDeleted: () => deleted.push(weekId), onError: () => errors.push(weekId),
  })
  return { queue, add, removed, deleted, errors, visible: () => visible,
    setTime(ms) { now = ms },
    async tick(ms) {
      now += ms
      for (const [id, timer] of timers) if (timer.due <= now) { timers.delete(id); await timer.fn() }
    },
  }
}
test('sletning sker først efter 10 sekunder og kan fortrydes ved 9999 ms', async () => {
  const f = setup()
  f.add('w1')
  await f.tick(9999)
  assert.deepEqual(f.removed, [])
  assert.equal(f.queue.undo('w1'), true)
  await f.tick(1)
  assert.deepEqual(f.removed, [])
  assert.deepEqual(f.visible(), [])
})
test('efter fristen sker præcis én sletning og fortryd afvises', async () => {
  const f = setup()
  f.add('w1'); f.add('w1')
  await f.tick(10_000)
  assert.deepEqual(f.removed, ['w1'])
  assert.deepEqual(f.deleted, ['w1'])
  assert.equal(f.queue.undo('w1'), false)
  assert.equal(f.queue.hasPending(), false)
})
test('en forsinket timer giver ikke en længere fortrydelsesfrist', () => {
  const f = setup()
  f.add('w1')
  f.setTime(10_001)
  assert.equal(f.queue.undo('w1'), false)
  f.queue.dispose()
})
test('flere sletninger har hver sin frist og kan fortrydes uafhængigt', async () => {
  const f = setup()
  f.add('w1'); await f.tick(5000); f.add('w2')
  assert.equal(f.visible().length, 2)
  await f.tick(5000)
  assert.deepEqual(f.removed, ['w1'])
  assert.equal(f.queue.undo('w2'), true)
  await f.tick(5000)
  assert.deepEqual(f.removed, ['w1'])
})
test('databasefejl afslutter ventetilstanden og viser en fejl', async () => {
  const f = setup()
  f.add('w1', async () => { throw new Error('Offline') })
  await f.tick(10_000)
  assert.deepEqual(f.errors, ['w1'])
  assert.deepEqual(f.deleted, [])
  assert.deepEqual(f.visible(), [])
})
test('en igangværende sletning kan ikke fortrydes eller startes igen', async () => {
  const f = setup()
  let finish
  f.add('w1', () => new Promise(resolve => { finish = resolve }))
  const tick = f.tick(10_000)
  assert.equal(f.visible()[0].deleting, true)
  assert.equal(f.queue.undo('w1'), false)
  finish(); await tick
  assert.deepEqual(f.deleted, ['w1'])
})
test('unmount afbryder ventende sletninger uden at røre data', async () => {
  const f = setup()
  f.add('w1'); f.queue.dispose()
  await f.tick(10_000)
  assert.deepEqual(f.removed, [])
  f.queue.activate(); f.add('w2'); await f.tick(10_000)
  assert.deepEqual(f.deleted, ['w2'])
})
