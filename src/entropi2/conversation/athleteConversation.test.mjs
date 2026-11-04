import test from 'node:test'
import assert from 'node:assert/strict'
import { createConversation } from './conversationController.mjs'
import { createConversationAdapters } from './conversationAdapters.mjs'
import { mountConversation } from './ConversationView.mjs'
import { athleteAnswers, athleteSetContent } from './athleteConversation.mjs'

// In-memory host and backend only; actual view, controller and database adapter.
class Element {
  constructor(tagName, ownerDocument) {
    Object.assign(this, { tagName, ownerDocument, style: {}, dataset: {}, attributes: {},
      children: [], events: new Map(), value: '', _text: '', disabled: false })
  }
  set textContent(value) { this._text = String(value); this.children = [] }
  get textContent() { return this._text + this.children.map(n => n.textContent).join(' ') }
  append(...children) { this.children.push(...children) }
  replaceChildren(...children) { this._text = ''; this.children = children }
  setAttribute(key, value) { this.attributes[key] = String(value) }
  addEventListener(type, fn) { this.events.set(type, fn) }
  async click() { if (!this.disabled) return this.events.get('click')?.() }
  focus() { this.ownerDocument.focused = this }
}
const find = (el, tag) => [...(el.tagName === tag ? [el] : []), ...el.children.flatMap(n => find(n, tag))]
const button = (el, text) => {
  const rows = find(el, 'button').filter(n => n.textContent === text)
  assert.equal(rows.length, 1, text); return rows[0]
}
const field = (el, label) => [...find(el, 'input'), ...find(el, 'textarea')]
  .find(n => n.attributes['aria-label'] === label)
const type = (el, value) => { el.value = value; el.events.get('input')?.() }
const message = (id, content, role = 'coach', at = '2026-11-04T12:00:00Z') => ({
  id, content, sender_role: role, athlete_id: 'synthetic', created_at: at,
})

function fixture(role = 'athlete') {
  const doc = { createElement: tag => new Element(tag, doc) }, root = doc.createElement('root')
  let scope = { enabled: true, role, ownerId: 'synthetic-owner', athleteUserId: 'synthetic-owner',
    athleteId: 'synthetic', athletes: [{ id: 'synthetic' }] }, serial = 0, uploads = 0
  const rows = [], writes = [], reads = [], faults = {}
  const database = {
    from(table) {
      assert.equal(table, 'messages')
      const filters = []; let insert, patch
      const q = {
        select() { return q }, eq(key, value) { filters.push([key, value]); return q },
        order() { return q }, range() { return q },
        insert(row) { insert = row; return q }, update(value) { patch = value; return q },
        then(resolve, reject) {
          return Promise.resolve().then(async () => {
            if (insert) {
              writes.push(['insert', { ...insert }])
              if (faults.pending) await faults.pending
              if (faults.send) return { error: Error('synthetic send failure') }
              rows.push({ ...insert, created_at: '2026-11-04T13:00:00Z' })
              return faults.unknown ? { error: Error('synthetic lost receipt') } : { data: null }
            }
            assert.ok(filters.some(([key, value]) => key === 'athlete_id' && value === 'synthetic'))
            const data = rows.filter(row => filters.every(([key, value]) => row[key] === value))
            if (patch) {
              writes.push(['seen', filters, patch])
              if (faults.seen) return { error: Error('synthetic read receipt failure') }
              data.forEach(row => Object.assign(row, patch)); return { data: data.map(row => ({ id: row.id })) }
            }
            reads.push(filters)
            return faults.read ? { error: Error('synthetic load failure') } : { data: data.map(row => ({ ...row })) }
          }).then(resolve, reject)
        },
      }
      return q
    },
    async rpc(name) { assert.equal(name, 'get_my_shared_video_analyses_v3'); return { data: [] } },
  }
  const adapters = createConversationAdapters({ enabled: true, database, storage: () => null,
    getScope: () => scope, openUpload: () => { uploads++; if (faults.upload) throw Error('synthetic upload failure') } })
  const controller = createConversation({ enabled: true, adapters, storage: () => null, uuid: () => `sent-${++serial}` })
  const dispose = mountConversation(root, controller, { enabled: true })
  return { root, controller, rows, writes, reads, faults, dispose,
    scope: value => { scope = { ...scope, ...value } }, uploads: () => uploads }
}

