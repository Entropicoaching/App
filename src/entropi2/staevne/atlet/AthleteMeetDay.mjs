import { createElement as h, useId, useState } from 'react'
import { LIFTS } from '../meetModel.mjs'
import { OUTCOMES, emptyResults, planFingerprint, readPlans, summarize } from './athleteMeetModel.mjs'
import { clearDraft, draftKey, loadDraft, saveDraft } from './athleteMeetDraft.mjs'

const kgText = value => String(value).replace('.', ',')
const style = {
  page: { maxWidth: '32rem', marginInline: 'auto', padding: '1rem', boxSizing: 'border-box',
    background: '#1c1c18', color: '#edeae2', fontFamily: 'Arial, sans-serif', lineHeight: 1.5, overflowWrap: 'anywhere' },
  control: { minHeight: 48, minWidth: 48, maxWidth: '100%', boxSizing: 'border-box', padding: 12,
    font: 'inherit', background: '#262621', color: '#edeae2', border: '1px solid #929083', borderRadius: 8 },
  options: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  fieldset: { minWidth: 0, marginBlock: 16, padding: 12, border: '1px solid #929083', borderRadius: 8 },
}
const page = (...children) => h('section', { 'aria-label': 'Atletens stævnedag', style: style.page }, h('h2', null, 'Stævnedag'), ...children)
const planMessage = (lift, plan) => h('p', { key: lift, role: plan.status === 'error' ? 'alert' : 'status' },
  plan.status === 'error' ? `Coachens plan for ${LIFTS[lift]} kunne ikke vises. Bed din coach kontrollere planen.` : `Ingen plan for ${LIFTS[lift]} endnu.`)

// Strict opt-in before inspecting any other prop. No application wiring or backend.
export default function AthleteMeetDay(props = {}) {
  if (props.enabled !== true) return null
  if (props.error) return page(h('p', { role: 'alert' }, 'Stævneplanen kunne ikke indlæses. Prøv at hente den igen.'))
  const plans = readPlans(props.plans)
  if (!Object.keys(LIFTS).some(lift => plans[lift].status === 'ready'))
    return page(...Object.keys(LIFTS).map(lift => planMessage(lift, plans[lift])))
  const key = draftKey(props.athleteId, props.meetId, props.planRevision)
  if (!key) return page(h('p', { role: 'alert' }, 'Vælg en atlet, et stævne og en planversion for at åbne stævnedagen.'))
  const fingerprint = planFingerprint(plans)
  return h(ScopedDay, { key: JSON.stringify([key, fingerprint]), draftStorageKey: key, fingerprint, plans, storage: props.storage })
}

