import { createElement as h } from 'react'
import { mobilityPlan } from './mobility-plan.mjs'

// Standalone React view; intentionally not imported by any route or live flow.
export default function MobilityPlan(props = {}) {
  if (props.enabled !== true) return null
  const model = mobilityPlan(props)
  return h('section', { 'aria-label': 'Mobilitet til dagens løft', style: {
    width: '100%', maxWidth: 640, boxSizing: 'border-box', padding: 16,
    overflowWrap: 'anywhere', color: '#edeae2', background: '#1c1c18',
    border: '1px solid #736043', borderRadius: 12, lineHeight: 1.5,
  } },
  h('h2', null, 'Mobilitet til dagens løft'),
  model.kind !== 'ready'
    ? h('p', { role: model.kind === 'error' ? 'alert' : 'status' }, model.message)
    : h('div', null,
      h('p', null, `${model.lifts.join(' · ')} · Ca. ${model.totalSeconds / 60} min`),
      h('p', null, `${model.rounds} ${model.rounds === 1 ? 'runde' : 'runder'}. Følg doseringen. Tiderne er skøn med ca. 1 min samlet til skift.`),
      h('p', null, 'Valgfrit før træningen. Stop ved smerte. Fortsæt derefter med dine sædvanlige opvarmningssæt.'),
      h('ol', { style: { paddingInlineStart: 24, margin: 0 } }, ...model.steps.map(step =>
        h('li', { key: step.id, style: { marginBlock: 16 } },
          h('h3', { style: { marginBlock: 4 } }, step.name),
          h('p', { style: { marginBlock: 4 } }, `${step.label} · Ca. ${step.estimatedSeconds} sek pr. runde`),
          h('details', null,
            h('summary', { style: { minHeight: 44, paddingBlock: 10, cursor: 'pointer', boxSizing: 'border-box' } }, 'Sådan gør du'),
            h('p', null, step.desc)))))))
}