test('athlete sees unread border and one-tap question replies; actual adapter sends once, no implicit seen', async () => {
  const f = fixture(); f.rows.push(message('question', 'Har du energi til passet?'))
  await f.controller.refresh()
  const li = find(f.root, 'li')[0]
  assert.equal(li.dataset.unread, 'true'); assert.match(li.style.borderInlineStart, /#d8b16b/)
  assert.match(li.children[0].textContent, /Ulæst/)
  assert.match(f.root.textContent, /Send svar med ét tryk/)
  assert.deepEqual(f.writes, [])
  const answer = button(f.root, 'Ja')
  await answer.click()
  assert.deepEqual(f.writes.map(w => w[0]), ['insert'])
  assert.equal(f.writes[0][1].content, 'Svar på: Har du energi til passet?\nJa')
  assert.equal(f.writes[0][1].athlete_id, 'synthetic')
  assert.equal(f.writes[0][1].category, 'besked')
  assert.equal(f.controller.snapshot().draft, '')
  assert.equal(find(f.root, 'button').some(n => n.textContent === 'Ja'), false)
  await answer.click() // A retained old button cannot resend an answered question.
  assert.equal(f.writes.length, 1)
  f.dispose()
})

test('question suggestions exclude old/answered questions and do not overwrite an existing draft', async () => {
  const f = fixture(); f.rows.push(message('one', 'Har du energi?'),
    message('two', 'Min egen besked', 'athlete', '2026-11-04T12:01:00Z'))
  await f.controller.refresh(); assert.equal(find(f.root, 'button').some(n => n.textContent === 'Ja'), false)
  f.rows.push(message('new', 'Hvordan gik passet?', 'coach', '2026-11-04T12:02:00Z'))
  await f.controller.refresh()
  assert.equal(find(f.root, 'button').some(n => n.textContent === 'Ja'), false)
  f.controller.draft('Min kladde')
  const reply = button(f.root, 'Jeg har brug for hjælp')
  assert.equal(reply.disabled, true); await reply.click()
  assert.equal(await f.controller.answerQuestion('message:new', 'Jeg har brug for hjælp'), false)
  assert.equal(f.controller.snapshot().draft, 'Min kladde'); assert.deepEqual(f.writes, [])
  f.controller.draft(''); await button(f.root, 'Jeg har brug for hjælp').click()
  assert.match(f.writes[0][1].content, /Hvordan gik passet\?\nJeg har brug for hjælp/)
  assert.deepEqual(athleteAnswers({ value: { content: 'Må jeg ændre planen?' } }), ['Ja', 'Nej', 'Jeg er i tvivl'])
  f.dispose()
})

test('send error keeps the answer and identity; retry and unknown outcome do not duplicate', async () => {
  const f = fixture(); f.rows.push(message('q', 'Er du klar?')); await f.controller.refresh()
  f.faults.send = true; await button(f.root, 'Nej').click()
  assert.match(f.root.textContent, /Beskeden blev ikke sendt/)
  const failed = f.controller.snapshot().operation
  assert.equal(failed.status, 'error'); assert.match(f.controller.snapshot().draft, /\nNej$/)
  assert.equal(await f.controller.answerQuestion('message:q', 'Ja'), false)
  assert.equal(await f.controller.shareSet('Syntetisk sæt', 'Syntetisk note'), false)
  f.faults.send = false; f.faults.unknown = true
  await button(f.root, 'Prøv afsendelse igen').click()
  assert.equal(f.controller.snapshot().operation.status, 'sent')
  assert.equal(f.writes.length, 2)
  assert.equal(f.writes[0][1].id, f.writes[1][1].id)
  assert.equal(f.rows.filter(row => row.id === failed.row.id).length, 1)
  await f.controller.retry(); assert.equal(f.writes.length, 2)
  f.dispose()
})

test('folded set sharing sends supplied set + short note through messages; empty and errors are honest', async () => {
  const f = fixture(); await f.controller.refresh()
  assert.match(f.root.textContent, /Ingen beskeder endnu/)
  const details = find(f.root, 'details').find(n => n.children[0].textContent === 'Del et sæt fra passet')
  assert.equal(details.open, false)
  const set = field(f.root, 'Sæt fra passet'), note = field(f.root, 'Kort note til coachen')
  const send = button(f.root, 'Send sæt til coach')
  assert.equal(send.disabled, true); await send.click(); assert.deepEqual(f.writes, [])
  type(set, 'Squat, sæt 2 · 80 kg × 5'); type(note, 'Sidste gentagelse var tung.')
  f.controller.draft('En besked'); assert.equal(send.disabled, true)
  f.controller.draft(''); assert.equal(send.disabled, false)
  f.faults.send = true; await send.click()
  assert.equal(set.value, 'Squat, sæt 2 · 80 kg × 5'); assert.equal(note.value, 'Sidste gentagelse var tung.')
  assert.equal(send.disabled, true); assert.equal(note.disabled, true)
  f.faults.send = false; await button(f.root, 'Prøv afsendelse igen').click()
  assert.equal(f.rows.at(-1).content, 'Fra passet · Squat, sæt 2 · 80 kg × 5\nSidste gentagelse var tung.')
  assert.equal(set.value, ''); assert.equal(note.value, ''); assert.equal(send.disabled, true)
  assert.equal(f.writes.every(w => w[0] === 'insert'), true)
  assert.throws(() => athleteSetContent('', 'note'))
  assert.throws(() => athleteSetContent('s'.repeat(161), 'note'))
  assert.throws(() => athleteSetContent('set', 'n'.repeat(241)))
  f.dispose()
})

test('loading/read failure/role change block new actions; existing upload and read receipt path remains explicit', async () => {
  const f = fixture(); assert.equal(await f.controller.shareSet('set', 'note'), false)
  f.rows.push(message('q', 'Kan du træne?')); await f.controller.refresh()
  f.faults.read = true; await f.controller.refresh()
  assert.match(f.root.textContent, /Samtalen kunne ikke hentes/)
  assert.equal(find(f.root, 'button').some(n => n.textContent === 'Ja'), false)
  assert.equal(await f.controller.shareSet('set', 'note'), false)
  assert.equal(await f.controller.answerQuestion('message:q', 'Ja'), false)
  f.faults.read = false; await f.controller.refresh()
  f.faults.seen = true; await find(f.root, 'li')[0].children[0].click()
  assert.equal(find(f.root, 'li')[0].dataset.unread, 'true')
  f.faults.seen = false; await find(f.root, 'li')[0].children[0].click()
  assert.equal(find(f.root, 'li')[0].dataset.unread, 'false')
  assert.equal(find(f.root, 'li')[0].children[1].hidden, false)
  assert.match(find(f.root, 'li')[0].style.borderInlineStart, /transparent/)
  f.faults.upload = true; await button(f.root, 'Send video').click()
  assert.match(f.root.textContent, /synthetic upload failure/)
  f.faults.upload = false; await button(f.root, 'Send video').click(); assert.equal(f.uploads(), 2)
  type(field(f.root, 'Sæt fra passet'), 'Syntetisk sæt')
  type(field(f.root, 'Kort note til coachen'), 'Syntetisk note')
  const count = f.writes.length
  f.scope({ athleteId: 'other' }); await f.controller.shareSet('set', 'note')
  await f.controller.answerQuestion('message:q', 'Ja')
  assert.equal(f.writes.length, count); assert.equal(f.controller.snapshot().thread.length, 0)
  assert.equal(field(f.root, 'Kort note til coachen').value, '')
  assert.equal(find(f.root, 'details').find(n => n.children[0].textContent === 'Del et sæt fra passet').hidden, true)
  f.dispose()
})

test('in-flight taps, coach, disposed and strict OFF cannot perform athlete sends', async () => {
  const f = fixture(); f.rows.push(message('q', 'Har du tid?')); await f.controller.refresh()
  let release; f.faults.pending = new Promise(resolve => { release = resolve })
  const first = f.controller.answerQuestion('message:q', 'Ja')
  assert.equal(await f.controller.answerQuestion('message:q', 'Nej'), false)
  assert.equal(await f.controller.shareSet('set', 'note'), false)
  release(); await first; assert.equal(f.writes.length, 1)
  f.dispose(); assert.equal(await f.controller.shareSet('set', 'note'), false)
  const coach = fixture('coach')
  assert.equal(await coach.controller.shareSet('set', 'note'), false)
  assert.equal(find(coach.root, 'input').some(n => n.attributes['aria-label'] === 'Sæt fra passet'), false)
  assert.deepEqual(coach.writes, []); coach.dispose()
  const poison = new Proxy({}, { get() { assert.fail('OFF access') } })
  for (const enabled of [false, undefined, 0, 'true']) {
    const c = createConversation({ enabled, adapters: poison, storage: poison })
    mountConversation(poison, poison, { enabled })()
    assert.equal(await c.answerQuestion('q', 'Ja'), false)
    assert.equal(await c.shareSet('set', 'note'), false); c.dispose()
  }
})
