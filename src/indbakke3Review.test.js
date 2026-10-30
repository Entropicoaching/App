import test from 'node:test'
import assert from 'node:assert/strict'
import { createInboxController } from './dashboard/indbakke2Controller.mjs'

// Separate counterexample fixture: no shared producer fixture or real services.
function setup() {
  const writes = [], keys = []
  const fault = { value: null }
  const scope = { enabled: true, coachId: 'coach/review', athletes: [{ id: 'x', name: '$&<X>' }], hiddenAthleteIds: new Set() }
  const record = { id: 'snapshot', athlete_id: 'x', sender_role: 'athlete', content: 'Hej', read_by_coach: false }
  const database = { from(table) {
    const filters = []; let op = 'read', payload
    const q = { select: () => q, order: () => q, range: () => q,
      eq(key, value) { filters.push([key, value]); return q },
      in(key, value) { filters.push([key, value]); return q },
      update(value) { op = 'update'; payload = value; return q },
      insert(value) { op = 'insert'; payload = value; return q },
      async then(resolve, reject) {
        try {
          if (op !== 'read') {
            writes.push({ table, op, payload, filters })
            if (fault.throwValue) throw fault.throwValue
          }
          resolve({ data: op === 'read' && table === 'messages' ? [{ ...record }] : [] })
        } catch (e) { reject(e) }
      },
    }; return q
  } }
  const c = createInboxController({ enabled: true, database, getScope: () => scope,
    storage: () => ({ getItem(key) { keys.push(key); return fault.value } }) })
  return { c, writes, keys, fault, scope }
}
test('counterexample: no loaded snapshot cannot acknowledge; repeated seen is idempotent', async () => {
  const f = setup(); f.c.select('x')
  assert.equal(await f.c.seen(), false); assert.deepEqual(f.writes, [])
  await f.c.refresh(); assert.equal(await f.c.seen(), true)
  assert.equal(await f.c.seen(), true); assert.equal(f.writes.length, 1)
  assert.deepEqual(f.writes[0], { table: 'messages', op: 'update', payload: { read_by_coach: true },
    filters: [['athlete_id', 'x'], ['sender_role', 'athlete'], ['id', ['snapshot']]] })
})
test('counterexample: empty and oversized retained drafts never reach the message table', async () => {
  const f = setup(); f.c.select('x')
  for (const value of ['   ', 'x'.repeat(10001)]) {
    f.c.draft(value); assert.equal(await f.c.send(), false)
    assert.equal(f.c.state.drafts.x, value); assert.equal(f.c.state.busy, false)
  }
  assert.deepEqual(f.writes, [])
})
test('counterexample: malformed or oversized template collections cannot remain selectable', () => {
  const f = setup(); f.c.select('x'); f.c.draft('Bevar')
  for (const invalid of ['{}', JSON.stringify([{ name: 'Tom', text: '' }]),
    JSON.stringify(Array.from({ length: 51 }, () => ({ name: 'N', text: 'T' })))]) {
    f.fault.value = JSON.stringify([{ name: 'Gyldig', text: 'Hej' }]); f.c.templates()
    assert.equal(f.c.state.templates.length, 1)
    f.fault.value = invalid; f.c.templates(); f.c.applyTemplate(0)
    assert.deepEqual(f.c.state.templates, []); assert.equal(f.c.state.drafts.x, 'Bevar')
    assert.equal(f.c.state.status, ''); assert.match(f.c.state.error, /kunne ikke læses/)
  }
  assert.deepEqual(f.writes, [])
})
test('counterexample: template substitution is literal, coach-key encoded, successful reload clears empty status', () => {
  const f = setup(); f.c.select('x'); f.c.templates()
  assert.equal(f.c.state.status, 'Ingen gemte hurtige svar.')
  f.fault.value = JSON.stringify([{ name: 'Svar', text: '{atlet} / {atlet}' }])
  f.c.templates(); f.c.applyTemplate(0)
  assert.equal(f.c.state.status, ''); assert.equal(f.c.state.error, '')
  assert.equal(f.c.state.drafts.x, '$&<X> / $&<X>')
  assert.ok(f.keys.every(key => key === 'entropi_coach_message_templates_v1:coach%2Freview'))
  assert.deepEqual(f.writes, [])
})
test('counterexample: non-Error transport rejections also produce safe text and preserve unread/draft', async () => {
  const f = setup(); await f.c.refresh(); f.c.select('x'); f.c.draft('Bevar')
  f.fault.throwValue = '<private transport payload>'
  assert.equal(await f.c.send(), false)
  assert.equal(f.c.state.drafts.x, 'Bevar'); assert.doesNotMatch(f.c.state.error, /private/)
  assert.equal(await f.c.seen(), false)
  assert.equal(f.c.rows()[0].unread, 1); assert.match(f.c.state.error, /fortsat ulæst/)
})
test('counterexample: disposed controller cannot send, acknowledge or load templates', async () => {
  const f = setup(); await f.c.refresh(); f.c.select('x'); f.c.draft('Bevar'); f.c.dispose()
  assert.equal(await f.c.send(), false); assert.equal(await f.c.seen(), false)
  f.c.templates(); assert.deepEqual(f.writes, []); assert.deepEqual(f.keys, [])
})
