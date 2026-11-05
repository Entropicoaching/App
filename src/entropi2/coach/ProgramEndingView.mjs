import { createElement as h } from 'react'
import { buildProgramOverblik } from '../../programOverblik.mjs'
import { hasUndatedPlannedWeek } from './coachModel.mjs'

// Only accepts the already scoped CoachView context. No reads or writes.
export function programEndingModel(context) {
  if (!context?.rosterReady || !context.calendarReady || !context.day) {
    return { state: 'unknown', rows: [] }
  }
  const rows = buildProgramOverblik({ athletes: context.athletes,
    calendarWeeks: context.plans, today: context.day }).flatMap(entry => {
    const unknown = hasUndatedPlannedWeek(context.plans[entry.athlete.id]) || entry.lastDate === null
    if (unknown) return []
    return entry.daysLeft >= 0 && entry.daysLeft <= 7
      ? [{ athlete: entry.athlete, endDate: entry.lastDate }] : []
  })
  rows.sort((a, b) => a.endDate.localeCompare(b.endDate) ||
    a.athlete.name.localeCompare(b.athlete.name, 'da') || a.athlete.id.localeCompare(b.athlete.id))
  return { state: 'ready', rows }
}

export default function ProgramEndingView({ context, openProfile }) {
  const model = programEndingModel(context)
  if (model.state !== 'ready' || model.rows.length === 0) return null
  const canOpen = typeof openProfile === 'function'
  return h('section', { 'aria-label': 'Programmer der slutter snart' },
    h('h2', null, 'Programmer der slutter snart'),
    h('p', null, 'Sidste planlagte uge slutter i dag eller inden for 7 dage.'),
        h('ul', { style: { listStyle: 'none', padding: 0 } }, ...model.rows.map(row =>
          h('li', { key: row.athlete.id, style: { marginBlock: 16 } },
            h('strong', null, row.athlete.name),
            h('p', null, 'Slutter ', h('time', { dateTime: row.endDate }, row.endDate.split('-').reverse().join('.'))),
            h('button', { type: 'button', disabled: !canOpen,
              'aria-label': `Planlæg næste blok for ${row.athlete.name}`,
              style: { minHeight: 48, padding: '12px 16px', font: 'inherit', color: '#edeae2',
                background: '#1c1c18', border: '1px solid #c8923a', borderRadius: 12,
                cursor: canOpen ? 'pointer' : 'default' },
              onClick: canOpen ? () => openProfile(row.athlete, 'program', 'list') : undefined },
            'Planlæg næste blok')))),
    !canOpen && h('p', { role: 'status' }, 'Programnavigationen er ikke tilsluttet.'))
}
