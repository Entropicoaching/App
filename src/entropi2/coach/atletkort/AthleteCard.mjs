import { createElement as h } from 'react'
import { athleteCardModel } from './athleteCardModel.mjs'

const panel = { padding: 16, border: '1px solid #77776b', borderRadius: 12,
  background: '#1c1c18', color: '#edeae2', overflowWrap: 'anywhere', minWidth: 0 }
const action = { minHeight: 48, padding: '10px 16px', font: 'inherit', color: '#edeae2',
  background: '#1c1c18', border: '1px solid #c8923a', borderRadius: 8, marginTop: 12 }

// Deliberately unconnected and OFF by default. OFF does not inspect facts or
// callbacks. The future host owns list semantics, authorization and navigation.
export default function AthleteCard(props = {}) {
  if (props.enabled !== true) return null
  const model = athleteCardModel(props.facts)
  const canOpen = typeof props.onOpen === 'function'
  const rows = [['Træning', model.lastSession], ['Kost', model.nutrition],
    ['Vægt', model.weight], ['Beskeder', model.messages]]
  return h('article', { 'aria-label': `Atletkort: ${model.name}`, style: panel },
    h('h3', { style: { margin: '0 0 8px', fontSize: '1.1em' } }, model.name),
    h('p', { style: { margin: '0 0 12px', fontWeight: 600 },
      'data-signal': model.signal.kind }, model.signal.text),
    h('dl', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
      gap: 12, margin: 0 } }, ...rows.map(([label, value]) =>
      h('div', { key: label }, h('dt', { style: { fontSize: '0.85em' } }, label),
        h('dd', { style: { margin: '4px 0 0' } },
          value.day ? h('time', { dateTime: value.day }, value.text) : value.text,
          value.state === 'error' ? ' · Kunne ikke indlæses' : null)))),
    h('button', { type: 'button', disabled: !canOpen, style: action,
      'aria-label': `Åbn atlet: ${model.name}`,
      onClick: canOpen ? () => props.onOpen(model.id) : undefined }, 'Åbn atlet'))
}
