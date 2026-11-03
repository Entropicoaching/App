import { createElement as h, useEffect, useRef, useState } from 'react'
import { sessionNotesModel } from './coachSessionNotes.mjs'
import { loadSessionNotes } from './sessionNotesRead.mjs'

// Med en klient henter vaelgeren selv den valgte atlets logs; et forældet svar
// for en anden atlet eller en tidligere anmodning kasseres (K-R3-ENTROPI-SAMLET fund 2).
export default function CoachSessionNotes({ source, context }) {
  const [chosen, setChosen] = useState(null)
  const [read, setRead] = useState({ athleteId: '', state: 'idle', logs: null })
  const [attempt, setAttempt] = useState(0)
  const token = useRef(0)
  const athleteId = chosen ?? source.selectedAthlete?.id ?? ''
  const client = source.notesClient
  useEffect(() => {
    if (!client || !athleteId) return undefined
    const mine = ++token.current
    setRead({ athleteId, state: 'loading', logs: null })
    loadSessionNotes(client, athleteId).then(result => {
      if (mine === token.current) setRead({ athleteId, state: result.state, logs: result.logs || null })
    })
    return () => { token.current++ }
  }, [client, athleteId, attempt])
  return h(SessionNotesView, { model: notesModel(source, context, athleteId, client ? read : null),
    athletes: context.athletes, onSelect: setChosen, onRetry: () => setAttempt(n => n + 1) })
}

export function notesModel(source, context, athleteId, read) {
  if (!read || !athleteId) return sessionNotesModel(source, context, athleteId)
  const base = sessionNotesModel({ ...source, athleteLogs: [] }, context, athleteId)
  if (base.state === 'select' || base.state === 'unknown' && !base.athlete) return base
  if (read.athleteId !== athleteId || read.state === 'loading' || read.state === 'idle') return { ...base, state: 'loading', entries: [] }
  if (read.state !== 'loaded') return { ...base, state: 'error', entries: [] }
  return sessionNotesModel({ ...source, athleteLogs: read.logs }, context, athleteId)
}

export function SessionNotesView({ model, athletes, onSelect, onRetry }) {
  const markedText = value => h('div', null,
    value.marks.length > 0 && h('strong', { style: { display: 'block' } }, value.marks.join(' · ')),
    value.text && h('p', { style: { whiteSpace: 'pre-wrap', marginBlock: 8 } }, value.text))
  return h('section', { 'aria-label': 'Pasnoter', 'data-coach-session-notes': true,
    style: { marginBlock: 24 } },
    h('h2', null, 'Pasnoter · seneste 7 dage'),
    h('label', null, 'Atlet ', h('select', { value: model.athlete?.id || '',
      style: { minHeight: 48, maxWidth: '100%', font: 'inherit' },
      onChange: event => onSelect(event.target.value) },
      h('option', { value: '' }, 'Vælg atlet'),
      ...athletes.map(a => h('option', { key: a.id, value: a.id }, a.name)))),
    // Marc 3. nov. (keep it simple): ingen teknisk forbeholdstekst over listen.
    model.state === 'loading' && h('p', { role: 'status' }, 'Henter pasnoter …'),
    model.state === 'error' && h('p', { role: 'alert' }, 'Pasnoterne kunne ikke hentes. ',
      onRetry && h('button', { type: 'button', style: { minHeight: 44, font: 'inherit' }, onClick: onRetry }, 'Prøv igen')),
    !['loaded', 'loading', 'error'].includes(model.state) && h('p', { role: 'status' }, model.state === 'select'
      ? 'Vælg en atlet for at se pasnoter.' : 'Pasgrundlaget er ukendt. Detaljerede logs er ikke tilgængelige for valget.'),
    model.state === 'loaded' && model.entries.length === 0 && h('p', { role: 'status' },
      'Ingen noter eller markeringer i de indlæste pas de seneste 7 dage.'),
    model.entries.length > 0 && h('ul', { style: { listStyle: 'none', padding: 0 } },
      ...model.entries.map(entry => h('li', { key: entry.key,
        style: { border: '1px solid #59564c', borderRadius: 12, padding: 16, marginBlock: 12 } },
        h('h3', null, h('time', { dateTime: entry.day }, entry.day), ' · ', entry.title),
        ...entry.comments.map(comment => h('div', { key: comment.text },
          h('span', null, 'Paskommentar'), markedText(comment))),
        ...entry.notes.map(note => h('div', { key: note.key },
          h('span', null, `${note.exercise}${note.set ? ` · Sæt ${note.set}` : ''}`), markedText(note)))))))
}
