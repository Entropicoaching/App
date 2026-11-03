import { createElement as h } from 'react'
import { NOTE_CHOICES, NOTE_TEXT_LIMIT, noteValue, noteText } from './noteModel.mjs'

// Controlled, opt-in component. The caller owns a draft per athlete/plan/set scope.
// onChange(scope, draft, { note }) is an input patch, never a save confirmation.
export default function SetNote({ enabled = false, scope, value, onChange, disabled = false } = {}) {
  if (enabled !== true || typeof scope !== 'string' || !scope.trim()) return null
  const draft = noteValue(value)
  const locked = disabled || typeof onChange !== 'function'
  function change(next) {
    if (locked) return
    const normalized = noteValue(next)
    onChange(scope, normalized, { note: noteText(normalized) })
  }
  const control = { minHeight: 44, padding: '10px 14px', borderRadius: 10,
    border: '1px solid #76766b', font: 'inherit' }
  return h('fieldset', { disabled: locked, 'data-set-note': '',
    style: { border: '1px solid #76766b', borderRadius: 12, padding: 16,
      margin: 0, minWidth: 0, color: '#f5f5ee', background: '#1c1c18' } },
    h('legend', null, 'Note til sættet (valgfri)'),
    h('div', { role: 'group', 'aria-label': 'Hurtigt valg',
      style: { display: 'flex', flexWrap: 'wrap', gap: 8 } },
      ...NOTE_CHOICES.map(choice => h('button', { key: choice, type: 'button', disabled: locked,
        'aria-pressed': draft.choice === choice,
        onClick: () => change({ ...draft, choice: draft.choice === choice ? '' : choice }),
        style: { ...control, color: draft.choice === choice ? '#141410' : '#f5f5ee',
          background: draft.choice === choice ? '#d7e4aa' : '#282821' } }, choice))),
    h('label', { style: { display: 'block', marginTop: 12 } },
      h('span', { style: { display: 'block', marginBottom: 6 } }, 'Din note (højst 140 tegn)'),
      h('textarea', { value: draft.text, maxLength: NOTE_TEXT_LIMIT, rows: 3, disabled: locked,
        onChange: event => change({ ...draft, text: event.target.value }),
        style: { ...control, display: 'block', boxSizing: 'border-box', width: '100%',
          resize: 'vertical', color: '#f5f5ee', background: '#282821' } })),
    h('p', { style: { margin: '6px 0', fontSize: '0.875rem' } }, `${draft.text.length} / ${NOTE_TEXT_LIMIT} tegn`),
    h('p', { style: { margin: '6px 0', lineHeight: 1.5 } },
      'Noten gemmes sammen med sættet, når du godkender det.'))
}
