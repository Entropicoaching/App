import { createElement as h } from 'react'
import { goalChoices, goalDisplay, goalFields, goalLabels } from './profileGoalsModel.mjs'
import { profileStyles as s } from './profileStyles.mjs'

export function ProfileGoalsView({ state, onChange, onSave, onReset, onRetry }) {
  const display = goalDisplay(state.values)
  const visibleFields = goalFields.filter(key => state.values[key] != null)
  const locked = state.pending || state.phase === 'loading' || state.phase === 'load-error'
  const id = key => `entropi2-profile-goal-${key}`
  const fieldProps = key => ({ id: id(key), name: key, value: state.draft[key], disabled: locked,
    style: s.input, 'aria-invalid': Boolean(state.errors[key]),
    'aria-describedby': state.errors[key] ? `${id(key)}-error` : undefined,
    onChange: event => { if (!locked) onChange(key, event.target.value) } })
  const field = (key, control) => h('div', { key, style: s.field },
    h('label', { htmlFor: id(key), style: { ...s.label, display: 'block' } },
      key === 'competition_date' ? 'Næste stævnedato' : `${goalLabels[key]}${key.includes('weight') ? ' (kg)' : ''}`),
    control,
    state.errors[key] && h('p', { id: `${id(key)}-error`, style: s.label }, state.errors[key]))
  const legacyGoal = state.draft.goal && !goalChoices.some(([code]) => code === state.draft.goal)
  return h('section', { 'aria-label': 'Mine mål og stævne', style: s.card },
    h('h2', { style: s.heading }, 'Mine mål og stævne'),
    visibleFields.length > 0 && h('dl', { style: s.list }, ...visibleFields.map(key => h('div', { key, style: s.field },
      h('dt', { style: s.label }, goalLabels[key]),
      h('dd', { style: s.value }, display[key], state.localFields.includes(key) && ' · kun på denne enhed')))),
    state.coachGoal && state.coachGoal !== state.values.goal && h('p', { style: s.label }, `Coachens mål: ${state.coachGoal}`),
    h('p', { style: s.label }, 'Alle fire felter gemmes kun på denne enhed. Din coach ser ikke dine ændringer endnu, og de bruges ikke automatisk i kostplan eller prognose.'),
    state.phase === 'loading' && h('p', { role: 'status' }, 'Henter dine mål…'),
    state.message && h('p', { role: ['error', 'load-error'].includes(state.phase) ? 'alert' : 'status' }, state.message),
    state.phase === 'load-error' && h('button', { type: 'button', style: s.button, onClick: onRetry }, 'Prøv igen'),
    h('details', null,
      h('summary', { style: { ...s.button, boxSizing: 'border-box', cursor: 'pointer' } }, 'Rediger mål og stævne'),
      h('form', { 'aria-label': 'Rediger mine mål', 'aria-busy': Boolean(state.pending),
        onSubmit: event => { event.preventDefault(); if (!locked) return onSave() } },
      field('goal', h('select', fieldProps('goal'),
        h('option', { value: '' }, 'Ikke angivet'),
        legacyGoal && h('option', { value: state.draft.goal }, `${state.draft.goal} (nuværende mål)`),
        ...goalChoices.map(([code, label]) => h('option', { key: code, value: code }, label)))),
      field('weight_class', h('input', { ...fieldProps('weight_class'), type: 'text', inputMode: 'decimal', maxLength: 16 })),
      field('competition_date', h('input', { ...fieldProps('competition_date'), type: 'date' })),
      field('target_weight', h('input', { ...fieldProps('target_weight'), type: 'text', inputMode: 'decimal', maxLength: 16 })),
      h('p', { style: s.label }, 'Et tomt felt fjerner målet. Kropsvægtmålet er din ønskede vægt, ikke en vejning.'),
      h('button', { type: 'submit', style: s.button, disabled: locked }, state.phase === 'saving' ? 'Gemmer…' : 'Gem mål'),
      h('button', { type: 'button', style: s.button, disabled: locked,
        onClick: () => { if (!locked) onReset() } }, 'Fortryd ændringer'))))
}
