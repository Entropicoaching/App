import { createElement as h, useState } from 'react'
import { sessionNotesModel } from './coachSessionNotes.mjs'

export default function CoachSessionNotes({ source, context }) {
  const [chosen, setChosen] = useState(null)
  const athleteId = chosen ?? source.selectedAthlete?.id ?? ''
  return h(SessionNotesView, { model: sessionNotesModel(source, context, athleteId),
    athletes: context.athletes, onSelect: setChosen })
}

export function SessionNotesView({ model, athletes, onSelect }) {
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
    h('p', null, 'Kun allerede indlæste pasdata. Listen kan være ufuldstændig. Paskommentarer vises ved passets logdato.'),
    model.state !== 'loaded' && h('p', { role: 'status' }, model.state === 'select'
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
