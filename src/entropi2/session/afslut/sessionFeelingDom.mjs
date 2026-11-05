import { sessionFeeling, SESSION_NOTE_LIMIT, ENERGY_LEVELS, SESSION_FEELING_WRITABLE } from './sessionFeelingModel.mjs'

// Adapter for the existing imperative session renderer, like noter/noteDom.
// The controller owns a scoped in-memory draft. No persistence or completion write.
export function createSessionFeeling(doc, options = {}) {
  if (!SESSION_FEELING_WRITABLE) return null
  const { value = {}, onChange } = options
  const el = (tag, text, attrs = {}) => {
    const node = doc.createElement(tag)
    if (text != null) node.textContent = text
    for (const [key, val] of Object.entries(attrs)) node.setAttribute(key, val)
    return node
  }
  let draft = { ...value }
  const box = el('fieldset', null, { class: 'card', 'data-e2-session-feeling': '' })
  box.append(el('legend', 'Hvordan var passet? (valgfrit)'), el('p',
    'Lokal kladde. Vurderingen kan ikke gemmes sammen med sættene og sendes ikke til din coach.', { class: 'hint' }))
  const fields = el('div', null, { class: 'fields' })
  for (const [name, title, choices] of [
    ['rpe', 'Samlet RPE (0 = ingen anstrengelse, 10 = maksimal)',
      Array.from({ length: 21 }, (_, i) => [i / 2, String(i / 2).replace('.', ',')])],
    ['energy', 'Energi efter passet', ENERGY_LEVELS.map((text, i) => [i + 1, `${i + 1} – ${text}`])],
  ]) {
    const label = el('label', title)
    const select = el('select', null, { 'data-field': `feeling-${name}` })
    select.append(el('option', 'Vælg', { value: '' }))
    for (const [val, text] of choices) select.append(el('option', text, { value: val }))
    select.value = String(draft[name] ?? '')
    select.addEventListener('change', () => change({ ...draft, [name]: select.value }))
    label.append(select); fields.append(label)
  }
  const note = el('textarea', null, { rows: '2', maxlength: SESSION_NOTE_LIMIT, 'data-field': 'feeling-note' })
  note.value = typeof draft.note === 'string' ? draft.note : ''
  note.addEventListener('input', () => change({ ...draft, note: note.value }))
  const folded = el('details', null, { 'data-detail': 'feeling-note' })
  const label = el('label', `Note til passet (valgfri, højst ${SESSION_NOTE_LIMIT} tegn)`)
  label.append(note); folded.append(el('summary', 'Tilføj en note'), label)
  const error = el('p', '', { role: 'alert' }), status = el('p', '', { 'aria-live': 'polite', class: 'hint' })
  function sync() {
    const result = sessionFeeling(draft)
    error.textContent = result.status === 'invalid' ? Object.values(result.errors).join(' ') : ''
    status.textContent = result.status === 'ready' ? 'Kladde udfyldt. Den er ikke gemt.' : 'Du kan springe vurderingen over.'
  }
  function change(next) {
    if (onChange(next) !== true) return
    draft = next; sync()
  }
  box.append(fields, folded, error, status, el('p',
    'Kladden ligger kun i hukommelsen og forsvinder ved genindlæsning, skift af atlet eller ændret program.', { class: 'hint' }))
  sync(); return box
}
