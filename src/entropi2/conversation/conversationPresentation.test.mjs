import test from 'node:test'
import assert from 'node:assert/strict'
import { createConversation } from './conversationController.mjs'
import { mountConversation } from './ConversationView.mjs'
import { fixture, find, row } from './accessibilityFixture.mjs'

// Actual view/controller with a text/event host, not a browser layout engine.
// Long content, acknowledgement and video actions must survive the style change.
for (const role of ['athlete', 'coach']) test(`${role}: wider text and quiet metadata retain explicit opening and video actions`, async () => {
  const f = fixture(), calls = []
  const text = `Syntetisk første linje\n${'LangtOrd'.repeat(40)}\nSidste linje <tekst> 🙂`
  const controller = createConversation({ enabled: true, storage: () => null, adapters: {
    scope: () => ({ role, ownerId: 'synthetic-owner', athleteId: 'synthetic' }),
    load: async () => ({ messages: [{ id: 'long', athlete_id: 'synthetic',
      sender_role: role === 'athlete' ? 'coach' : 'athlete', content: text, created_at: null }],
    analyses: [{ id: 'feedback', athlete_id: 'synthetic', status: 'shared',
      source_mode: 'athlete_submission', created_at: null,
      athlete_feedback: { focus: [{ text }] } }] }),
    seen: async item => {
      calls.push(['seen', item.key])
      return { ...item.value, read_at: 'seen', read_by_coach: true,
        athlete_seen_at: 'seen', conversationCoachSeenAt: 'seen' }
    },
    open: item => calls.push(['open', item.id]),
  } })
  const dispose = mountConversation(f.host, controller, { enabled: true })
  try {
    await controller.refresh()
    const list = find(f.host, 'ol')[0]
    assert.equal(list.attributes.role, 'list', 'marker-free list retains explicit accessibility semantics')
    assert.equal(list.style.listStyle, 'none')
    assert.equal(list.style.paddingInlineStart, '0', 'message text reclaims the old 32px number gutter')
    assert.equal(f.host.style.overflowWrap, 'anywhere', 'long words can wrap without truncation')
    assert.deepEqual(calls, [], 'presentation never acknowledges content')
    const send = find(f.host, 'button').find(n => n.textContent === 'Send')
    assert.equal(send.style.background, '#d8b16b', 'primary action remains visually distinct')
    for (const key of ['message:long', 'video:feedback']) {
      const item = row(f.host, key), [toggle, content, preview] = item.children
      assert.equal(toggle.tagName, 'BUTTON'); assert.equal(toggle.type, 'button')
      assert.equal(toggle.style.minHeight, '44px'); assert.equal(toggle.style.width, '100%')
      assert.equal(toggle.style.background, 'transparent'); assert.equal(toggle.style.border, '0')
      assert.equal(toggle.style.padding, '8px 0', 'metadata does not reintroduce a text gutter')
      assert.equal(toggle.style.whiteSpace, 'normal', 'metadata can wrap at narrow widths')
      assert.equal(toggle.style.outline, undefined, 'native keyboard focus outline is preserved')
      assert.match(toggle.textContent, /^(Coach|Atlet|Video) · Ulæst$/)
      assert.equal(content.hidden, true); assert.equal(preview.hidden, false)
      assert.equal(preview.textContent, Array.from(text).slice(0, 120).join('') + '…')
      toggle.focus(); await toggle.click()
      const current = row(f.host, key)
      assert.equal(current.children[0].attributes['aria-expanded'], 'true')
      assert.equal(current.children[1].hidden, false); assert.equal(current.children[2].hidden, true)
      assert.ok(current.children[1].textContent.startsWith(text), 'complete multiline text survives opening')
      assert.equal(f.doc.activeElement, current.children[0], 'acknowledgement preserves attached focus')
    }
    await find(f.host, 'button').find(n => n.textContent === (role === 'coach' ? 'Åbn videoreview' : 'Åbn videofeedback')).click()
    assert.deepEqual(calls, [['seen', 'message:long'], ['seen', 'video:feedback'], ['open', 'feedback']])
  } finally { dispose() }
})