function ScopedDay({ draftStorageKey, fingerprint, plans, storage }) {
  const prefix = useId()
  const [state, setState] = useState(() => ({ ...loadDraft(draftStorageKey, fingerprint, storage), storage }))
  const [lift, setLift] = useState(() => Object.keys(LIFTS).find(name => plans[name].status === 'ready'))
  // Changing a supplied storage adapter cannot copy answers from the prior one.
  if (state.storage !== storage) {
    setState({ ...loadDraft(draftStorageKey, fingerprint, storage), storage })
    return null
  }
  const { results, status } = state
  const persist = next => setState({ results: next, storage,
    status: saveDraft(draftStorageKey, fingerprint, next, storage) ? 'saved' : 'unavailable' })
  const update = (index, outcome) => {
    if (!Object.hasOwn(OUTCOMES, outcome) || plans[lift].status !== 'ready') return
    persist({ ...results, [lift]: results[lift].map((value, i) => i === index ? outcome : value) })
  }
  const clear = () => {
    if (clearDraft(draftStorageKey, storage)) setState({ results: emptyResults(), status: 'cleared', storage })
    else setState({ ...state, status: 'clear-failed' })
  }
  const total = summarize(plans, results)
  const totalText = total.status === 'total' ? `Total: ${kgText(total.sum)} kg`
    : total.status === 'provisional-total' ? `Foreløbig total: ${kgText(total.sum)} kg`
      : total.status === 'partial' ? `Foreløbig sum: ${kgText(total.sum)} kg. Total kræver et godkendt forsøg i alle tre løft.`
        : total.status === 'no-total' ? 'Ingen total: mindst ét løft er uden godkendte forsøg.' : 'Ingen godkendte forsøg endnu.'
  const message = status === 'saved' ? 'Kladde gemt på denne enhed.'
    : status === 'unavailable' ? 'Kladden kunne ikke læses eller gemmes. Ændringer bliver kun her, mens visningen er åben. Prøv Gem kladde igen.'
      : status === 'changed' ? 'Coachens plan er ændret. Tidligere afgørelser er lagt til side; registrér dem igen.'
        : status === 'clear-failed' ? 'Kladden kunne ikke slettes. Afgørelserne er bevaret. Prøv igen.'
          : status === 'cleared' ? 'Kladden er slettet fra denne enhed.' : 'Ingen kladde gemt endnu.'
  const plan = plans[lift]
  return page(
    h('p', null, 'Coachens valgte forsøg. Afgørelser gemmes automatisk som lokal kladde og sendes ikke til din coach. På en delt enhed kan andre se kladden.'),
    h('p', { role: 'status', 'aria-label': 'Total', 'aria-live': 'polite' }, totalText),
    h('label', { htmlFor: `${prefix}-lift` }, 'Løft'),
    h('select', { id: `${prefix}-lift`, value: lift, style: { ...style.control, width: '100%' }, onChange: event => {
      if (Object.hasOwn(LIFTS, event.target.value)) setLift(event.target.value)
    } }, ...Object.entries(LIFTS).map(([value, label]) => h('option', { key: value, value },
      label + (plans[value].status === 'empty' ? ' (ingen plan)' : plans[value].status === 'error' ? ' (planfejl)' : '')))),
    h('h3', null, LIFTS[lift]),
    plan.status !== 'ready' ? planMessage(lift, plan) : h('div', null,
      h('details', null,
        h('summary', { style: { ...style.control, cursor: 'pointer' } }, `Opvarmning${plan.openerTime ? ` · åbner kl. ${plan.openerTime}` : ''}`),
        !plan.openerTime && h('p', null, 'Åbnertid mangler. Tiderne er relative til åbneren.'),
        plan.warmup.length ? h('ol', null, ...plan.warmup.map((set, index) => h('li', { key: index },
          `${kgText(set.kg)} kg × ${set.reps} · ${set.minutesBefore} min før åbner${set.time ? ` · kl. ${set.time}${set.previousDay ? ' (dagen før)' : ''}` : ''}`)))
          : h('p', null, 'Ingen opvarmningssæt i coachens plan. Aftal opvarmning med coachen.')),
      ...plan.attempts.map((kg, index) => h('fieldset', { key: index, style: style.fieldset },
        h('legend', null, `${LIFTS[lift]} · forsøg ${index + 1} · ${kgText(kg)} kg`),
        h('div', { style: style.options }, ...Object.entries(OUTCOMES).map(([value, label]) => {
          const id = `${prefix}-${lift}-${index}-${value}`
          return h('label', { key: value, htmlFor: id, style: { ...style.control, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' } },
            h('input', { id, type: 'radio', name: `${prefix}-${lift}-${index}`, value, checked: results[lift][index] === value,
              onChange: () => update(index, value) }), label)
        }))))),
    h('p', { role: status === 'unavailable' || status === 'clear-failed' ? 'alert' : 'status', 'aria-live': 'polite' }, message),
    h('details', null, h('summary', { style: { ...style.control, cursor: 'pointer' } }, 'Kladde'),
      h('div', { style: style.options },
        h('button', { type: 'button', style: style.control, onClick: () => persist(results) }, 'Gem kladde'),
        h('button', { type: 'button', style: style.control, onClick: clear }, 'Slet kladde'))))
}
