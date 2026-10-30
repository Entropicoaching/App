import { createElement as h, useEffect, useState } from 'react'
import { conversationThread, athleteUnread, acknowledgeInboxReplies } from '../indbakke2.mjs'
import { markerReplyPreview } from '../videoMarkerReplies.mjs'
export default function Indbakke2Tab({ messages, sharedVideoAnalyses, sharedVideoLoading, sharedVideoError,
  renderSharedFeedbackCards, fetchSharedVideoAnalyses, messageInput, setMessageInput, sendAthleteMessage,
  inboxReadEnabled = false, athleteId, inboxDatabase, setMessages, setUnreadMsgCount }) {
  const [readError, setReadError] = useState(false)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let current = true
    setReadError(false)
    acknowledgeInboxReplies({ enabled: inboxReadEnabled, database: inboxDatabase, athleteId, messages,
      isCurrent: () => current }).then(result => {
      if (!current) return
      if (result.error) setReadError(true)
      if (result.messages) {
        setMessages(result.messages)
        setUnreadMsgCount(result.messages.filter(message => message.athlete_id === athleteId
          && message.sender_role === 'coach' && !message.read_at).length)
      }
    })
    return () => { current = false }
  }, [messages, athleteId, inboxReadEnabled, inboxDatabase, setMessages, setUnreadMsgCount, retry])
  const ownMessages = athleteId ? messages.filter(message => message.athlete_id === athleteId) : inboxReadEnabled ? [] : messages
  const ownVideos = athleteId ? sharedVideoAnalyses.filter(video => !video.athlete_id || video.athlete_id === athleteId) : inboxReadEnabled ? [] : sharedVideoAnalyses
  const thread = conversationThread(ownMessages, ownVideos)
  return h('section', { 'aria-label': 'Samtale med din coach', style: { padding: '1rem', color: '#edeae2' } },
    h('h1', null, 'Din coach'),
    readError && h('p', { role: 'alert' }, 'Svaret er vist, men kunne ikke markeres som læst. Prøv igen.'),
    readError && h('button', { style: { minHeight: 44 }, onClick: () => setRetry(value => value + 1) }, 'Prøv igen'),
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
