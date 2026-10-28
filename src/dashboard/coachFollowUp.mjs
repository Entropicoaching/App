import { createElement as h, useState } from 'react'

export const COACH_FOLLOW_UP_ENABLED = false
export const FOLLOW_UP_NOTE_LIMIT = 160
export const validCoachScope = id => typeof id === 'string' && id.trim().length > 0
export function coachFollowUpFlag(search = '') {
  return new URLSearchParams(search).get('coachFollowUp') === '1'
}
export const followUpKey = coachId => `hara:coach-follow-up:v1:${encodeURIComponent(coachId)}`
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key)
export const isFollowUp = (marks, id) => own(marks, id)

export function sortFollowUps(athletes, marks) {
  return [...athletes.filter(a => isFollowUp(marks, a.id)), ...athletes.filter(a => !isFollowUp(marks, a.id))]
}

function readMarks(storage, coachId) {
  const raw = storage.getItem(followUpKey(coachId))
  if (raw === null) return {}
  const value = JSON.parse(raw)
  if (!value || value.version !== 1 || !Array.isArray(value.marks)) throw Error('Invalid follow-up data')
  const marks = Object.create(null)
  for (const entry of value.marks) {
    if (!entry || typeof entry.id !== 'string' || !entry.id || typeof entry.note !== 'string' || entry.note.length > FOLLOW_UP_NOTE_LIMIT) throw Error('Invalid follow-up entry')
    marks[entry.id] = entry.note
  }
  return marks
}

export function loadFollowUps(storage, coachId) {
  if (!validCoachScope(coachId)) return { marks: {}, error: 'Vælg en coach før opfølgning.' }
  try { return { marks: readMarks(storage, coachId), error: '' } }
  catch { return { marks: {}, error: 'Kunne ikke læse opfølgninger i denne browser. Prøv igen.' } }
}

// Read again before each write so another list instance's marks are preserved.
// Only the local, coach-scoped key is touched. There is no message/backend handler.
export function saveFollowUp({ storage, coachId, athletes, athleteId, note = '', remove = false }) {
  if (!validCoachScope(coachId) || typeof athleteId !== 'string' || !athletes.some(a => a.id === athleteId)) return { error: 'Atleten findes ikke på din liste.' }
  if (typeof note !== 'string' || note.trim().length > FOLLOW_UP_NOTE_LIMIT) return { error: `Noten må højst være ${FOLLOW_UP_NOTE_LIMIT} tegn.` }
  try {
    const marks = readMarks(storage, coachId)
    if (remove) delete marks[athleteId]
    else Object.defineProperty(marks, athleteId, { value: note.trim(), enumerable: true, configurable: true, writable: true })
    storage.setItem(followUpKey(coachId), JSON.stringify({ version: 1, marks: Object.entries(marks).map(([id, value]) => ({ id, note: value })) }))
    return { marks, error: '' }
  } catch { return { error: 'Kunne ikke gemme opfølgningen i denne browser. Prøv igen.' } }
}

function browserStorage() {
  try { return globalThis.localStorage } catch { return undefined }
}

export function CoachFollowUpScope({ coachId, children }) {
  const [state, setState] = useState(() => loadFollowUps(browserStorage(), coachId))
  const followUp = {
    ...state,
    save(athletes, athleteId, note, remove = false) {
      const result = saveFollowUp({ storage: browserStorage(), coachId, athletes, athleteId, note, remove })
      setState(previous => result.error ? { ...previous, error: result.error } : result)
      return !result.error
    },
    retry() { setState(loadFollowUps(browserStorage(), coachId)) },
  }
  return children(followUp)
}

const buttonStyle = { minHeight: 44, padding: '0.4rem 0.65rem', color: '#edeae2', background: '#262620', border: '1px solid #7a7770', borderRadius: 3, cursor: 'pointer' }
export function FollowUpControl({ athlete, followUp, athletes }) {
  const marked = isFollowUp(followUp.marks, athlete.id)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const stop = event => event.stopPropagation()
  const label = `Kort note om ${athlete.name}`
  const controls = []
  if (marked) controls.push(h('p', { key: 'note', style: { margin: 0, overflowWrap: 'anywhere', color: '#edeae2' } }, 'Følg op', followUp.marks[athlete.id] ? `: ${followUp.marks[athlete.id]}` : ''))
  if (followUp.error) controls.push(h('button', { key: 'retry', type: 'button', style: buttonStyle, onClick: followUp.retry }, 'Prøv opfølgning igen'))
  if (editing) {
    controls.push(h('form', {
      key: 'form', style: { display: 'flex', flexWrap: 'wrap', gap: '0.5rem', minWidth: 0 },
      onSubmit: event => {
        event.preventDefault()
        if (followUp.save(athletes, athlete.id, draft)) setEditing(false)
      },
    }, h('label', { style: { minWidth: 0, width: '100%', color: '#edeae2' } }, label,
      h('input', { 'aria-label': label, value: draft, maxLength: FOLLOW_UP_NOTE_LIMIT, style: { boxSizing: 'border-box', width: '100%', minHeight: 44 }, onChange: event => setDraft(event.target.value) })),
    h('button', { type: 'submit', style: buttonStyle }, 'Gem opfølgning'),
    h('button', { type: 'button', style: buttonStyle, onClick: () => setEditing(false) }, 'Annuller')))
  } else controls.push(h('button', {
    key: 'edit', type: 'button', style: buttonStyle, 'aria-label': `${marked ? 'Ret opfølgning for' : 'Følg op på'} ${athlete.name}`,
    onClick: () => { setDraft(marked ? followUp.marks[athlete.id] : ''); setEditing(true) },
  }, marked ? 'Ret note' : 'Følg op'))
  if (marked) controls.push(h('button', { key: 'remove', type: 'button', style: buttonStyle, 'aria-label': `Fjern opfølgning for ${athlete.name}`, onClick: () => {
    if (followUp.save(athletes, athlete.id, '', true)) { setEditing(false); setDraft('') }
  } }, 'Fjern opfølgning'))
  return h('div', { 'data-follow-up-controls': athlete.id, onClick: stop, onKeyDown: stop, style: { display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingBottom: '0.75rem', minWidth: 0 } }, ...controls)
}
