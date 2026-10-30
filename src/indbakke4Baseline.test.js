import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import * as inbox from './indbakke2.mjs'
import * as dom from './indbakke2Dom.mjs'
const view = new URL('./athlete/Indbakke2Tab.mjs', import.meta.url).href
registerHooks({ resolve(specifier, context, next) {
  if (context.parentURL === view && specifier === 'react')
    return { url: new URL('./indbakke2Dom.mjs', import.meta.url).href, shortCircuit: true }
  return next(specifier, context)
} })
const { default: Tab } = await import('./athlete/Indbakke2Tab.mjs')
const coach = { id: 'reply', athlete_id: 'a', sender_role: 'coach', content: '<script>Hej atlet</script>',
  category: 'besked', read_at: null, created_at: '2026-10-30T12:00:00Z' }
const props = () => ({ messages: [coach], sharedVideoAnalyses: [], messageInput: '',
  renderSharedFeedbackCards: () => null, fetchSharedVideoAnalyses() {}, setMessageInput() {}, sendAthleteMessage() {} })
test('baseline: default OFF and exact query opt-ins', () => {
  assert.equal(inbox.DEFAULT_INDBAKKE2, false)
  for (const query of ['', '?indbakke2=0', '?indbakke2=true', '?indbakke2=1&indbakke2=1'])
    assert.equal(inbox.indbakke2Enabled(query), false)
  assert.equal(inbox.indbakke2Enabled('?indbakke2=1'), true)
  assert.equal(inbox.indbakke2Enabled('?rel1030=1'), true)
})
test('baseline: actual athlete view displays coach reply and unread status as text', () => {
  dom.reset(); const tree = dom.render(Tab, props())
  assert.match(dom.text(tree), /Coach.*Ulæst/)
  assert.match(dom.text(tree), /<script>Hej atlet<\/script>/)
  assert.equal(dom.nodes(tree).some(n => n.type === 'script' || n.props.dangerouslySetInnerHTML), false)
  dom.reset()
})
test('baseline: already read reply is not unread', () => {
  assert.equal(inbox.athleteUnread(inbox.conversationThread([{ ...coach, read_at: 'seen' }])[0]), false)
})
test('baseline: existing send and edit handlers remain connected', () => {
  dom.reset(); let edited, sent = 0
  const p = { ...props(), messageInput: 'Svar', setMessageInput: value => { edited = value }, sendAthleteMessage: () => sent++ }
  const tree = dom.render(Tab, p)
  dom.nodes(tree).find(n => n.type === 'textarea').props.onChange({ target: { value: 'Nyt svar' } })
  dom.nodes(tree).find(n => n.type === 'button' && dom.text(n) === 'Send').props.onClick()
  assert.equal(edited, 'Nyt svar'); assert.equal(sent, 1); dom.reset()
})
test('baseline: chronological conversation retains videos and both message tracks', () => {
  const list = inbox.conversationThread([coach, { ...coach, id: 'old', category: 'teknik', created_at: '2026-10-29' }],
    [{ id: 'video', analyzed_at: '2026-10-30T11:00:00Z' }])
  assert.deepEqual(list.map(item => item.key), ['message:old', 'video:video', 'message:reply'])
})
