import { createElement as h, useState } from 'react'
import { FOCUS_LIFTS, FOCUS_NEEDS } from './mobilityFocus.mjs'
import { WARMUP_BASE } from './mobilityCatalog.mjs'
import { coachCatalog, readCoachChoices, saveCoachChoices } from './coachMobility.mjs'
const button = { minHeight: 48, padding: 12, whiteSpace: 'normal', overflowWrap: 'anywhere', font: 'inherit', cursor: 'pointer' }
export function CoachMobilitySummary({ enabled = false, athleteId, notes, library = WARMUP_BASE }) {
  const result = readCoachChoices(enabled, athleteId, notes, library)
  if (enabled !== true || (!result.error && !Object.keys(result.choices).length)) return null
  return h('section', { 'aria-label': 'Valgt af din coach' },
    h('h2', null, 'Valgt af din coach'),
    result.error ? h('p', { role: 'status' }, result.error) : FOCUS_LIFTS.filter(lift => result.choices[lift]).map(lift => {
      const choice = result.choices[lift]
      return h('div', { key: lift }, h('h3', null, `${lift}: ${choice.need}`),
        h('ul', null, ...choice.ids.map(id => h('li', { key: id }, coachCatalog(lift, library).find(ex => ex.id === id).name))))
    }))
}
function Editor({ athlete, coachId, client, onSaved, library }) {
  const initial = readCoachChoices(true, athlete.id, athlete.notes, library)
  const [choices, setChoices] = useState(initial.choices)
  const [message, setMessage] = useState(initial.error || '')
  const [busy, setBusy] = useState(false)
  const [gate] = useState(() => ({ busy: false }))
  const change = (lift, choice) => {
    setChoices(previous => { const next = { ...previous }; if (choice) next[lift] = choice; else delete next[lift]; return next })
    setMessage('Ændringer er ikke gemt.')
  }
  return h('section', { 'aria-label': 'Coachens mobilitetsvalg', style: { marginBottom: 20, overflowWrap: 'anywhere' } },
    h('h2', null, 'Mobilitetsfokus til atleten'),
    h('p', null, 'Vælg fokus og op til tre øvelser pr. hovedløft. Atleten kan stadig vælge selv.'),
    ...FOCUS_LIFTS.map(lift => h('fieldset', { key: lift, disabled: busy || !!initial.error },
      h('legend', null, lift),
      h('label', null, 'Fokus', h('select', { style: button, value: choices[lift]?.need || '', onChange: event => change(lift, event.target.value ? { need: event.target.value, ids: choices[lift]?.ids || [] } : null) },
        h('option', { value: '' }, 'Intet coachvalg'), ...FOCUS_NEEDS[lift].map(need => h('option', { key: need, value: need }, need)))),
      choices[lift] ? coachCatalog(lift, library).map(ex => h('button', { key: ex.id, type: 'button', style: button,
        'aria-pressed': choices[lift].ids.includes(ex.id), disabled: busy || (!choices[lift].ids.includes(ex.id) && choices[lift].ids.length >= 3),
        onClick: () => change(lift, { ...choices[lift], ids: choices[lift].ids.includes(ex.id) ? choices[lift].ids.filter(id => id !== ex.id) : [...choices[lift].ids, ex.id].slice(0, 3) }) }, ex.name)) : null)),
    h('button', { type: 'button', style: button, disabled: busy || !!initial.error, onClick: async () => {
      if (gate.busy || initial.error) return
      gate.busy = true; setBusy(true); setMessage('Gemmer mobilitetsvalg…')
      try {
        const result = await saveCoachChoices({ enabled: true, client, coachId, athlete, choices, library })
        if (!result.error) { onSaved?.(result.athlete); setMessage('Mobilitetsvalg gemt.') }
        else setMessage(result.error)
      } finally { gate.busy = false; setBusy(false) }
    } }, 'Gem mobilitetsvalg'),
    h('p', { role: 'status', 'aria-live': 'polite' }, message))
}
export function CoachMobilityEditor({ enabled = false, athlete, coachId, client, onSaved, library = WARMUP_BASE }) {
  if (enabled !== true || !athlete?.id || athlete.coach_id !== coachId) return null
  return h(Editor, { key: JSON.stringify([coachId, athlete.id, athlete.notes]), athlete, coachId, client, onSaved, library })
}
