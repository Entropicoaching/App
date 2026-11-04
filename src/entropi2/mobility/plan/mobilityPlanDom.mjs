import { mobilityPlan } from './mobility-plan.mjs'

// Session's DOM renderer uses the same pinned model as the standalone React view.
// Caller owns mounting; this view creates no listeners, timers or writes.
export function createMobilityPlan(doc, options = {}) {
  if (options.enabled !== true) return null
  const model = mobilityPlan(options)
  const el = (tag, text, attrs = {}) => {
    const node = doc.createElement(tag)
    if (text != null) node.textContent = text
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value)
    return node
  }
  const root = el('section', null, { 'aria-label': 'Mobilitet til dagens løft', 'data-session-mobility': '' })
  root.append(el('h2', 'Mobilitet til dagens løft'))
  if (model.kind !== 'ready') {
    root.append(el('p', model.message, { role: model.kind === 'error' ? 'alert' : 'status' }))
    return root
  }
  root.append(el('p', `${model.lifts.join(' · ')} · Ca. ${model.totalSeconds / 60} min`),
    el('p', `${model.rounds} ${model.rounds === 1 ? 'runde' : 'runder'}. Følg doseringen. Tiderne er skøn med ca. 1 min samlet til skift.`),
    el('p', 'Tiden gælder mobiliteten. Opvarmningssæt kommer bagefter.'),
    el('p', 'Valgfrit før træningen. Stop ved smerte. Fortsæt derefter med opvarmningssættene nedenfor.'))
  const list = el('ol')
  for (const step of model.steps) {
    const item = el('li'), help = el('details', null, { 'data-detail': `mobility-${step.id}` })
    help.append(el('summary', 'Sådan gør du'), el('p', step.desc))
    item.append(el('h3', step.name), el('p', `${step.label} · Ca. ${step.estimatedSeconds} sek pr. runde`), help)
    list.append(item)
  }
  root.append(list)
  return root
}
