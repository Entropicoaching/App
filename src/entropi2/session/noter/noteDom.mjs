import { NOTE_CHOICES, NOTE_TEXT_LIMIT, noteValue } from './noteModel.mjs'

// DOM adapter for the session renderer; the controller owns the scoped draft.
export function createSetNote(doc, { value, disabled, onChange }) {
  const el = (tag, text, attrs = {}) => {
    const node = doc.createElement(tag)
    if (text != null) node.textContent = text
    for (const [key, val] of Object.entries(attrs)) node.setAttribute(key, val)
    return node
  }
  let draft = noteValue(value)
  const fieldset = el('fieldset', null, { 'data-set-note': '' })
  fieldset.disabled = disabled
  const row = el('div', null, { class: 'note-choices', role: 'group', 'aria-label': 'Hurtigt valg' })
  const text = el('textarea', null, { rows: '3', maxlength: NOTE_TEXT_LIMIT, 'data-field': 'note-text' })
  text.value = draft.text; text.disabled = disabled
  const count = el('p', '', { class: 'hint' })
  const buttons = NOTE_CHOICES.map(choice => {
    const b = el('button', choice, { type: 'button' }); b.disabled = disabled
    b.addEventListener('click', () => change({ ...draft, choice: draft.choice === choice ? '' : choice }))
    row.append(b); return b
  })
  function sync() {
    buttons.forEach((b, i) => b.setAttribute('aria-pressed', String(draft.choice === NOTE_CHOICES[i])))
    text.value = draft.text; count.textContent = `${draft.text.length} / ${NOTE_TEXT_LIMIT} tegn`
  }
  function change(next) {
    if (disabled) return
    const normalized = noteValue(next)
    if (onChange(normalized) !== true) return
    draft = normalized; sync()
  }
  text.addEventListener('input', () => change({ ...draft, text: text.value }))
  const label = el('label', 'Din note (højst 140 tegn)'); label.append(text)
  fieldset.append(el('legend', 'Note til sættet (valgfri)'), row, label, count,
    el('p', 'Noten gemmes sammen med sættet, når du godkender det.', { class: 'hint' }))
  sync(); return fieldset
}
