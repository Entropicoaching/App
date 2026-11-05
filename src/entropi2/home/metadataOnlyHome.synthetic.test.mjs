import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { mount } from '../../athlete/trainingFullscreenFake.mjs'

// Actual Home and helper imports. This synthetic hook host is not real React.
const loader = registerHooks({ resolve(specifier, context, next) {
  return specifier === 'react'
    ? { shortCircuit: true, url: new URL('../../athlete/trainingFullscreenFake.mjs', import.meta.url).href }
    : next(specifier, context)
} })
test.after(() => loader.deregister())
const { default: Home } = await import('./AthleteHome.mjs')
const feedback = 'Din coach har sendt feedback på din video'
const row = content => Object.freeze({ sender_role: 'coach', category: 'teknik', content })
const props = { enabled: true, athlete: { id: 'synthetic-athlete' },
  now: new Date('2026-11-03T12:00:00Z'), storage: null }
const text = node => typeof node === 'object' ? node.children.map(text).join('') : String(node)
const card = view => view.nodes(n => n.props['aria-label'] === 'Fra din coach')[0]
const show = (t, extra) => { const view = mount(Home, { ...props, ...extra }); t.after(() => view.unmount()); return view }

test('metadata-only coach feedback has human text and existing message navigation, without writes', t => {
  for (const prefix of ['', '\n', '\r\n', ' \t\r\n']) {
    for (const suffix of ['', ' \t\r\n']) {
      const content = `${prefix}Video-id: synthetic-video${suffix}`
      const message = row(content), routes = [], writes = []
      const storage = { getItem: () => null, setItem: (...args) => writes.push(args), removeItem: (...args) => writes.push(args) }
      const messages = Object.freeze([row('Ældre syntetisk besked'), message])
      const view = show(t, { messages, storage, setTab: route => routes.push(route) })
      assert.match(text(card(view)), new RegExp(feedback))
      assert.doesNotMatch(text(card(view)), /Video-id:|synthetic-video|Ældre syntetisk besked/)
      assert.equal(view.nodes(n => n.type === 'details' && text(n).includes('Læs resten')).length, 0)
      const button = card(view).children.find(n => n.type === 'button')
      assert.equal(button.props.disabled, false)
      button.props.onClick()
      assert.deepEqual(routes, ['beskeder'])
      assert.deepEqual(writes, [])
      assert.equal(message.content, content)
    }
  }
})

test('fallback needs hidden valid metadata; ordinary, invalid and non-final text remains literal', t => {
  const content = 'Video-id: synthetic-video'
  for (const message of [
    { ...row(content), category: 'besked' },
    row('Video-id: ugyldigt id'), row('Video-id: synthetic-video\nForklaring'),
    row('En note\nVideo-id: ugyldigt id'), row('video-id: synthetic-video'),
    row('En almindelig coachbesked'),
  ]) {
    const view = show(t, { messages: [message] })
    assert.equal(card(view).children[2].children[0], message.content)
    assert.doesNotMatch(text(card(view)), new RegExp(feedback))
  }
  for (const messages of [null, [], [row(' \r\n')], [{ ...row(content), sender_role: 'athlete' }]])
    assert.equal(card(show(t, { messages })), undefined)
  const latest = show(t, { messages: [row(content), row('Nyeste synlige besked')] })
  assert.match(text(card(latest)), /Nyeste synlige besked/)
  assert.doesNotMatch(text(card(latest)), new RegExp(feedback))
  const disabled = show(t, { messages: [row(content)] })
  assert.equal(card(disabled).children.find(n => n.type === 'button').props.disabled, true)
})

test('OFF never reads metadata messages, storage or athlete', () => {
  const forbidden = () => assert.fail('OFF access')
  const view = mount(Home, { enabled: false, get messages() { return forbidden() },
    get athlete() { return forbidden() }, get storage() { return forbidden() } })
  try { assert.equal(view.tree, null) } finally { view.unmount() }
})
