import test from 'node:test'
import assert from 'node:assert/strict'
import { install } from './epikLoader.mjs'
import { document, walk, setHost } from './epikDom.mjs'
import * as dom from './epikDom.mjs'
install()
const { lavBeskederOgVaegt } = await import('./beskederOgVaegt.jsx')
const { VideoFeedbackPlayback } = await import('./VideoFeedbackPlayback.jsx')
function nodes(tree, predicate) {
  if (!tree || typeof tree !== 'object') return []
  return [...(predicate(tree) ? [tree] : []), ...(tree.props?.children || []).flatMap(n => nodes(n, predicate))]
}
function text(tree) {
  if (tree == null || typeof tree === 'boolean') return ''
  if (typeof tree !== 'object') return String(tree)
  return (tree.props?.children || []).map(text).join('')
}
const analysis = { id: 'analysis-1', athlete_seen_at: '2026-10-27', lift: 'squat', analyzed_at: '2026-10-27', athlete_feedback: { focus: [{ text: 'Bevar dit fokus' }] } }
function factory(overrides = {}) {
  const calls = []
  const options = { athlete: { id: 'athlete-1' }, sharedVideoAnalyses: [analysis], openSharedVideoId: analysis.id,
    setOpenSharedVideoId: value => calls.push(['open', value]), setMessageInput: fn => calls.push(['draft', fn('')]),
    setMsgTrack: value => calls.push(['track', value]), setTab: value => calls.push(['tab', value]), ...overrides }
  return { ...lavBeskederOgVaegt(options), calls }
}
test('real feedback card OFF keeps existing text, follow-up and open/close handlers', () => {
  delete globalThis.localStorage
  const f = factory(), tree = f.renderSharedFeedbackCards()
  assert.equal(nodes(tree, n => n.type === VideoFeedbackPlayback).length, 0)
  assert.match(text(tree), /Bevar dit fokus/)
  const followup = nodes(tree, n => n.type === 'button' && text(n) === 'Spørg om denne feedback')[0]
  followup.props.onClick()
  assert.equal(f.calls[0][0], 'draft'); assert.match(f.calls[0][1], /spørgsmål til din videofeedback/)
  assert.deepEqual(f.calls.slice(1), [['track', 'teknik'], ['tab', 'beskeder']])
  nodes(tree, n => n.type === 'button')[0].props.onClick()
  assert.deepEqual(f.calls.at(-1), ['open', null])
})
test('real card ON passes exact athlete/analysis scope and only mounts in an open card', () => {
  globalThis.localStorage = { getItem: key => key === 'vc-epik2-playback' ? '1' : null }
  const tree = factory().renderSharedFeedbackCards()
  const players = nodes(tree, n => n.type === VideoFeedbackPlayback)
  assert.equal(players.length, 1)
  assert.equal(players[0].props.athleteId, 'athlete-1')
  assert.equal(players[0].props.analysisId, 'analysis-1')
  assert.equal(players[0].props.key, 'athlete-1:analysis-1')
  assert.equal(nodes(factory({ openSharedVideoId: null }).renderSharedFeedbackCards(), n => n.type === VideoFeedbackPlayback).length, 0)
  delete globalThis.localStorage
})
test('storage denial preserves the real card without a player', () => {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw Error('denied') } })
  const tree = factory().renderSharedFeedbackCards()
  assert.equal(nodes(tree, n => n.type === VideoFeedbackPlayback).length, 0)
  assert.match(text(tree), /Bevar dit fokus/)
  delete globalThis.localStorage
})
test('real React wrapper effect mounts native handlers and returns unmount cleanup', () => {
  const root = document.createElement('section'); setHost(root)
  const element = VideoFeedbackPlayback({ athleteId: 'athlete-1', analysisId: 'analysis-1' })
  assert.equal(element.props.ref.current, root)
  const cleanup = dom.effect()
  assert.equal(walk(root, 'input').length, 2)
  assert.equal(walk(root, 'video').length, 1)
  cleanup(); assert.equal(root.children.length, 0)
})
