import { createElement as h, useState, useEffect, useMemo, useRef } from 'react'
import { s } from '../dashboardShared.js'
import { createInboxController } from './indbakke2Controller.mjs'
import { markerReplyPreview } from '../videoMarkerReplies.mjs'
const button = { ...s.btnPrimary, minHeight: 44, maxWidth: '100%', whiteSpace: 'normal', overflowWrap: 'anywhere', textAlign: 'left', margin: '4px 8px 4px 0' }
const field = { ...s.fieldInput, display: 'block', width: '100%', boxSizing: 'border-box' }
export function InboxPanel({ controller, state }) {
  const rows = controller.rows()
  const selected = rows.find(row => row.athlete.id === state.selected)
  return h('section', { 'aria-label': 'Indbakke', style: { ...s.page, color: '#edeae2', fontFamily: s.wrap.fontFamily, fontWeight: s.wrap.fontWeight, textAlign: 'left', lineHeight: 1.5, minWidth: 0, overflowWrap: 'anywhere' } },
    h('h1', { style: { ...s.topbarTitle, margin: '0 0 1rem', letterSpacing: 'normal' } }, 'Indbakke'),
    h('button', { style: button, disabled: state.loading || state.busy, onClick: controller.refresh }, 'Opdatér'),
    state.loading && h('p', { role: 'status' }, 'Henter samtaler…'),
    state.error && h('p', { role: 'alert' }, state.error),
    state.status && h('p', { role: 'status' }, state.status),
    !state.loading && !rows.length && h('p', null, 'Ingen atleter i indbakken.'),
    h('nav', { 'aria-label': 'Samtaler' }, ...rows.map(row => h('button', {
      key: row.athlete.id, style: { ...button, ...(state.selected === row.athlete.id ? {} : s.btnGhost), color: state.selected === row.athlete.id ? s.btnPrimary.color : '#edeae2', textAlign: 'left' }, disabled: state.busy,
      'aria-pressed': state.selected === row.athlete.id, onClick: () => controller.select(row.athlete.id),
    }, row.athlete.name, row.unread > 0 ? ` · ${row.unread} ulæste` : ''))),
    selected && h('section', { 'aria-label': `Samtale med ${selected.athlete.name}` },
      h('h2', { style: s.topbarTitle }, selected.athlete.name),
      h('button', { style: button, disabled: state.busy || state.loading || !state.loaded || !selected.unread, onClick: controller.seen }, 'Markér som set'),
      h('ol', null, ...selected.thread.map(item => h('li', { key: item.key, style: { ...s.card, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', marginBottom: 12 } },
        h('p', null, item.kind === 'video' ? 'Videofeedback' : item.value.sender_role === 'coach' ? 'Dig' : selected.athlete.name,
          ' · ', item.at || 'Dato ukendt'),
        item.kind === 'video' ? videoFeedback(h, item.value) : markerReplyPreview(item.value)))),
      h('button', { style: button, disabled: state.busy, onClick: controller.templates }, 'Eksisterende hurtige svar'),
      ...state.templates.map((template, index) => h('button', { key: index, style: button, disabled: state.busy,
        onClick: () => controller.applyTemplate(index) }, template.name)),
      h('label', null, 'Svar', h('textarea', { style: field, rows: 4, maxLength: 10000, disabled: state.busy,
        value: state.drafts[state.selected] || '', onChange: e => controller.draft(e.target.value) })),
      h('button', { style: button, disabled: state.busy || !(state.drafts[state.selected] || '').trim(), onClick: controller.send }, state.busy ? 'Gemmer…' : 'Send')))
}
export function videoFeedback(h, video) {
  const feedback = video.athlete_feedback || {}
  return h('div', null, h('p', null, video.lift || 'Video'),
    ...['works', 'focus', 'next_set'].map(key => h('div', { key },
      h('strong', null, { works: 'Det virker', focus: 'Fokus', next_set: 'Næste sæt' }[key]),
      ...(Array.isArray(feedback[key]) ? feedback[key] : []).filter(item => typeof item?.text === 'string')
        .map((item, index) => h('p', { key: index }, item.text)))))
}
export default function Indbakke2View({ database, coachId, athletes, hiddenAthleteIds, refreshCoachInbox }) {
  const current = useRef(null)
  current.current = { enabled: true, coachId, athletes, hiddenAthleteIds }
  const [, rerender] = useState(0)
  const scopeKey = JSON.stringify([coachId, athletes.map(a => [a.id, a.name, hiddenAthleteIds.has(a.id)])])
  const controller = useMemo(() => createInboxController({ enabled: true, database,
    getScope: () => current.current, notify: () => rerender(n => n + 1), onChanged: refreshCoachInbox }), [database, scopeKey])
  useEffect(() => { controller.activate(); controller.refresh(); return () => controller.dispose() }, [controller])
  return h(InboxPanel, { controller, state: controller.state })
}

// Keep the existing briefing, calendar, signal and video-review panels. Replace only conversations.
export function withInboxConversations(LegacyInbox) {
  return function CombinedInbox(props) {
    return h(LegacyInbox, { ...props, conversationPanel: h(Indbakke2View, props) })
  }
}
