import { createElement as h, useRef, useState } from 'react'
import { coachNoteRows } from './coachNotes.mjs'

const field = { width: '100%', boxSizing: 'border-box', padding: '0.7rem', minHeight: 44,
  color: '#edeae2', background: '#141410', border: '1px solid #7a7770', font: 'inherit' }

export default function CoachNotesPage({ athlete, onAddNote }) {
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')
  const busy = useRef(false)
  const rows = coachNoteRows(athlete.notes, query)
  async function add(event) {
    event.preventDefault()
    if (busy.current || !draft.trim() || typeof onAddNote !== 'function') return
    busy.current = true
    setSaving(true)
    setStatus('')
    try {
      if (await onAddNote(draft) === true) {
        setDraft('')
        setStatus('Noten er gemt.')
      } else setStatus('Noten blev ikke gemt. Prøv igen.')
    } catch {
      setStatus('Noten blev ikke gemt. Din tekst er bevaret. Genindlæs profilen og prøv igen.')
    } finally { busy.current = false; setSaving(false) }
  }
  return h('section', { 'aria-label': 'Coachens noter', style: { color: '#edeae2', minWidth: 0 } },
    h('h2', null, 'Coachens noter'),
    h('p', null, 'Nyeste noter først. Tidligere noter uden dato står nederst.'),
    h('label', null, 'Søg i noter', h('input', { type: 'search', value: query, style: field,
      onChange: event => setQuery(event.target.value) })),
    h('div', { role: 'status', 'aria-live': 'polite' }, status),
    rows.length ? h('ol', { style: { paddingLeft: '1.4rem' } }, rows.map(row =>
      h('li', { key: row.id, style: { marginBlock: '1rem', overflowWrap: 'anywhere' } },
        row.date ? h('time', { dateTime: row.date }, new Date(row.date).toLocaleString('da-DK')) : h('strong', null, 'Dato ukendt'),
        h('p', { style: { whiteSpace: 'pre-wrap' } }, row.text))))
      : h('p', null, query.trim() ? 'Ingen noter matcher din søgning.' : 'Ingen noter endnu.'),
    h('form', { onSubmit: add },
      h('label', null, 'Ny note', h('textarea', { value: draft, maxLength: 10000, rows: 5, disabled: saving,
        style: { ...field, resize: 'vertical' }, onChange: event => setDraft(event.target.value) })),
      h('button', { type: 'submit', disabled: saving || !draft.trim() || typeof onAddNote !== 'function',
        style: { ...field, cursor: 'pointer', marginTop: '0.75rem' } }, saving ? 'Gemmer...' : 'Gem note')))
}
