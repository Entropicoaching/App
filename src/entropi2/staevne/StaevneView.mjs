import { createElement as h, useId } from 'react'
import { LIFTS, STRATEGIES, planLift, validateResult } from './meetModel.mjs'

const kgText = value => String(value).replace('.', ',')
const fieldStyle = { minHeight: 44, maxWidth: '100%', boxSizing: 'border-box' }

// Separate enabled component keeps hooks unconditional and OFF data unread.
export default function StaevneView(props = {}) {
  return props.enabled === true ? h(EnabledStaevne, props) : null
}

export function EnabledStaevne({ lifts = {}, strategy = 'normal', referenceDate, results = {}, onResultChange, onStrategyChange, error }) {
  const prefix = useId()
  if (error) return h('section', { 'aria-label': 'Stævnedag' }, h('h2', null, 'Stævnedag'), h('p', { role: 'alert' }, 'Stævnedata kunne ikke indlæses. Prøv igen.'))
  const editable = typeof onResultChange === 'function'
  const formError = lifts === null || typeof lifts !== 'object' || Array.isArray(lifts)
  return h('section', { 'aria-label': 'Stævnedag', style: { maxWidth: '40rem', marginInline: 'auto', padding: '1rem', overflowWrap: 'anywhere' } },
    h('h2', null, 'Stævnedag'),
    h('p', null, 'Forslag til aftale med din coach. Alle vægte afrundes ned til 2,5 kg. Tilpas opvarmning til udstyr og tidsplan.'),
    h('label', { htmlFor: `${prefix}-strategy` }, 'Forsøgsstrategi'),
    h('select', { id: `${prefix}-strategy`, value: strategy, style: fieldStyle, disabled: typeof onStrategyChange !== 'function', onChange: event => onStrategyChange?.(event.target.value) },
      ...Object.entries(STRATEGIES).map(([value, label]) => h('option', { key: value, value }, label))),
    !editable && h('p', null, 'Resultater vises kun. Registrering kræver en tilsluttet resultatfunktion.'),
    formError ? h('p', { role: 'alert' }, 'Løftenes data har forkert format.') : Object.entries(LIFTS).map(([lift, label]) => {
      const plan = planLift(lifts[lift], strategy, referenceDate)
      return h('section', { key: lift, 'aria-label': label, style: { marginBlock: '1.5rem' } },
        h('h3', null, label),
        plan.status !== 'ready' ? h('p', { role: plan.status === 'error' ? 'alert' : 'status' }, plan.message) : [
          h('p', { key: 'attempts' }, `Forslag: åbner ${kgText(plan.attempts[0])} kg · andet ${kgText(plan.attempts[1])} kg · tredje ${kgText(plan.attempts[2])} kg`),
          h('details', { key: 'warmup' }, h('summary', { style: { minHeight: 44 } }, 'Opvarmning og grundlag'),
            h('p', null, `${plan.basis} Reference: ${kgText(Math.round(plan.reference * 10) / 10)} kg. ${plan.recentCount} af de seneste singler (højst 3, inden for 42 dage).`),
            h('p', null, plan.openerTime ? `Åbner kl. ${plan.openerTime}.` : 'Åbnertid mangler; tider vises relativt til åbneren.'),
            plan.warmup.length ? h('ol', null, ...plan.warmup.map(set => h('li', { key: set.minutesBefore }, `${kgText(set.kg)} kg × ${set.reps} · ${set.minutesBefore} min før åbner${set.time ? ` · kl. ${set.time}${set.previousDay ? ' (dagen før)' : ''}` : ''}`))) : h('p', null, 'Ingen lettere opvarmningsvægt i 2,5 kg-trin. Tilpas med coachen.')),
        ],
        ...[0, 1, 2].map(attempt => {
          const raw = results?.[lift]?.[attempt]
          const result = validateResult(raw)
          const id = `${prefix}-${lift}-${attempt}`
          const update = (field, value) => onResultChange?.({ lift, attempt: attempt + 1, field, value })
          return h('fieldset', { key: attempt, style: { minWidth: 0, marginBlock: '0.75rem' } },
            h('legend', null, `${label} – forsøg ${attempt + 1}`),
            h('label', { htmlFor: `${id}-kg` }, 'Faktisk vægt (kg)'),
            h('input', { id: `${id}-kg`, type: 'text', inputMode: 'decimal', value: typeof raw?.kg === 'string' || typeof raw?.kg === 'number' ? raw.kg : '', style: { ...fieldStyle, width: '100%' }, readOnly: !editable,
              'aria-invalid': result.status === 'error' || undefined, 'aria-describedby': result.status === 'error' ? `${id}-error` : undefined, onChange: event => update('kg', event.target.value) }),
            h('label', { htmlFor: `${id}-status` }, 'Afgørelse'),
            h('select', { id: `${id}-status`, value: ['pending', 'good', 'miss'].includes(raw?.status) ? raw.status : 'pending', style: { ...fieldStyle, width: '100%' }, disabled: !editable, onChange: event => update('status', event.target.value) },
              h('option', { value: 'pending' }, 'Afventer'), h('option', { value: 'good' }, 'Godkendt'), h('option', { value: 'miss' }, 'Underkendt')),
            result.status === 'error' && h('p', { id: `${id}-error`, role: 'alert' }, result.message))
        }))
    }))
}
