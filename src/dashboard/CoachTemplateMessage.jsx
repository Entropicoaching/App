import { createElement as h, useState, useRef } from 'react'
import { readCoachTemplates, saveCoachTemplates, fillCoachTemplate } from './coachTemplateMessages.mjs'
const field = { display: 'block', width: '100%', boxSizing: 'border-box', marginBottom: 8 }
const button = { minHeight: 44, margin: '4px 8px 4px 0' }

export default function CoachTemplateMessage(props) {
  const [open, setOpen] = useState(false)
  return h('div', null,
    h('button', { type: 'button', style: button, 'aria-expanded': open, onClick: () => setOpen(!open) }, open ? 'Luk skabelonbesked' : `Skabelonbesked til ${props.athlete.name}`),
    open && h(TemplateEditor, { ...props, key: `${props.coachId}:${props.athlete.id}` }))
}
export function TemplateEditor({ coachId, athlete, sendMessage, storage = () => globalThis.localStorage }) {
  const [library, setLibrary] = useState(() => {
    try { return { rows: readCoachTemplates(storage(), coachId), error: '' } }
    catch { return { rows: [], error: 'Skabelonerne kunne ikke læses. Luk og prøv igen.' } }
  })
  const [name, setName] = useState('')
  const [template, setTemplate] = useState('')
  const [draft, setDraft] = useState(null)
  const [status, setStatus] = useState('')
  const [sending, setSending] = useState(false)
  const lock = useRef(false)
  function save() {
    try {
      const rows = [...library.rows, { name, text: template }]
      saveCoachTemplates(storage(), coachId, rows)
      setLibrary({ rows, error: '' }); setName(''); setTemplate(''); setStatus('Skabelonen er gemt lokalt for denne coach.')
    } catch { setStatus('Skabelonen kunne ikke gemmes. Kontroller navn og tekst, og prøv igen.') }
  }
  async function send() {
    if (lock.current || !draft?.trim()) return
    lock.current = true; setSending(true); setStatus('')
    try {
      const sent = await sendMessage({ coachId, athleteId: athlete.id, text: draft })
      if (sent === true) { setDraft(null); setStatus('Beskeden er sendt.') }
    } catch { setStatus('Beskeden blev ikke sendt. Din tekst er bevaret. Prøv igen.') }
    finally { lock.current = false; setSending(false) }
  }
  return h('section', { 'aria-label': `Skabelonbesked til ${athlete.name}`, style: { padding: 12, border: '1px solid #575044' } },
    h('p', null, `Modtager: ${athlete.name}. Beskeden sendes i sporet Beskeder.`),
    h('p', null, 'Vælg en skabelon, ret kladden og tryk Send. Intet sendes automatisk.'),
    library.error && h('p', { role: 'alert' }, library.error),
    !library.error && !library.rows.length && h('p', null, 'Du har ingen lokale tekstskabeloner endnu.'),
    ...library.rows.map((t, i) => h('button', { type: 'button', key: i, style: button, disabled: sending,
      onClick: () => { setDraft(fillCoachTemplate(t.text, athlete.name)); setStatus('') } }, `Brug ${t.name}`)),
    draft !== null && h('div', null,
      h('label', null, 'Beskedkladde', h('textarea', { 'aria-label': 'Beskedkladde', style: field, rows: 6, maxLength: 10000, value: draft, disabled: sending, onChange: e => setDraft(e.target.value) })),
      h('button', { type: 'button', style: button, disabled: sending || !draft.trim(), onClick: send }, sending ? 'Sender...' : 'Send'),
      h('button', { type: 'button', style: button, disabled: sending, onClick: () => { setDraft(null); setStatus('') } }, 'Kasser kladde')),
    h('details', null, h('summary', null, 'Gem en ny tekstskabelon'),
      h('p', null, 'Gemmes kun i denne browser for din coachkonto. Brug {atlet} til atletens navn.'),
      h('label', null, 'Skabelonnavn', h('input', { 'aria-label': 'Skabelonnavn', style: field, maxLength: 100, value: name, onChange: e => setName(e.target.value) })),
      h('label', null, 'Skabelontekst', h('textarea', { 'aria-label': 'Skabelontekst', style: field, maxLength: 10000, value: template, onChange: e => setTemplate(e.target.value) })),
      h('button', { type: 'button', style: button, disabled: Boolean(library.error) || !name.trim() || !template.trim(), onClick: save }, 'Gem skabelon')),
    status && h('p', { role: 'status' }, status))
}
