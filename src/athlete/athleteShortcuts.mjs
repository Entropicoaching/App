// APP-FORENKL3. Extra entry points only. No persistence or data writes.
export const DEFAULT_FORENKLINGER = false

export function contactSummary(messages = [], analyses = []) {
  const entries = [
    ...messages.filter(m => m.sender_role === 'coach').map(m => ({
      date: Date.parse(m.created_at), text: m.content || 'Besked fra din coach',
      track: m.category === 'teknik' ? 'teknik' : 'besked',
    })),
    ...analyses.map(a => ({ date: Date.parse(a.shared_at || a.created_at),
      text: 'Videofeedback fra din coach', track: 'teknik' })),
  ].sort((a, b) => (Number.isFinite(b.date) ? b.date : 0) - (Number.isFinite(a.date) ? a.date : 0))
  return entries[0] || null
}

const buttonStyle = {
  minHeight: 44, minWidth: 0, padding: '0.65rem', font: 'inherit',
  background: 'transparent', color: '#edeae2', border: '1px solid #59564c',
  cursor: 'pointer', overflowWrap: 'anywhere', textAlign: 'left',
}

export function renderAthleteShortcuts(h, {
  enabled = DEFAULT_FORENKLINGER, messages = [], sharedVideoAnalyses = [],
  sharedVideoError, sharedVideoLoading,
  role, athlete, go, setMsgTrack, openReadiness, startVideo, hasWeek, openWeek,
} = {}) {
  if (enabled !== true) return null
  const button = (key, label, action) => h('button', {
    key, type: 'button', style: buttonStyle, onClick: action,
  }, label)
  const contact = track => { setMsgTrack(track); go('beskeder') }
  const last = contactSummary(messages, sharedVideoAnalyses)
  const unreadMessages = track => messages.filter(m => m.sender_role === 'coach' && !m.read_at &&
    (m.category === 'teknik' ? 'teknik' : 'besked') === track).length
  const unreadMessage = unreadMessages('besked')
  const unreadVideo = sharedVideoAnalyses.filter(a => !a.athlete_seen_at).length + unreadMessages('teknik')
  const group = (key, title, ...children) => h('section', { key, 'aria-label': title },
    h('h2', { style: { fontSize: '1rem', fontWeight: 400 } }, title),
    h('div', { style: { display: 'grid', gap: 8 } }, ...children))
  return h('section', { 'aria-label': 'Dine genveje',
    style: { display: 'grid', gap: 12, marginBottom: '1rem' } },
    group('training', 'Træning',
      h('p', null, 'Log sættene og se hele passet i Dagens pas ovenfor.'),
      button('program', 'Mit program', () => go('program'))),
    group('contact', 'Kontakt med din coach',
      last ? button('latest', last.text, () => contact(last.track))
        : !sharedVideoLoading && !sharedVideoError ? h('p', null, 'Ingen beskeder eller videofeedback endnu.') : null,
      sharedVideoLoading ? h('p', { role: 'status' }, 'Henter videofeedback…') : null,
      sharedVideoError ? h('p', { role: 'status' }, sharedVideoError) : null,
      button('message', `Beskeder${unreadMessage > 0 ? ` (${unreadMessage} ulæste)` : ''}`, () => contact('besked')),
      button('technique', `Teknik og videofeedback${unreadVideo > 0 ? ` (${unreadVideo} ulæste)` : ''}`, () => contact('teknik')),
      role === 'athlete' && athlete?.id ? button('film', 'Film et sæt', startVideo) : null),
    group('progress', 'Dagsform og fremgang',
      button('readiness', 'Meld dagsform', openReadiness),
      button('strength', 'Styrke og rekorder', () => go('fremgang')),
      hasWeek ? button('week', 'Ugen som planlagt', openWeek) : null,
      button('volume', 'Volumen og muskelgrupper', () => go('volumen'))))
}

// Reuses the existing week card, including its period selector and data handlers.
export function revealWeek({ setMereOpen, weekStatusRef, requestFrame, reducedMotion }) {
  setMereOpen(true)
  requestFrame(() => requestFrame(() => {
    const card = weekStatusRef.current
    if (!card) return
    card.focus({ preventScroll: true })
    card.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' })
  }))
}
