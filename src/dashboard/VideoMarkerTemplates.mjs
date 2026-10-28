import { createElement as h, useState } from 'react'
import { markerCopy, readMarkerTemplates, saveMarkerTemplate, deleteMarkerTemplate,
  readMarkerNotes, saveMarkerNote } from './vcMarkerTemplates.mjs'

const buttonStyle = { minHeight: 44, maxWidth: '100%', whiteSpace: 'normal', overflowWrap: 'anywhere' }
// The caller gates this component with the existing playback flag and exact review scope.
export default function VideoMarkerTemplates({ coachId, athleteId, analysisId, updating = false,
  storage = () => globalThis.localStorage }) {
  const [open, setOpen] = useState(false)
  return h('section', { 'aria-label': 'Lokale tidsmarkeringer' },
    h('button', { type: 'button', style: buttonStyle, disabled: updating, 'aria-expanded': open,
      onClick: () => { if (!updating) setOpen(!open) } }, open ? 'Luk markeringsskabeloner' : 'Åbn markeringsskabeloner'),
    open && h(MarkerEditor, { key: JSON.stringify([coachId, athleteId, analysisId]),
      scope: { coachId, athleteId, analysisId }, updating, storage }))
}
export function MarkerEditor({ scope, updating, storage }) {
  const [draft, setDraft] = useState({ start: '', end: '', text: '', duration: '' })
  const [library, setLibrary] = useState(() => {
    try { return { rows: readMarkerTemplates(storage(), scope.coachId), error: '' } }
    catch { return { rows: [], error: 'Skabelonerne kunne ikke læses. Luk og prøv igen.' } }
  })
  const [message, setMessage] = useState('')
  const run = fn => {
    if (updating) return
    try { fn() } catch (error) { setMessage(`Ikke gemt: ${error.message || 'Lokal lagring er ikke tilgængelig.'}`) }
  }
  const marker = () => {
    if (!draft.start.trim() || !draft.end.trim()) throw Error('Angiv start og slut i sekunder.')
    return markerCopy({ start: Number(draft.start), end: Number(draft.end), text: draft.text })
  }
  const input = (key, label, type = 'text') => h('label', { style: { display: 'grid', gap: 4 } }, label,
    h(key === 'text' ? 'textarea' : 'input', { 'aria-label': label, type, value: draft[key],
      maxLength: key === 'text' ? 2000 : 30, min: 0, max: 7200, step: 'any', disabled: updating,
      style: { width: '100%', boxSizing: 'border-box', minHeight: 44 },
      onChange: event => { if (!updating) { setDraft({ ...draft, [key]: event.target.value }); setMessage('Kladde ændret. Ikke gemt.') } } }))
  const button = (label, fn, disabled = false) => h('button', { type: 'button', style: buttonStyle,
    disabled: updating || disabled, onClick: () => run(fn) }, label)
  return h('div', { style: { display: 'grid', gap: 8, overflowWrap: 'anywhere' } },
    h('p', null, 'Lokale tekstnoter med tider i sekunder. Angiv varigheden fra det nye klip. Skabelonen kopierer tekst og tider til kladden. Gennemgå dem før gemning. Intet deles automatisk.'),
    input('duration', 'Klippets varighed i sekunder', 'number'),
    input('start', 'Start i sekunder', 'number'), input('end', 'Slut i sekunder', 'number'),
    input('text', 'Tekst til markeringen'),
    button('Gem markering lokalt', () => {
      const rows = saveMarkerNote(storage(), scope, marker(), Number(draft.duration))
      setMessage(`Markering gemt lokalt for denne video. ${rows.length} i alt. Ikke delt.`)
    }),
    button('Gem som markeringsskabelon', () => {
      if (library.error) throw Error(library.error)
      const rows = saveMarkerTemplate(storage(), scope.coachId, marker())
      setLibrary({ rows, error: '' }); setMessage('Skabelon gemt lokalt for denne coachkonto.')
    }, Boolean(library.error)),
    library.error && h('p', { role: 'alert' }, library.error),
    !library.error && !library.rows.length && h('p', null, 'Ingen markeringsskabeloner endnu.'),
    ...library.rows.map(row => h('div', { key: JSON.stringify(row) },
      h('p', null, `${row.start} til ${row.end} s: ${row.text}`),
      button(`Brug: ${row.text}`, () => {
        const copy = markerCopy(row)
        setDraft({ ...draft, start: String(copy.start), end: String(copy.end), text: copy.text })
        setMessage('Skabelon indsat i kladden. Gennemgå tider og tekst. Ikke gemt.')
      }),
      button(`Slet skabelon: ${row.text}`, () => {
        const rows = deleteMarkerTemplate(storage(), scope.coachId, row)
        setLibrary({ rows, error: '' }); setMessage('Skabelon slettet lokalt. Kladden er bevaret.')
      }))),
    button('Vis antal gemte markeringer', () => {
      const rows = readMarkerNotes(storage(), scope)
      setMessage(`${rows.length} lokale markeringer for denne video. Ikke delt.`)
    }),
    h('p', { role: 'status', 'aria-live': 'polite' }, message))
}
