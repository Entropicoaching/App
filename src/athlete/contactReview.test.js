import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { contactModules, nodes, text } from './contactHarness.mjs'
import { latestContactFeedback, formatContactDate } from './contactLatest.mjs'
import { setPlayback } from './contactFakes.mjs'
const { Contact, lavBeskederOgVaegt } = await contactModules()
const video = { id: 'synthetic-video', analyzed_at: '2026-10-27T10:00:00Z', athlete_feedback: { works: [{ text: 'Bevar kontrollen' }] } }
const deny = () => { throw Error('Unexpected side effect') }
function fixture() {
  const calls = []
  const p = { athlete: { id: 'synthetic-athlete' }, messageInput: '', messages: [], sharedVideoAnalyses: [video], contactLatest: true,
    msgTrack: 'besked', messagesEndRef: { current: null }, formatMsgTime: String,
    fetchSharedVideoAnalyses: deny, sendAthleteMessage: deny, setOpenSharedVideoId: deny,
    setMessageInput: value => calls.push(['draft', typeof value === 'function' ? value('') : value]),
    setMsgTrack: value => calls.push(['track', value]), setTab: value => calls.push(['tab', value]) }
  p.renderSharedFeedbackCards = lavBeskederOgVaegt(p).renderSharedFeedbackCards
  return { p, calls }
}
test('counter: expanded latest card mounts existing optional playback with exact synthetic scope', () => {
  const { p, calls } = fixture()
  setPlayback(true)
  try {
    const tree = Contact(p)
    const playback = nodes(tree).filter(n => n.type === 'synthetic-playback')
    assert.equal(playback.length, 1)
    assert.equal(playback[0].props.athleteId, p.athlete.id)
    assert.equal(playback[0].props.analysisId, video.id)
    assert.deepEqual(calls, [])
  } finally { setPlayback(false) }
})
test('counter: existing follow-up click only creates draft and navigates, never sends', () => {
  const { p, calls } = fixture()
  const tree = Contact(p)
  assert.deepEqual(calls, [])
  const button = nodes(tree).find(n => n.type === 'button' && text(n) === 'Spørg om denne feedback')
  assert.ok(button)
  button.props.onClick()
  assert.match(calls[0][1], /Jeg har et spørgsmål til din videofeedback/)
  assert.deepEqual(calls.slice(1), [['track', 'teknik'], ['tab', 'beskeder']])
})
test('counter: actual JSX imports execute with both LF and CRLF syntax', async () => {
  const { p } = fixture()
  const { default: CRLF } = await import('./BeskederTab.jsx?crlf')
  const { lavBeskederOgVaegt: CRLFFactory } = await import('./beskederOgVaegt.jsx?crlf')
  const snapshot = tree => JSON.stringify(tree, (k, v) => typeof v === 'function' ? 'handler' : v)
  assert.equal(snapshot(Contact(p)), snapshot(CRLF({ ...p, renderSharedFeedbackCards: CRLFFactory(p).renderSharedFeedbackCards })))
})
test('counter: analysis without text remains a valid shared feedback card, unknown date explicit', () => {
  const a = { id: 'path-only', analyzed_at: 'broken' }
  assert.equal(latestContactFeedback([], [a]).value, a)
  assert.equal(formatContactDate(a.analyzed_at), 'Dato ukendt')
  const { p } = fixture()
  p.sharedVideoAnalyses = [a]
  p.renderSharedFeedbackCards = lavBeskederOgVaegt(p).renderSharedFeedbackCards
  assert.match(text(Contact(p)), /uden en tekstkommentar/)
})
test('counter: all older messages remain below the latest, read badge follows source fields', () => {
  const { p } = fixture()
  p.sharedVideoAnalyses = []
  p.messages = [
    { id: 'one', sender_role: 'coach', content: 'Old', created_at: '2026-10-25' },
    { id: 'two', sender_role: 'coach', content: 'New', created_at: '2026-10-27', read_at: '2026-10-27T12:00:00Z' },
    { id: 'three', sender_role: 'athlete', content: 'Reply', created_at: '2026-10-28' },
  ]
  const result = text(Contact(p))
  assert.ok(result.indexOf('New') < result.indexOf('Old'))
  assert.ok(result.indexOf('New') < result.indexOf('Reply'))
  assert.doesNotMatch(result, /Ulæst/)
})
test('counter: newest pinned message is shown once, older pin and replies remain', () => {
  const { p } = fixture()
  p.sharedVideoAnalyses = []
  p.messages = [
    { id: 'old-pin', sender_role: 'coach', pinned: true, content: 'Older pin', created_at: '2026-10-20' },
    { id: 'new-pin', sender_role: 'coach', pinned: true, content: 'Latest pin', created_at: '2026-10-27' },
  ]
  const result = text(Contact(p))
  assert.equal(result.split('Latest pin').length - 1, 1)
  assert.match(result, /Older pin/)
})
test('counter: unsorted frozen analyses compare instants across offsets', () => {
  const later = Object.freeze({ id: 'later', analyzed_at: '2026-10-27T10:00:00Z' })
  const earlier = Object.freeze({ id: 'earlier', analyzed_at: '2026-10-27T12:30:00+04:00' })
  assert.equal(latestContactFeedback([], Object.freeze([earlier, later])).value, later)
  assert.equal(latestContactFeedback([], Object.freeze([later, earlier])).value, later)
})
test('wiring: final AthleteView invokes imported entry and scroll handlers and passes flag', () => {
  // FS contract complements imported handler tests, without running unrelated app effects.
  const flat = new URL('./AthleteView.jsx', import.meta.url)
  const source = readFileSync(existsSync(flat) ? flat : new URL('../AthleteView.jsx', import.meta.url), 'utf8')
  assert.match(source, /import \{ contactLatestEnabled, enterContact, scrollContactEnd \} from '\.\/athlete\/contactLatest\.mjs'/)
  // E2-ATLET-LAEST1: med Entropi 2 tændt kvitterer samtalen selv; ellers den gamle markTrackRead.
  assert.match(source, /enterContact\(\{ enabled: contactLatest, fetchMessages: fetchAthleteMessages, markRead: e2SelvKvittering \? \(\) => \{\} : markTrackRead, fetchVideos: fetchSharedVideoAnalyses, track: msgTrack \}\)/)
  assert.match(source, /scrollContactEnd\(contactLatest, messagesEndRef\)/)
  assert.match(source, /sharedVideoAnalyses, sharedVideoError, sharedVideoLoading, contactLatest,/)
})
