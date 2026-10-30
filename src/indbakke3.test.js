import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { createInboxController } from './dashboard/indbakke2Controller.mjs'
import { DEFAULT_INDBAKKE2, indbakke2Enabled } from './indbakke2.mjs'
import * as dom from './indbakke2Dom.mjs'

// Only React rendering and presentation styles are synthetic. Import the actual
// panel, controller, template storage reader and message sender in repo layout.
const viewURL = new URL('./dashboard/Indbakke2View.mjs', import.meta.url).href
registerHooks({ resolve(specifier, context, next) {
  if (context.parentURL === viewURL && specifier === 'react')
    return { url: new URL('./indbakke2Dom.mjs', import.meta.url).href, shortCircuit: true }
  if (context.parentURL === viewURL && specifier === '../dashboardShared.js')
    return { url: 'data:text/javascript,export const s={wrap:{},btnPrimary:{},btnGhost:{},fieldInput:{}}', shortCircuit: true }
  return next(specifier, context)
} })
const { InboxPanel } = await import('./dashboard/Indbakke2View.mjs')
const incoming = (id, athlete_id = 'a', sender_role = 'athlete') => ({
  id, athlete_id, sender_role, content: '<img src=x onerror=bad()>', read_by_coach: false,
  created_at: '2026-10-30T12:00:00Z',
})
function fixture(query = '?indbakke2=1') {
  const enabled = indbakke2Enabled(query)
  const scope = { enabled, coachId: 'coach-a', athletes: [{ id: 'a', name: '<b>Alfa</b>' },
    { id: 'b', name: 'Beta' }], hiddenAthleteIds: new Set() }
  const rows = [incoming('one'), incoming('other', 'b'), incoming('outgoing', 'a', 'coach')]
  const calls = [], storageKeys = []
  const faults = {}; let stored = JSON.stringify([{ name: '<script>Ros</script>', text: 'Godt, {atlet}!' }])
  const database = { from(table) {
    let operation = 'read', payload, filters = []
    const q = {
      select() { return q }, order() { return q }, range() { return q },
      eq(key, value) { filters.push(row => row[key] === value); return q },
      in(key, values) { filters.push(row => values.includes(row[key])); return q },
      insert(value) { operation = 'insert'; payload = value; return q },
      update(value) { operation = 'update'; payload = value; return q },
      async then(resolve, reject) {
        try {
          calls.push({ table, operation, payload })
          if (faults[operation + 'Wait']) await faults[operation + 'Wait']
          if (faults[operation + 'Throw']) throw Error('PRIVATE transport details <script>bad</script>')
          if (faults[operation + 'Result']) return resolve({ error: { message: 'PRIVATE backend details' } })
          const selected = table === 'messages' ? rows.filter(row => filters.every(f => f(row))) : []
          if (operation === 'update') selected.forEach(row => Object.assign(row, payload))
          if (operation === 'insert') rows.push({ ...payload, id: 'sent', created_at: '2026-10-30T13:00:00Z' })
          resolve({ data: structuredClone(selected) })
        } catch (error) { reject(error) }
      },
    }
    return q
  } }
  const storage = () => ({ getItem(key) {
    storageKeys.push(key)
    if (faults.storage) throw Error('PRIVATE storage details')
    return stored
  } })
  const controller = createInboxController({ enabled, database, getScope: () => scope, storage })
  return { controller, scope, rows, calls, faults, storageKeys, store(value) { stored = value } }
}
const panel = f => InboxPanel({ controller: f.controller, state: f.controller.state })
const text = f => dom.text(panel(f))
const click = (f, label) => {
  const button = dom.nodes(panel(f)).find(n => n.type === 'button' && dom.text(n).replace(/\s+/g, ' ').trim() === label)
  assert.ok(button, label + ': ' + dom.text(panel(f))); assert.ok(!button.props.disabled, label)
  return button.props.onClick()
}
async function open(f) { await f.controller.refresh(); await click(f, '<b>Alfa</b> · 1 ulæste') }
function draft(f, value) {
  dom.nodes(panel(f)).find(n => n.type === 'textarea').props.onChange({ target: { value } })
}

test('OFF controller denies every action without database or storage access', async () => {
  assert.equal(DEFAULT_INDBAKKE2, false)
  for (const query of ['', '?indbakke2=0', '?indbakke2=1&indbakke2=1']) {
    const f = fixture(query)
    assert.equal(await f.controller.refresh(), false)
    assert.equal(await f.controller.send(), false)
    assert.equal(await f.controller.seen(), false)
    assert.throws(() => f.controller.select('a'))
    f.controller.templates()
    assert.deepEqual(f.calls, []); assert.deepEqual(f.storageKeys, [])
  }
})

