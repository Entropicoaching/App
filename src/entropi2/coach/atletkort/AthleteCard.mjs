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
  if (props.compact) {
    const status = [['ready', 'empty'].includes(model.lastSession.state) && model.lastSession.text,
      model.messages.state === 'ready' && model.messages.count > 0 && model.messages.text].filter(Boolean).join(' · ')
    return h('article', { 'aria-label': `Atletkort: ${model.name}`, style: { ...panel, padding: 12 } },
      h('button', { type: 'button', disabled: !canOpen, 'data-coach-summary': model.id,
        'aria-label': `Åbn atlet: ${model.name}`,
        style: { ...action, marginTop: 0, width: '100%', textAlign: 'left', minWidth: 0,
          overflowWrap: 'anywhere', boxSizing: 'border-box' },
        onClick: canOpen ? () => props.onOpen(model.id) : undefined },
        h('strong', null, model.name),
        status && h('span', { style: { display: 'block' } }, status),
        ...props.compact.signals.slice(0, 2).map(text => h('span', { key: text,
          'data-coach-short-signal': true, style: { display: 'block' } }, text)),
        h('span', { style: { display: 'block' } }, 'Åbn')))
  }
  const rows = [['Træning', model.lastSession], ['Kost', model.nutrition],
    ['Vægt', model.weight], ['Beskeder', model.messages]]
    .filter(([, value]) => value.state !== 'unknown')
  return h('article', { 'aria-label': `Atletkort: ${model.name}`, style: panel },
    h('h3', { style: { margin: '0 0 8px', fontSize: '1.1em' } }, model.name),
    model.signal.state === 'ready' && h('p', { style: { margin: '0 0 12px', fontWeight: 600 },
      'data-signal': model.signal.kind }, model.signal.text),
    rows.length > 0 && h('dl', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
      gap: 12, margin: 0 } }, ...rows.map(([label, value]) =>
      h('div', { key: label }, h('dt', { style: { fontSize: '0.85em' } }, label),
        h('dd', { style: { margin: '4px 0 0' }, role: value.state === 'error' ? 'alert' : undefined },
          value.state === 'error' ? 'Kunne ikke indlæses' :
            value.day ? h('time', { dateTime: value.day }, value.text) : value.text)))),
    h('button', { type: 'button', disabled: !canOpen, style: action,
      'aria-label': `Åbn atlet: ${model.name}`,
      onClick: canOpen ? () => props.onOpen(model.id) : undefined }, 'Åbn atlet'))
}
