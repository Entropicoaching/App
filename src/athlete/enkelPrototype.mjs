// APP-FORENKL2: presentation only. Imported without React or browser side effects.
export const DEFAULT_ENKEL_PROTOTYPE = false
const routes = {
  hjem: ['traening', 'hjem'], traening: ['traening', 'hjem'],
  program: ['program', 'program'], fremgang: ['styrke', 'fremgang'],
  styrke: ['styrke', 'fremgang'], rekorder: ['rekorder', 'fremgang'],
  uge: ['uge', 'hjem'], volumen: ['volumen', 'volumen'],
  beskeder: ['kontakt', 'beskeder'], kontakt: ['kontakt', 'beskeder'],
  mere: ['mere', 'mere'], kost: ['kost', 'kost'],
  mobilisering: ['mobilisering', 'mobilisering'], 'stævnedag': ['stævnedag', 'stævnedag'],
  dagsform: ['dagsform', 'hjem'], alle: ['alle', 'hjem'],
}
export function transition(destination) {
  const pair = routes[destination] || routes.hjem
  return { route: pair[0], tab: pair[1] }
}
export function previewNavigation(enabled, legacySetTab, setRoute) {
  if (enabled !== true) return legacySetTab
  return destination => {
    const next = transition(destination)
    setRoute(next.route)
    legacySetTab(next.tab)
  }
}
export function primaryFor(route) {
  if (['styrke', 'rekorder', 'uge', 'volumen'].includes(route)) return 'fremgang'
  if (route === 'kontakt') return 'kontakt'
  if (['traening', 'dagsform'].includes(route)) return 'traening'
  return 'mere'
}
export function moreItems(athlete, hasMeetPlan, visKost = true) {
  return [ ['program', 'Mit program'], ...(visKost ? [['kost', 'Kost']] : []), ['mobilisering', 'Mobilitet'],
    ...(athlete?.competition_date || hasMeetPlan ? [['stævnedag', 'Stævne']] : []),
    ['alle', 'Alle Hjem-kort'] ]
}
const buttonStyle = { minHeight: 44, minWidth: 0, padding: '0.65rem', border: '1px solid #59564c', background: '#1c1c18', color: '#edeae2', cursor: 'pointer', font: 'inherit' }
function button(h, key, label, onClick, active = false) {
  return h('button', { key, type: 'button', onClick, 'aria-pressed': active,
    style: { ...buttonStyle, color: active ? '#e0ae5c' : '#edeae2' } }, label)
}
export function renderControls(h, { route, go }) {
  const progress = primaryFor(route) === 'fremgang'
  return h('section', { 'aria-label': 'Enkel visning' },
    route === 'traening' ? null : h('h1', null, progress ? 'Fremgang' : route === 'kontakt' ? 'Kontakt' : route === 'dagsform' ? 'Dagsform' : route === 'mere' ? 'Mere' : ''),
    progress ? h('nav', { 'aria-label': 'Fremgang', style: { display: 'flex', flexWrap: 'wrap', gap: 4 } },
      ...[['rekorder', 'Rekorder'], ['styrke', 'Styrke'], ['uge', 'Uge'], ['volumen', 'Volumen']].map(([key, label]) => button(h, key, label, () => go(key), route === key))) : null,
    route === 'dagsform' ? button(h, 'tilbage', 'Tilbage til træning', () => go('hjem')) : null)
}
export function renderMore(h, { athlete, hasMeetPlan, go, visKost = true }) {
  return h('nav', { 'aria-label': 'Flere muligheder', style: { display: 'grid', gap: 8 } },
    ...moreItems(athlete, hasMeetPlan, visKost).map(([key, label]) => button(h, key, label, () => go(key))))
}
export function latestContact(messages = [], analyses = []) {
  const entries = [
    ...messages.filter(m => m.sender_role === 'coach').map(m => ({ date: m.created_at || '', text: m.content || 'Besked fra din coach', track: m.category === 'teknik' ? 'teknik' : 'besked' })),
    ...analyses.map(a => ({ date: a.shared_at || a.created_at || '', text: 'Ny videofeedback fra din coach', track: 'teknik' })),
  ].sort((a, b) => b.date.localeCompare(a.date))
  const last = entries[0]
  return last ? { ...last, text: last.text.length > 140 ? last.text.slice(0, 140) + '…' : last.text } : { text: 'Ingen beskeder eller feedback endnu.', track: 'besked' }
}
export function renderTrainingLinks(h, { messages, sharedVideoAnalyses, go, setMsgTrack }) {
  const last = latestContact(messages, sharedVideoAnalyses)
  return h('section', { 'aria-label': 'Genveje', style: { display: 'grid', gap: 8, marginTop: 12 } },
    button(h, 'program', 'Mit program →', () => go('program')),
    button(h, 'dagsform', 'Dagsform →', () => go('dagsform')),
    button(h, 'kontakt', last.text + ' · Kontakt →', () => { setMsgTrack(last.track); go('beskeder') }))
}
export function renderNav(h, { route, go, unreadMsgCount = 0, sharedVideoAnalyses = [] }) {
  const unread = unreadMsgCount + sharedVideoAnalyses.filter(a => !a.athlete_seen_at).length
  return h('nav', { 'aria-label': 'Hovednavigation', style: { position: 'fixed', bottom: 0, left: 0, right: 0, display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', zIndex: 100, background: '#1c1c18' } },
    ...[['hjem', 'Træning', 'traening'], ['fremgang', 'Fremgang', 'fremgang'], ['beskeder', `Kontakt${unread > 0 ? ' •' : ''}`, 'kontakt'], ['mere', 'Mere', 'mere']].map(([key, label, group]) => button(h, key, label, () => go(key), primaryFor(route) === group)))
}
