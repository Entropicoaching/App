import { createElement as h, useState } from 'react'
import { readCoachTemplates, fillCoachTemplate } from './coachTemplateMessages.mjs'

export const DEFAULT_VIDEO_REVIEW_TEMPLATES = false
const button = { minHeight: 44, margin: '4px 8px 4px 0' }

// Reading the existing coach library is deferred until an explicit open action.
// This component has no save, send, network or storage-write capability.
export default function VideoReviewTemplates(props) {
  const [open, setOpen] = useState(false)
  return h('div', null,
    h('button', { type: 'button', style: button, disabled: props.updating,
      'aria-expanded': open, onClick: () => { if (!props.updating) setOpen(!open) } },
    open ? 'Luk konklusionsskabeloner' : 'Vælg konklusionsskabelon'),
    open && h(ReviewTemplatePicker, props))
}

export function ReviewTemplatePicker({ coachId, athleteName, focus, updating, onApply,
  storage = () => globalThis.localStorage }) {
  const [library] = useState(() => {
    try { return { rows: readCoachTemplates(storage(), coachId) } }
    catch { return { rows: [], error: 'Tekstskabelonerne kunne ikke læses. Luk og prøv igen.' } }
  })
  const [selected, setSelected] = useState(null)
  const chosen = selected === null ? null : library.rows[selected]
  const text = chosen ? fillCoachTemplate(chosen.text, athleteName || '') : ''
  const usable = text.trim().length > 0 && text.length <= 600
  return h('section', { 'aria-label': 'Konklusionsskabeloner' },
    h('p', null, 'Vælg en af dine tekstskabeloner til Atletens fokus. Ret kladden før deling. Intet gemmes eller deles automatisk.'),
    library.error && h('p', { role: 'alert' }, library.error),
    !library.error && !library.rows.length && h('p', null, 'Du har ingen lokale tekstskabeloner for denne coachkonto.'),
    ...library.rows.map((row, index) => h('button', { type: 'button', key: index,
      style: button, disabled: updating, 'aria-pressed': selected === index,
      onClick: () => { if (!updating) setSelected(index) } }, row.name)),
    chosen && h('div', null,
      h('p', { style: { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' } }, text),
      !usable && h('p', { role: 'alert' }, 'Vælg en kortere skabelon. Fokus må højst være 600 tegn, også efter atletens navn er indsat.'),
      h('button', { type: 'button', style: button, disabled: updating || !usable,
        onClick: () => { if (!updating && usable) onApply(text) } },
      focus ? 'Erstat fokus med skabelonen' : 'Indsæt i Atletens fokus')))
}
