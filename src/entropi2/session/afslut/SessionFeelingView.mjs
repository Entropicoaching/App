import { createElement as h } from 'react'
import { sessionFeeling, SESSION_NOTE_LIMIT, ENERGY_LEVELS } from './sessionFeelingModel.mjs'

// Unwired controlled view. Caller owns one value per athlete/plan/session scope.
// onChange(scope, draft) and onComplete(scope, value) only deliver local values.
// Caller must clear/replace value on identity change and disable after completion.
export default function SessionFeeling(props = {}) {
  if (props.enabled !== true) return null
  const { scope, value, onChange, onComplete, disabled = false } = props
  if (typeof scope !== 'string' || !scope.trim()) return null
  const draft = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  const result = sessionFeeling(draft)
  const locked = disabled || typeof onChange !== 'function'
  const canComplete = !locked && result.status === 'ready' && typeof onComplete === 'function'
  const change = patch => {
    if (!locked) onChange(scope, {
      rpe: draft.rpe ?? '', energy: draft.energy ?? '', note: draft.note ?? '', ...patch,
    })
  }
  const control = { minHeight: 44, padding: '10px 12px', borderRadius: 10,
    border: '1px solid #89897e', font: 'inherit', color: '#f5f5ee', background: '#282821',
    maxWidth: '100%', boxSizing: 'border-box' }
  const label = { display: 'grid', gap: 6, minWidth: 0 }
  return h('fieldset', { disabled: locked, 'data-e2-session-feeling': '',
    style: { margin: 0, minWidth: 0, padding: 16, borderRadius: 12,
      border: '1px solid #89897e', color: '#f5f5ee', background: '#1c1c18', overflowWrap: 'anywhere' } },
    h('legend', null, 'Hvordan var passet?'),
    h('p', { style: { lineHeight: 1.5 } }, 'Vurder hele passet ud fra din egen oplevelse.'),
    h('div', { style: { display: 'grid', gap: 16 } },
      h('label', { style: label },
        h('span', null, 'Samlet RPE – hvor hårdt var passet?'),
        h('span', null, '0 = ingen anstrengelse · 10 = maksimal anstrengelse'),
        h('select', { value: result.value.rpe ?? '', disabled: locked, style: control,
          onChange: event => change({ rpe: event.target.value }) },
          h('option', { value: '' }, 'Vælg RPE'),
          ...Array.from({ length: 21 }, (_, i) => i / 2).map(rpe => h('option', { key: rpe, value: rpe }, String(rpe).replace('.', ','))))),
      h('label', { style: label },
        h('span', null, 'Energi efter passet'),
        h('select', { value: result.value.energy ?? '', disabled: locked, style: control,
          onChange: event => change({ energy: event.target.value }) },
          h('option', { value: '' }, 'Vælg energi'),
          ...ENERGY_LEVELS.map((text, i) => h('option', { key: i + 1, value: i + 1 }, `${i + 1} – ${text}`)))),
      h('label', { style: label },
        h('span', null, `Note (valgfri, højst ${SESSION_NOTE_LIMIT} tegn)`),
        h('textarea', { value: typeof draft.note === 'string' ? draft.note : '', rows: 3,
          maxLength: SESSION_NOTE_LIMIT, disabled: locked, style: { ...control, width: '100%', resize: 'vertical' },
          onChange: event => change({ note: event.target.value }) }))),
    result.status === 'invalid' ? h('p', { role: 'alert' }, Object.values(result.errors).join(' ')) : null,
    h('p', null, 'Vælg RPE og energi for at gøre vurderingen klar. Noten er valgfri.'),
    h('button', { type: 'button', disabled: !canComplete,
      style: { ...control, color: '#141410', background: '#d7e4aa' },
      onClick: () => { if (canComplete) onComplete(scope, result.value) } }, 'Afslut vurdering'))
}
