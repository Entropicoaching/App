import { createElement as h } from 'react'
import { conversationThread, athleteUnread } from '../indbakke2.mjs'
import { markerReplyPreview } from '../videoMarkerReplies.mjs'
export default function Indbakke2Tab({ messages, sharedVideoAnalyses, sharedVideoLoading, sharedVideoError,
  renderSharedFeedbackCards, fetchSharedVideoAnalyses, messageInput, setMessageInput, sendAthleteMessage }) {
  const thread = conversationThread(messages, sharedVideoAnalyses)
  return h('section', { 'aria-label': 'Samtale med din coach', style: { padding: '1rem', color: '#edeae2' } },
    h('h1', null, 'Din coach'),
    h('p', { role: 'status' }, `${thread.filter(athleteUnread).length} ulæste`),
    sharedVideoLoading && h('p', { role: 'status' }, 'Henter videofeedback…'),
    sharedVideoError && h('p', { role: 'alert' }, sharedVideoError),
    h('button', { style: { minHeight: 44 }, onClick: fetchSharedVideoAnalyses }, 'Opdatér videofeedback'),
    h('ol', null, ...thread.map(item => h('li', { key: item.key, style: { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', marginBottom: 12 } },
      h('p', null, item.kind === 'video' ? 'Videofeedback' : item.value.sender_role === 'coach' ? 'Coach' : 'Dig',
        ' · ', item.at || 'Dato ukendt', athleteUnread(item) ? ' · Ulæst' : ''),
      item.kind === 'video' ? renderSharedFeedbackCards([item.value]) : markerReplyPreview(item.value)))),
    h('label', null, 'Besked til din coach', h('textarea', { rows: 4, value: messageInput,
      style: { display: 'block', width: '100%', boxSizing: 'border-box' },
      onChange: e => setMessageInput(e.target.value) })),
    h('button', { style: { minHeight: 44 }, disabled: !messageInput.trim(), onClick: sendAthleteMessage }, 'Send'))
}
