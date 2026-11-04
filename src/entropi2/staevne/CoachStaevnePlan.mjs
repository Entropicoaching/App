import { createElement as h, useId, useState } from 'react'
import StaevneView from './StaevneView.mjs'
import { LIFTS } from './meetModel.mjs'

const fields = { squat: ['squat1', 'squat2', 'squat3'], bench: ['bench1', 'bench2', 'bench3'], deadlift: ['dead1', 'dead2', 'dead3'] }
const inputStyle = { minHeight: 44, width: '100%', boxSizing: 'border-box' }

export default function CoachStaevnePlan(props = {}) {
  return props.enabled === true ? h(EnabledCoachStaevnePlan, props) : null
}

export function EnabledCoachStaevnePlan({ meetType = 'sbd', setMeetPlanForm, saving = false }) {
  const prefix = useId()
  const [basis, setBasis] = useState({})
  const [strategy, setStrategy] = useState('normal')
  const [results, setResults] = useState({})
  const [notice, setNotice] = useState('')
  const activeLifts = meetType === 'sbd' ? Object.keys(LIFTS) : ['bench']
  const lifts = Object.fromEntries(activeLifts.map(lift => {
    const raw = basis[lift]?.e1RM ?? ''
    // An empty reference is missing evidence, never a fabricated zero.
    const e1RM = raw === '' ? undefined : /^\d+(?:[.,]\d+)?$/.test(raw) ? Number(raw.replace(',', '.')) : NaN
    return [lift, { e1RM, openerTime: basis[lift]?.openerTime }]
  }))
  const updateBasis = (lift, field, value) => {
    setBasis(previous => ({ ...previous, [lift]: { ...previous[lift], [field]: value } }))
    setNotice('')
  }
  return h('details', { style: { marginBlock: '1.5rem', maxWidth: '100%', overflowWrap: 'anywhere' } },
    h('summary', { style: { minHeight: 44, cursor: 'pointer' } }, 'Forsøgsvalg og opvarmning'),
    h('p', null, 'Indtast dit aktuelle estimat for ét maksimalt løft (e1RM). Rekorder bruges ikke automatisk som estimater. Tomt grundlag giver ingen forslag.'),
    ...activeLifts.map(lift => h('fieldset', { key: lift, style: { minWidth: 0 } },
      h('legend', null, LIFTS[lift]),
      h('label', { htmlFor: `${prefix}-${lift}-reference` }, 'e1RM (kg)'),
      h('input', { id: `${prefix}-${lift}-reference`, type: 'text', inputMode: 'decimal', value: basis[lift]?.e1RM ?? '', style: inputStyle, onChange: event => updateBasis(lift, 'e1RM', event.target.value) }),
      h('label', { htmlFor: `${prefix}-${lift}-time` }, 'Åbner kl. (valgfrit)'),
      h('input', { id: `${prefix}-${lift}-time`, type: 'time', value: basis[lift]?.openerTime ?? '', style: inputStyle, onChange: event => updateBasis(lift, 'openerTime', event.target.value) }))),
    h('p', null, 'Brug forslag overfører kun vægte til planfelterne ovenfor. Kontrollér dem, og klik Gem plan for at gemme.'),
    notice && h('p', { role: 'status' }, notice),
    h(StaevneView, { enabled: true, lifts, activeLifts, strategy, onStrategyChange: value => { setStrategy(value); setNotice('') }, results,
      applyingDisabled: saving || typeof setMeetPlanForm !== 'function',
      onApplyPlan: (lift, attempts) => {
        if (saving || typeof setMeetPlanForm !== 'function') return
        setMeetPlanForm(previous => ({ ...previous, ...Object.fromEntries(fields[lift].map((field, index) => [field, String(attempts[index])])) }))
        setNotice(`${LIFTS[lift]}-forslag overført til planen. Ikke gemt endnu.`)
      },
      onResultChange: ({ lift, attempt, field, value }) => setResults(previous => {
        const entries = [...(previous[lift] ?? [])]
        entries[attempt - 1] = { ...entries[attempt - 1], [field]: value }
        return { ...previous, [lift]: entries }
      }) }),
    h('p', null, 'Faktiske forsøg her er midlertidige noter og gemmes ikke. De nulstilles, når du forlader fanen, skifter atlet eller stævnetype. Brug Registrér resultat i Stævnehistorik til at gemme stævnets resultat.'))
}
