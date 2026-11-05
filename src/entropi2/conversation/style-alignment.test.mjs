import test from 'node:test'
import assert from 'node:assert/strict'
import { install } from '../mobility/mobility-loader.mjs'
import { Node, dom, nodes, button, fakeClock } from '../mobility/synthetic-dom.mjs'

// Extend the pinned text/event DOM only with APIs used by ConversationView.
class ConversationNode extends Node {
  constructor(tag, doc) { super(tag, doc); this.dataset = {}; this.value = '' }
  append(...children) { children.forEach(child => this.appendChild(child)) }
}
function conversationRoot() {
  const doc = { createElement: tag => new ConversationNode(tag, doc) }
  return doc.createElement('root')
}
const hooks = install()
const { mountConversation } = await import('./ConversationView.mjs')
const { mountMobility } = await import('../mobility/mobility-screen.mjs')
test.after(() => hooks.deregister())

function fixture(role = 'coach') {
  const calls = [], root = conversationRoot()
  root.style.textAlign = 'center'
  let update
  const state = { role, draft: 'Hold brystet oppe', busy: false, thread: Array.from({ length: 12 }, (_, i) => ({
    kind: 'message', key: `message:${i}`, at: '2026-11-02T12:00:00Z', unreadAthlete: true,
    value: { id: String(i), sender_role: 'coach', content: `Besked ${i}` },
  })) }
  state.thread.push({ kind: 'video', key: 'video:v1', at: '2026-11-02T12:00:00Z',
    value: { id: 'v1', lift: 'squat', status: 'shared', created_at: '2026-11-02T12:00:00Z' } })
  const controller = {
    subscribe(fn) { update = fn; fn(state); return () => calls.push(['unsubscribe']) },
    templates: () => [{ name: 'Godt pas', text: 'Godt arbejde' }, { name: 'Hvil', text: 'Hvil i dag' }],
    draft: text => calls.push(['draft', text]), send: value => calls.push(['send', value]),
    seen: key => calls.push(['seen', key]), open: key => calls.push(['open', key]),
    upload: () => calls.push(['upload']), refresh: () => calls.push(['refresh']),
    retry: () => calls.push(['retry']), dispose: () => calls.push(['dispose']),
  }
  const dispose = mountConversation(root, controller, { enabled: true })
  return { root, calls, state, update: () => update(state), dispose }
}

test('both conversation roles override centering and keep list semantics without a number gutter', () => {
  for (const role of ['coach', 'athlete']) {
    const f = fixture(role), list = nodes(f.root, 'ol')[0]
    assert.equal(f.root.style.textAlign, 'left')
    assert.equal(list.attributes.role, 'list')
    assert.deepEqual(list.style, { textAlign: 'left', paddingInlineStart: '0', listStyle: 'none' })
    assert.equal(list.children.length, 13)
    for (const li of list.children) {
      assert.equal(li.tagName, 'li')
      assert.equal(li.children[0].style.textAlign, 'left')
    }
    assert.deepEqual(f.calls, [])
    list.children[10].children[0].click()
    assert.deepEqual(f.calls, [['seen', 'message:10']])
    assert.equal(list.children[10].children[1].hidden, false)
    const compose = nodes(f.root, 'section')[0]
    assert.equal(nodes(compose, 'section').length, role === 'coach' ? 2 : 1)
    f.dispose()
    assert.equal(f.root.children.length, 0)
    assert.deepEqual(f.calls.slice(-2), [['unsubscribe'], ['dispose']])
  }
})

test('quick replies and time feedback have wrapping 8px gaps and preserve actions/reset/locking', () => {
  const f = fixture()
  button(f.root, 'Hent hurtige svar').click()
  const quick = nodes(f.root, 'div').find(n => n.children.some(c => c.textContent === 'Godt pas'))
  assert.deepEqual(quick.style, { display: 'flex', flexWrap: 'wrap', gap: '8px' })
  assert.deepEqual(quick.children.map(n => n.textContent), ['Godt pas', 'Hvil'])
  button(f.root, 'Godt pas').click(); button(f.root, 'Hvil').click()
  assert.deepEqual(f.calls, [['draft', 'Godt arbejde'], ['draft', 'Hvil i dag']])
  const group = nodes(f.root, 'div').find(n => n.children.some(c => c.textContent === 'Send tidsfeedback'))
  assert.deepEqual(group.style, { display: 'flex', flexWrap: 'wrap', gap: '8px' })
  assert.deepEqual(group.children.map(n => n.tagName), ['select', 'input', 'button'])
  const [video, seconds, timed] = group.children
  video.value = 'v1'; seconds.value = '3.5'; timed.click()
  assert.deepEqual(f.calls.at(-1), ['send', { analysisId: 'v1', seconds: 3.5 }])
  assert.equal(timed.style.background, '#d8b16b')
  assert.equal(seconds.min, 0); assert.equal(seconds.max, 7199.99)
  f.state.busy = true; f.update()
  const count = f.calls.length; timed.click(); assert.equal(f.calls.length, count)
  f.state.busy = false
  f.state.operation = { status: 'sent', row: { id: 'sent1', category: 'teknik' } }; f.update()
  assert.equal(video.value, ''); assert.equal(seconds.value, '')
  assert.equal(group.style.gap, '8px')
  f.dispose()
})

test('strict OFF keeps children/styles and never reads roots/controllers/athletes', () => {
  const poison = new Proxy({}, { get() { assert.fail('OFF access') } })
  for (const enabled of [undefined, false, 0, 'true']) {
    mountConversation(poison, poison, { enabled })()
    mountMobility(poison, { enabled, athlete: poison })()
    const root = conversationRoot(); root.textContent = 'kept'; root.style.textAlign = 'center'
    mountConversation(root, poison, { enabled })()
    mountMobility(root, { enabled, athlete: poison })()
    assert.equal(root.textContent, 'kept'); assert.equal(root.style.textAlign, 'center')
  }
})

test('mobility alignment persists across home, running, next, skip and return', () => {
  const root = dom(), clock = fakeClock(), calls = []
  root.style.textAlign = 'center'
  const week = { id: 'week', start_date: '2026-10-26', week_number: 1,
    sessions: [{ id: 'session', weekday: 3, exercises: [{ id: 'lift', name: 'Bench press', sets: 2 }] }] }
  const values = new Map()
  const dispose = mountMobility(root, { enabled: true, athlete: { id: 'synthetic' },
    storage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) },
    allWeeks: [week], currentWeek: week, exerciseLogs: [], now: new Date('2026-10-29T12:00:00Z'),
    clock, onProgram: () => calls.push('program') })
  assert.equal(root.style.textAlign, 'left')
  button(root, 'Start mobilitet').click()
  assert.equal(root.style.textAlign, 'left'); assert.match(root.textContent, /1 af 3/)
  button(root, 'Næste øvelse').click()
  assert.equal(root.style.textAlign, 'left'); assert.match(root.textContent, /2 af 3/)
  button(root, 'Næste øvelse').click()
  button(root, 'Afslut mobilitet').click()
  assert.equal(root.style.textAlign, 'left')
  button(root, 'Start mobilitet').click(); button(root, 'Spring over').click()
  assert.equal(root.style.textAlign, 'left')
  button(root, 'Til programmet').click()
  assert.deepEqual(calls, ['program']); assert.equal(clock.count, 0)
  dispose(); assert.equal(root.children.length, 0)
})
