import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import AthleteHome from './AthleteHome.mjs'
import { timestampContent } from '../conversation/conversationModel.mjs'

test('real React: Home shows visible timed feedback, escaped text and existing navigation', () => {
  const content = timestampContent({ id: 'synthetic-video', lift: 'squat', created_at: '2026-11-02T08:00:00Z' },
    3.5, 'Hold <brystet> oppe.').replaceAll('\n', '\r\n') + ' \r\n'
  const message = Object.freeze({ sender_role: 'coach', category: 'teknik', content })
  const props = { enabled: true, athlete: { id: 'synthetic-athlete' }, messages: [message],
    now: new Date('2026-11-03T12:00:00Z'), storage: null, setTab() {} }
  const html = renderToStaticMarkup(h(AthleteHome, props))
  assert.match(html, /Fra din coach/)
  assert.match(html, /Squat-video 2\. nov\. ved 3,5 s/)
  assert.match(html, /Hold &lt;brystet&gt; oppe\./)
  assert.match(html, /Se besked og video/)
  assert.doesNotMatch(html, /Video-id:|synthetic-video/)
  assert.equal(message.content, content)
  assert.equal(renderToStaticMarkup(h(AthleteHome, { ...props, enabled: false,
    messages: new Proxy([], { get() { assert.fail('OFF read') } }) })), '')
})
