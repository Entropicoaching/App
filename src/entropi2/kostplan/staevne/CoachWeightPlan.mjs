import { createElement as h, useId, useState } from 'react'
import StaevneCoach from './StaevneCoach.mjs'
import { competitionBasis, competitionInput, emptyPlanDraft, localPlanDay } from './coachPlanInput.mjs'

const inputStyle = { minHeight: 44, width: '100%', boxSizing: 'border-box', font: 'inherit' }
const checkboxStyle = { minWidth: 24, minHeight: 24, flexShrink: 0 }

// Display guard inside the existing coach portal; not an authorization service.
export default function CoachWeightPlan(props = {}) {
  if (props.enabled !== true || props.role !== 'coach') return null
  const basis = competitionBasis(props)
  if (!basis) return null
  // Remount all temporary input and confirmations when its production basis changes.
  const key = JSON.stringify([props.athlete?.id, basis.competitionDate, basis.weightClassKg, props.meetType])
  return h(EnabledCoachWeightPlan, { key, basis })
}

export function EnabledCoachWeightPlan({ basis }) {
  const prefix = useId()
  const [draft, setDraft] = useState(emptyPlanDraft)
  return h('details', { style: { marginBlock: '1.5rem', maxWidth: '100%', minWidth: 0, overflowWrap: 'anywhere' } },
    h('summary', { style: { minHeight: 44, cursor: 'pointer' } }, 'Vægt og vejning'),
    h(CoachWeightPlanContent, { basis, draft, prefix, asOf: localPlanDay(new Date()),
      onChange: (field, value) => setDraft(previous => ({ ...previous, [field]: value })) }))
}

// Controlled content is exercised with real React by the app's normal test runner.
export function CoachWeightPlanContent({ basis, draft, prefix, asOf, onChange }) {
  const input = competitionInput(basis, draft, asOf)
  const ready = input.weightKg !== null && input.weighInHours !== null && input.adult && input.healthReviewed
  const field = (key, label, control) => h('div', { style: { marginBlock: 12 } },
    h('label', { htmlFor: `${prefix}-${key}` }, label), control)
  const check = (key, label) => h('label', { style: { display: 'flex', alignItems: 'center', gap: 8, minHeight: 44, marginBlock: 12 } },
    h('input', { type: 'checkbox', checked: draft[key], style: checkboxStyle,
      onChange: event => onChange(key, event.target.checked) }), label)
  return h('div', null,
    !ready && h('p', null, `Stævne ${basis.competitionDate} · vægtklasse ${new Intl.NumberFormat('da-DK').format(basis.weightClassKg)} kg`),
    h('p', null, 'Kun beregning til coachen. Intet gemmes eller sendes til atleten. Input nulstilles, når du forlader fanen, skifter atlet, stævnetype, dato eller vægtklasse.'),
    h('p', null, 'Indtast en aktuel vejning. Profilvægt bruges ikke automatisk, fordi den ikke har en vejningsdato.'),
    field('weight', 'Aktuel kropsvægt (kg)', h('input', { id: `${prefix}-weight`, type: 'text', inputMode: 'decimal',
      value: draft.weightKg, style: inputStyle, onChange: event => onChange('weightKg', event.target.value) })),
    field('hours', 'Vejning før stævnet', h('select', { id: `${prefix}-hours`, value: draft.weighInHours, style: inputStyle,
      onChange: event => onChange('weighInHours', event.target.value) },
    h('option', { value: '' }, 'Vælg vejningstid'), h('option', { value: '2' }, '2 timer'), h('option', { value: '24' }, '24 timer'))),
    check('adult', 'Jeg bekræfter, at atleten er voksen (18 år eller ældre).'),
    check('healthReviewed', 'Helbred, medicin og risiko for spiseforstyrrelser er fagligt vurderet. Værktøjet er ikke egnet ved graviditet, sygdom eller spiseforstyrrelser.'),
    ready ? h(StaevneCoach, { enabled: true, role: 'coach', input })
      : h('p', { role: draft.weightKg.trim() !== '' && input.weightKg === null ? 'alert' : 'status' },
        draft.weightKg.trim() !== '' && input.weightKg === null
          ? 'Kropsvægt skal være et tal mellem 25 og 350 kg. Der er ingen beregning.'
          : 'Ingen beregning endnu. Angiv aktuel kropsvægt og vejningstid, og bekræft begge vurderinger ovenfor.'))
}
