import { createElement as h, useState } from 'react'
import { rel1030Enabled } from './rel1030.mjs'
import { rel1101Enabled } from './rel1101.mjs'
import { nytIAppenText as copy } from './nytIAppenText.mjs'

const version = 'rel1030-2026-10-30'
export function nytStorageKey(role, profileId) {
  if (!['athlete', 'coach'].includes(role) || typeof profileId !== 'string' || !profileId) return null
  return `entropi:nyt:${JSON.stringify([version, role, profileId])}`
}
function browserStorage() {
  try { return globalThis.localStorage } catch { return null }
}
function isClosed(storage, key) {
  try { return storage?.getItem(key) === 'closed' } catch { return false }
}

// Only existing navigation setters/handlers are called. No data operations.
export function nytAthleteNavigation({ setTab, setMsgTrack, setMobilityMode }) {
  return id => {
    if (id === 'mobilitet') { setMobilityMode('fokus'); setTab('mobilisering') }
    if (id === 'tidsmarkeringer') { setMsgTrack('teknik'); setTab('beskeder') }
    if (id === 'fremgang') setTab('fremgang')
  }
}
export function nytCoachNavigation({ setView, setSelectedAthlete, openProfile }) {
  return (id, athlete) => {
    if (id === 'oprydning') { setSelectedAthlete(null); setView('inbox') }
    if (athlete && ['analyse', 'tidsmarkeringer', 'fremgang'].includes(id)) {
      openProfile(athlete, id === 'fremgang' ? 'oversigt' : 'analyse')
    }
  }
}

const buttonStyle = { minHeight: 44, maxWidth: '100%', whiteSpace: 'normal',
  overflowWrap: 'anywhere', textAlign: 'left', font: 'inherit', cursor: 'pointer',
  padding: '0.65rem', background: '#24241e', color: '#edeae2', border: '1px solid #777365' }

function NytCard({ role, storageKey, storage, onNavigate, athletes = [] }) {
  const [closed, setClosed] = useState(() => isClosed(storage, storageKey))
  const [pending, setPending] = useState(null)
  if (closed) return null
  const button = (key, label, onClick) => h('button', { key, type: 'button', style: buttonStyle, onClick }, label)
  function visit(id) {
    if (role === 'coach' && id !== 'oprydning') setPending(id)
    else { setPending(null); onNavigate(id) }
  }
  return h('section', { 'aria-label': copy.title, 'data-nyt-i-appen': version,
    style: { minWidth: 0, margin: '1rem', padding: '1rem', border: '1px solid #777365', color: '#edeae2', background: '#1c1c18' } },
    h('h2', null, copy.title), h('p', null, copy.source),
    h('ul', { style: { paddingLeft: '1.25rem' } },
      ...copy.items.filter(item => item.roles.includes(role)).map(item => h('li', { key: item.id },
        button(item.id, item.label, () => visit(item.id))))),
    pending && h('div', { role: 'group', 'aria-label': copy.choose },
      h('p', { role: 'status' }, copy.choose),
      ...athletes.map(athlete => button(athlete.id, athlete.name, () => {
        setPending(null); onNavigate(pending, athlete)
      })),
      athletes.length === 0 && h('p', { role: 'status' }, copy.empty)),
    button('close', copy.close, () => {
      setClosed(true)
      try { storage?.setItem(storageKey, 'closed') } catch { /* Closed for this mount. */ }
    }))
}

// Same identity/version key and failure-safe dismissal as the existing card.
function NytLine({ storageKey, storage }) {
  const [closed, setClosed] = useState(() => isClosed(storage, storageKey))
  if (closed) return null
  const summary = `${copy.title} · Mobilitet, tidsmarkeringer og fremgang`
  return h('section', { 'aria-label': copy.title, 'data-nyt-i-appen': version,
    style: { display: 'flex', alignItems: 'center', minWidth: 0, gap: 8,
      margin: '1rem', color: '#edeae2' } },
    h('span', { title: summary, style: { flex: 1, minWidth: 0,
      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, summary),
    h('button', { type: 'button', 'aria-label': copy.close,
      style: { ...buttonStyle, flexShrink: 0, minWidth: 44 }, onClick: () => {
        setClosed(true)
        try { storage?.setItem(storageKey, 'closed') } catch { /* Closed for this mount. */ }
      } }, 'Luk'))
}

export default function NytIAppen({ rel1101 = false, search = '', role, profileId, storage, ...props }) {
  // OFF does not read storage or create card state. Identity changes remount it.
  const compact = role === 'athlete' && rel1101Enabled(rel1101, search)
  if (!compact && !rel1030Enabled(search)) return null
  const key = nytStorageKey(role, profileId)
  if (!key) return null
  return h(compact ? NytLine : NytCard, { ...props, role, storageKey: key,
    storage: storage === undefined ? browserStorage() : storage, key })
}