test('ON actual thread handlers load scoped template, allow editing, send once and mark seen independently', async () => {
  const f = fixture(); await open(f)
  click(f, 'Eksisterende hurtige svar'); click(f, '<script>Ros</script>')
  assert.deepEqual(f.storageKeys, ['entropi_coach_message_templates_v1:coach-a'])
  assert.equal(f.controller.state.drafts.a, 'Godt, <b>Alfa</b>!')
  assert.equal(f.calls.some(c => c.operation === 'insert'), false)
  draft(f, '<b>Redigeret svar</b>')
  await click(f, 'Send')
  assert.deepEqual(f.calls.find(c => c.operation === 'insert').payload, {
    athlete_id: 'a', sender_role: 'coach', content: '<b>Redigeret svar</b>', category: 'besked',
  })
  assert.equal(f.rows[0].read_by_coach, false, 'send does not implicitly mark seen')
  f.rows.push(incoming('new-arrival'))
  await click(f, 'Markér som set')
  assert.equal(f.rows[0].read_by_coach, true)
  for (const id of ['other', 'outgoing', 'new-arrival'])
    assert.equal(f.rows.find(row => row.id === id).read_by_coach, false, id)
  assert.equal(f.calls.filter(c => c.operation === 'insert').length, 1)
  assert.match(text(f), /<b>Redigeret svar<\/b>/)
  assert.equal(dom.nodes(panel(f)).some(n => ['img', 'script', 'b'].includes(n.type) || n.props.dangerouslySetInnerHTML), false)
})

for (const kind of ['Throw', 'Result']) {
  test(`send ${kind} preserves editable draft, hides backend details and permits retry`, async () => {
    const f = fixture(); await open(f); draft(f, 'Bevar min kladde')
    f.faults['insert' + kind] = true
    assert.equal(await click(f, 'Send'), false)
    assert.equal(f.controller.state.drafts.a, 'Bevar min kladde')
    assert.match(text(f), /Beskeden kunne ikke sendes\. Din kladde er bevaret\. Prøv igen\./)
    assert.doesNotMatch(text(f), /PRIVATE|transport details|backend details/)
    assert.equal(f.controller.state.busy, false)
    delete f.faults['insert' + kind]
    assert.equal(await click(f, 'Send'), true)
    assert.equal(f.controller.state.drafts.a, '')
  })
  test(`seen ${kind} preserves unread state and uses fixed error text`, async () => {
    const f = fixture(); await open(f); f.faults['update' + kind] = true
    assert.equal(await click(f, 'Markér som set'), false)
    assert.equal(f.rows[0].read_by_coach, false)
    assert.equal(f.controller.rows()[0].unread, 1)
    assert.match(text(f), /Kunne ikke markere som set\. Samtalen er fortsat ulæst\./)
    assert.doesNotMatch(text(f), /PRIVATE/)
    delete f.faults['update' + kind]
    assert.equal(await click(f, 'Markér som set'), true)
  })
}

test('thrown refresh uses safe text and persisted send remains acknowledged', async () => {
  const f = fixture(); await open(f); draft(f, 'Send én gang')
  f.faults.readThrow = true
  assert.equal(await click(f, 'Send'), true)
  assert.equal(f.controller.state.drafts.a, '')
  assert.match(text(f), /Beskeden er sendt/)
  assert.match(text(f), /Samtalerne kunne ikke opdateres\. Prøv igen\./)
  assert.doesNotMatch(text(f), /PRIVATE/)
  assert.equal(f.calls.filter(c => c.operation === 'insert').length, 1)
})

test('empty quick reply storage is explicit and clears old errors without touching the draft', async () => {
  const f = fixture(); await open(f); draft(f, 'Min tekst')
  f.faults.storage = true; click(f, 'Eksisterende hurtige svar')
  assert.match(text(f), /kunne ikke læses/)
  delete f.faults.storage; f.store(null); click(f, 'Eksisterende hurtige svar')
  assert.match(text(f), /Ingen gemte hurtige svar\./)
  assert.equal(f.controller.state.error, '')
  assert.equal(f.controller.state.drafts.a, 'Min tekst')
  assert.equal(f.calls.some(c => c.operation === 'insert'), false)
})

test('invalid storage hides previously loaded templates and leaves safe error, not stale success', async () => {
  const f = fixture(); await open(f); click(f, 'Eksisterende hurtige svar')
  await click(f, 'Markér som set')
  f.store('{broken'); click(f, 'Eksisterende hurtige svar')
  assert.deepEqual(f.controller.state.templates, [])
  assert.equal(f.controller.state.status, '')
  assert.match(text(f), /De eksisterende hurtige svar kunne ikke læses\./)
  assert.doesNotMatch(text(f), /<script>Ros<\/script>/)
})

test('pending send locks template reads and competing mutations', async () => {
  const f = fixture(); await open(f); draft(f, 'Vent')
  let finish; f.faults.insertWait = new Promise(resolve => { finish = resolve })
  const pending = click(f, 'Send')
  assert.equal(await f.controller.send(), false)
  assert.equal(await f.controller.seen(), false)
  f.controller.templates(); assert.deepEqual(f.storageKeys, [])
  finish(); assert.equal(await pending, true)
  assert.equal(f.calls.filter(c => c.operation === 'insert').length, 1)
})

test('hidden target or revoked flag cannot send or mark seen from a retained handler', async () => {
  for (const revoke of [f => f.scope.hiddenAthleteIds.add('a'), f => { f.scope.enabled = false }]) {
    const f = fixture(); await open(f); draft(f, 'Bevar'); revoke(f)
    assert.equal(await f.controller.send(), false)
    assert.equal(await f.controller.seen(), false)
    assert.equal(f.calls.some(c => ['insert', 'update'].includes(c.operation)), false)
    assert.equal(f.controller.state.drafts.a, 'Bevar')
  }
})
