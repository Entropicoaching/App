import { antalOrd } from '../../antalOrd.mjs'
import { createElement as h } from 'react'
import { buildBlockOverview } from './blockOverviewModel.mjs'

// Standalone read-only view. No screen imports it in this ticket.
export default function BlockOverview(options = {}) {
  const model = buildBlockOverview(options)
  if (!model || model.state === 'empty') return null
  const planned = model.weeks.filter(row => row.plannedSets != null)
  const style = { padding: 20, marginBottom: 16, border: '1px solid #59564c',
    borderRadius: 16, background: '#1c1c18', color: '#edeae2', minWidth: 0, overflowWrap: 'anywhere' }
  return h('section', { 'aria-label': 'Din aktuelle blok', 'data-block-overview': model.state, style },
    h('h2', { style: { fontSize: '1.15rem', marginTop: 0 } }, model.name || 'Din aktuelle blok'),
    model.state !== 'ready' ? h('p', { role: 'status' }, model.message) : h('div', null,
      h('p', null, `Uge ${model.currentWeek} af ${model.totalWeeks}`),
      model.partial ? h('p', { role: 'status' }, 'Nogle programuger kunne ikke vises.') : null,
      planned.length ? h('div', null,
      h('h3', { style: { fontSize: '1rem' } }, 'Planlagt volumen pr. uge'),
      h('p', null, 'Antal sæt i programmet. Det viser planen, ikke gennemført træning.'),
      h('ol', { style: { paddingLeft: 24 } }, ...planned.map(row => h('li', {
        key: row.id, 'aria-current': row.current ? 'step' : undefined,
        style: { marginBottom: 12, lineHeight: 1.6 } },
      `Uge ${row.blockWeek} (programuge ${row.weekNumber})${row.current ? ' · Aktuel uge' : ''}: `,
      `${row.plannedSets} ${antalOrd(row.plannedSets, 'planlagt sæt', 'planlagte sæt')}`)))) : null,
      model.next ? h('div', null, h('h3', { style: { fontSize: '1rem' } }, 'Næste test eller deload'),
      h('p', null, model.next
        ? `${model.next.kinds.map(kind => kind === 'test' ? 'Test' : 'Deload').join(' og ')} i programuge ${model.next.weekNumber}${model.next.start ? ` · fra ${model.next.start}` : ''}`
        : '' )) : null,
      h('p', { style: { color: '#b8b4a8', fontSize: '0.85rem' } },
        'Test og deload vises ud fra blokkens navn i planen.')))
}
