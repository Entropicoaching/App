import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { mountConversation } from './ConversationView.mjs'
import { fixture, find, row, deferred } from './accessibilityFixture.mjs'

async function mounted(options) {
  const f = fixture(options), controller = f.createController()
  const dispose = mountConversation(f.host, controller, { enabled: true })
  await controller.refresh()
  return { ...f, controller, dispose }
}

// U2: the list is rebuilt on acknowledgement but stays chronological; the item keeps its place.
for (const kind of ['message', 'video']) test(`F2: ${kind} acknowledgement keeps attached focus on the same key after the list is rebuilt`, async () => {
  const f = await mounted({ kind }), key = `${kind}:one`
  try {
    const old = row(f.host, key).children[0]; old.focus()
    await old.click()
    const current = row(f.host, key)
    assert.notEqual(current.children[0], old)
    assert.ok(f.doc.activeElement === current.children[0], 'focus stays on the current attached toggle')
    assert.equal(f.host.contains(f.doc.activeElement), true)
    assert.equal(current.children[0].attributes['aria-expanded'], 'true')
    assert.equal(current.children[1].hidden, false)
    assert.deepEqual(f.doc.focusOptions, { preventScroll: true })
    assert.deepEqual(f.calls, [key])
    assert.equal(find(f.host, 'li')[0].dataset.key, key)
  } finally { f.dispose() }
})

test('F2: failed acknowledgement retains focus, content and unread state', async () => {
  const f = await mounted({ fail: true })
  try {
    const toggle = row(f.host, 'message:one').children[0]; toggle.focus(); await toggle.click()
    const current = row(f.host, 'message:one')
    assert.ok(f.doc.activeElement === current.children[0], 'focus stays on the current attached toggle')
    assert.equal(current.dataset.unread, 'true'); assert.equal(current.children[1].hidden, false)
    assert.match(find(f.host, 'p').find(n => n.attributes.role === 'alert').textContent, /Synthetic acknowledgement failure/)
  } finally { f.dispose() }
})

test('F2: late acknowledgement does not steal focus from the composer', async () => {
  const gate = deferred(), f = await mounted({ gate })
  try {
    const toggle = row(f.host, 'message:one').children[0]; toggle.focus()
    const pending = toggle.click(), input = find(f.host, 'textarea')[0]
    input.focus(); gate.resolve(); await pending
    assert.ok(f.doc.activeElement === input, 'composer retains focus')
    f.controller.draft('Syntetisk kladde'); assert.ok(f.doc.activeElement === input, 'composer retains focus')
    assert.equal(row(f.host, 'message:one').children[1].hidden, false)
  } finally { gate.resolve(); f.dispose() }
})

test('F2: disposal while acknowledging leaves no detached focus restoration', async () => {
  const gate = deferred(), f = await mounted({ gate })
  const toggle = row(f.host, 'message:one').children[0]; toggle.focus()
  const pending = toggle.click(); f.dispose(); gate.resolve(); await pending
  assert.equal(f.host.children.length, 0); assert.ok(f.doc.activeElement === f.doc.body, 'disposed toggle is no longer focused')
})

test('F7: jump checks the current preference on every click and never acknowledges', async () => {
  const f = await mounted()
  try {
    const jump = find(f.host, 'button').find(n => n.textContent.includes('Spring til første ulæste'))
    for (const reduced of [true, false, true]) {
      f.setReduced(reduced); await jump.click()
      assert.deepEqual(f.doc.scrolled.options, { block: 'start', behavior: reduced ? 'instant' : 'smooth' })
      assert.ok(f.doc.activeElement === f.doc.scrolled.node, 'jump focuses its scroll target')
      assert.deepEqual(f.doc.focusOptions, { preventScroll: true })
    }
    assert.deepEqual(f.queries, Array(3).fill('(prefers-reduced-motion: reduce)'))
    assert.deepEqual(f.calls, [])
    delete f.win.matchMedia; await jump.click()
    assert.equal(f.doc.scrolled.options.behavior, 'smooth')
  } finally { f.dispose() }
})

test('strict OFF does not inspect the document, motion preference or controller', () => {
  const poison = new Proxy({}, { get() { assert.fail('OFF capability read') } })
  for (const enabled of [undefined, false, null, 0, 1, 'true']) mountConversation(poison, poison, { enabled })()
})

test('F7 CSS contract: media-gated athlete scopes override inline animation/transition and smooth CSS scrolling', () => {
  const css = readFileSync(new URL('../entropi2.css', import.meta.url), 'utf8').replaceAll('\r\n', '\n')
  const block = css.match(/@media \(prefers-reduced-motion: reduce\) \{([^{}]+)\{([^{}]+)\}\s*\}/)
  assert.ok(block)
  const selectors = block[1].trim().split(',\n').map(s => s.trim())
  assert.equal(selectors.length, 6)
  for (const selector of selectors) {
    assert.ok(selector.startsWith('[data-entropi2-athlete] :is('))
    assert.ok(selector.includes('section[aria-label="Beskeder og video"]'))
    assert.ok(selector.includes('[data-entropi2-program-motion]'))
  }
  for (const declaration of ['animation: none !important;', 'transition: none !important;', 'scroll-behavior: auto !important;'])
    assert.ok(block[2].includes(declaration), declaration)
})
