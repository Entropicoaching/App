import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import Home from './AthleteHome.mjs'

// Real React, no loader or package replacement; discovered by npm test.
const props = { enabled: true, athlete: { id: 'synthetic-athlete' }, storage: null,
  now: new Date('2026-11-03T12:00:00Z'), setTab() {} }
const render = extra => renderToStaticMarkup(h(Home, { ...props, ...extra }))
const card = html => html.match(/<section[^>]*aria-label="Fra din coach"[^>]*>([\s\S]*?)<\/section>/)?.[1]

test('real React: metadata-only coach feedback is readable, retains navigation and hides IDs', () => {
  for (const prefix of ['', '\n', '\r\n', ' \t\r\n']) {
    for (const suffix of ['', ' \t\r\n']) {
      const content = `${prefix}Video-id: synthetic-video${suffix}`
      const message = Object.freeze({ sender_role: 'coach', category: 'teknik', content })
      const html = render({ messages: Object.freeze([message]) })
      assert.match(card(html), /Din coach har sendt feedback på din video/)
      assert.match(card(html), /<button[^>]*>Se besked og video<\/button>/)
      assert.doesNotMatch(card(html), /Læs resten|<details/)
      assert.doesNotMatch(html, /Video-id:|synthetic-video/)
      assert.equal(message.content, content)
    }
  }
})

test('real React: empty messages stay quiet and ordinary coach text stays escaped', () => {
  for (const messages of [null, [], [{ sender_role: 'coach', content: ' \r\n' }]])
    assert.equal(card(render({ messages })), undefined)
  const html = render({ messages: [{ sender_role: 'coach', category: 'teknik',
    content: 'Hold <brystet> oppe.\nVideo-id: synthetic-video' }] })
  assert.match(card(html), /Hold &lt;brystet&gt; oppe\./)
  assert.doesNotMatch(html, /Din coach har sendt feedback|Video-id:|synthetic-video/)
  const poison = new Proxy({}, { get() { assert.fail('OFF access') } })
  assert.equal(render({ enabled: false, messages: poison, storage: poison, athlete: poison }), '')
})
