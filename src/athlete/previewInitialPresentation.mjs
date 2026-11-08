import { createElement as h } from 'react'
import { threadFor, feedbackText, messageText, videoLabel } from '../entropi2/conversation/conversationModel.mjs'

// Pure presentation of supplied scoped rows. No controller, storage or read in SSR.
export function InitialConversation({ initial, snapshot }) {
  const ready = snapshot?.available && snapshot.loaded
  const thread = ready ? snapshot.thread : threadFor(initial?.athleteId,
    Array.isArray(initial?.messages) ? initial.messages : [],
    Array.isArray(initial?.analyses) ? initial.analyses.filter(row => row?.status === 'shared') : [])
  return h('div', { 'data-conversation-initial': '', style: { overflowWrap: 'anywhere' } },
    h('h1', null, 'Samtale'),
    h('p', { role: snapshot?.error ? 'alert' : 'status' }, snapshot?.error || (thread.length
      ? 'Senest hentede beskeder og videoer.'
      : ready || Array.isArray(initial?.messages) ? 'Ingen beskeder i de senest hentede data. Her kan du følge samtalen med din coach.'
        : 'Henter samtalen… Her kan du læse beskeder og videofeedback fra din coach.')),
    thread.length > 0 && h('ol', { role: 'list' }, ...thread.map(item => h('li', { key: item.key },
      h('h2', null, item.kind === 'video' ? videoLabel(item.value) : item.value.sender_role === 'coach' ? 'Coach' : 'Atlet'),
      h('p', { style: { whiteSpace: 'pre-wrap' } }, item.kind === 'video' ? feedbackText(item.value) : messageText(item.value))))))
}
