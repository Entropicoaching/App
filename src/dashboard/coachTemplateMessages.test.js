import './coachTemplateLoader.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
const { default: CoachActions } = await import('./CoachActions.jsx')
const { TemplateEditor } = await import('./CoachTemplateMessage.jsx')
import { COACH_TEMPLATE_MESSAGES_ENABLED, readCoachTemplates, saveCoachTemplates, fillCoachTemplate, createCoachTemplateSender } from './coachTemplateMessages.mjs'
import { mount, button, field, text, nodes } from './coachTemplateDom.mjs'
const athlete = { id: 'synthetic-a', name: 'Testatlet Sol' }
const coachId = 'synthetic-coach'
function storage() {
  const values = new Map()
  return { values, getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v) }
}
function sender(extra = {}) {
  const writes = []
  const scope = { enabled: true, coachId, athletes: [athlete] }
  const send = createCoachTemplateSender({ enabled: true, getScope: () => scope,
    database: { from(table) { assert.equal(table, 'messages'); return { async insert(row) { writes.push(row); return {} } } } }, ...extra })
  return { send, writes, scope }
}
function editor(extra = {}) {
  const store = storage(), io = sender()
  saveCoachTemplates(store, coachId, [{ name: 'Opfølgning', text: 'Hej {atlet}. Hvordan går det?' }])
  const app = mount(TemplateEditor, { coachId, athlete, storage: () => store, sendMessage: io.send, ...extra })
  return { app, store, ...io }
}
test('flag default OFF leaves daylist tree untouched and performs no storage reads', () => {
  assert.equal(COACH_TEMPLATE_MESSAGES_ENABLED, false)
  const old = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw Error('OFF storage read') } })
  try {
    const props = { enabled: true, athletes: [athlete], today: '2026-10-27', latestByTrack: { [athlete.id]: { besked: { sender_role: 'athlete', created_at: '2026-10-26', content: 'Syntetisk' } } }, dataStatus: { calendar: 'ready', progress: 'ready' } }
    const original = mount(CoachActions, props).render()
    for (const value of [undefined, false, 'true', 1]) {
      assert.equal(JSON.stringify(mount(CoachActions, { ...props, templateMessages: value }).render()), JSON.stringify(original))
    }
    assert.equal(CoachActions({ enabled: false, templateMessages: true }), null)
  } finally { if (old) Object.defineProperty(globalThis, 'localStorage', old); else delete globalThis.localStorage }
})
test('daylist exposes composer for exact athlete only on opt-in; opening does not send', () => {
  let calls = 0
  const props = { enabled: true, templateMessages: true, coachId, sendTemplateMessage: () => { calls++ }, athletes: [athlete], today: '2026-10-27', latestByTrack: { [athlete.id]: { besked: { sender_role: 'athlete', created_at: '2026-10-26' } } }, dataStatus: { calendar: 'ready', progress: 'ready' } }
  const app = mount(CoachActions, props)
  const open = button(app.render(), 'Skabelonbesked til Testatlet Sol')
  assert.equal(open['aria-expanded'], false); open.onClick()
  assert.match(text(app.render()), /Modtager: Testatlet Sol/)
  assert.equal(calls, 0)
})
test('choose, edit and explicitly Send uses edited text and exact recipient/category', async () => {
  const { app, writes } = editor()
  button(app.render(), 'Brug Opfølgning').onClick()
  assert.equal(field(app.render(), 'Beskedkladde').value, 'Hej Testatlet Sol. Hvordan går det?')
  assert.equal(writes.length, 0)
  field(app.render(), 'Beskedkladde').onChange({ target: { value: 'Rettet af coachen' } })
  await button(app.render(), 'Send').onClick()
  assert.deepEqual(writes, [{ athlete_id: athlete.id, sender_role: 'coach', content: 'Rettet af coachen', category: 'besked' }])
  assert.match(text(app.render()), /Beskeden er sendt/)
  assert.equal(nodes(app.render(), n => n.type === 'textarea' && n.props['aria-label'] === 'Beskedkladde').length, 0)
})
test('custom template save/reload is scoped by coach; saving never sends', () => {
  const { app, store, writes } = editor()
  field(app.render(), 'Skabelonnavn').onChange({ target: { value: 'Min tekst' } })
  field(app.render(), 'Skabelontekst').onChange({ target: { value: 'Hej {atlet}, hilsen mig' } })
  button(app.render(), 'Gem skabelon').onClick()
  assert.equal(readCoachTemplates(store, coachId).length, 2)
  assert.deepEqual(readCoachTemplates(store, 'another-coach'), [])
  const fresh = mount(TemplateEditor, { coachId, athlete, storage: () => store })
  button(fresh.render(), 'Brug Min tekst').onClick()
  assert.equal(field(fresh.render(), 'Beskedkladde').value, 'Hej Testatlet Sol, hilsen mig')
  assert.equal(writes.length, 0)
})
test('failed send retains edits, allows retry; stale rapid double click writes once', async () => {
  let finish, calls = 0
  const { app } = editor({ sendMessage: () => { calls++; return new Promise((resolve, reject) => { finish = { resolve, reject } }) } })
  button(app.render(), 'Brug Opfølgning').onClick()
  const send = button(app.render(), 'Send').onClick
  const first = send(); await send()
  assert.equal(calls, 1)
  assert.equal(button(app.render(), 'Sender...').disabled, true)
  finish.reject(Error('synthetic failure')); await first
  assert.match(text(app.render()), /Din tekst er bevaret/)
  assert.match(field(app.render(), 'Beskedkladde').value, /Testatlet Sol/)
  const retry = button(app.render(), 'Send').onClick(); finish.resolve(true); await retry
  assert.equal(calls, 2)
})
test('cancel, whitespace, storage errors and literal replacement never trigger send', () => {
  const { app, writes } = editor()
  button(app.render(), 'Brug Opfølgning').onClick()
  field(app.render(), 'Beskedkladde').onChange({ target: { value: '   ' } })
  assert.equal(button(app.render(), 'Send').disabled, true)
  button(app.render(), 'Kasser kladde').onClick()
  assert.equal(writes.length, 0)
  assert.equal(fillCoachTemplate('{atlet} {atlet}', '$&<synthetic>'), '$&<synthetic> $&<synthetic>')
  const broken = mount(TemplateEditor, { coachId, athlete, storage: () => { throw Error('denied') } })
  assert.match(text(broken.render()), /kunne ikke læses/)
  assert.equal(button(broken.render(), 'Gem skabelon').disabled, true)
})
test('sender rejects disabled flag, wrong coach, removed athlete and empty text without writes', async () => {
  const { send, writes, scope } = sender()
  const args = { coachId, athleteId: athlete.id, text: 'Syntetisk besked' }
  for (const invalid of [{ ...args, coachId: 'wrong' }, { ...args, athleteId: 'wrong' }, { ...args, text: '  ' }, { ...args, text: 'x'.repeat(10001) }]) await assert.rejects(send(invalid))
  scope.athletes = []; await assert.rejects(send(args))
  scope.athletes = [athlete]; scope.enabled = false; await assert.rejects(send(args))
  const off = createCoachTemplateSender({ getScope() { throw Error('must not read') } })
  await assert.rejects(off(args), /slået fra/)
  assert.equal(writes.length, 0)
})
test('handler single flight and refresh failure cannot cause duplicate success reports', async () => {
  let finish, count = 0
  const { send } = sender({ database: { from() { return { insert() { count++; return new Promise(r => { finish = r }) } } } }, onSent() { throw Error('refresh') } })
  const args = { coachId, athleteId: athlete.id, text: 'Syntetisk besked' }
  const first = send(args)
  assert.equal(await send(args), false)
  finish({}); assert.equal(await first, true); assert.equal(count, 1)
})
test('malformed storage cannot overwrite or escape coach scope', () => {
  const store = storage()
  store.setItem('entropi_coach_message_templates_v1:synthetic-coach', '{}')
  assert.throws(() => readCoachTemplates(store, coachId))
  assert.throws(() => saveCoachTemplates(store, coachId, [{ name: '', text: 'x' }]))
  assert.throws(() => saveCoachTemplates(store, '', []))
  const app = mount(TemplateEditor, { coachId, athlete, storage: () => store })
  assert.equal(button(app.render(), 'Gem skabelon').disabled, true)
})
