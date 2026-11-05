import { createElement as h } from 'react'
import { buildProgramOverblik } from '../../programOverblik.mjs'
import { hasUndatedPlannedWeek } from './coachModel.mjs'

const date = value => value.split('-').reverse().join('.')
const number = new Intl.NumberFormat('da-DK', { maximumFractionDigits: 1 })
const colors = { red: '#ffb0a0', yellow: '#f1cf7b', normal: '#edeae2', unknown: '#b8b4a8' }

// The home screen has one place for dating tasks. An undated week never
// becomes a claim about when the plan ends, even when other weeks have dates.
export default function CoachProgramsView({ context, openProfile }) {
  if (!context.rosterReady || !context.calendarReady || !context.athletes.length) return null
  const entries = buildProgramOverblik({ athletes: context.athletes,
    calendarWeeks: context.plans, today: context.day })
  const canOpen = typeof openProfile === 'function'
  return h('ul', { style: { listStyle: 'none', padding: 0 } }, ...entries.map(entry => {
    const undated = hasUndatedPlannedWeek(context.plans[entry.athlete.id])
    const color = colors[undated ? 'unknown' : entry.urgency]
    return h('li', { key: entry.athlete.id, style: { marginBlock: 12 } }, h('button', {
      type: 'button', disabled: !canOpen,
      onClick: canOpen ? () => openProfile(entry.athlete, 'program', 'list') : undefined,
      style: { display: 'block', width: '100%', minHeight: 48, padding: 16,
        font: 'inherit', color, background: '#1c1c18', border: `1px solid ${color}`,
        borderRadius: 12, textAlign: 'left', overflowWrap: 'anywhere', cursor: 'pointer' } },
      h('strong', null, entry.athlete.name),
      h('span', { style: { display: 'block' } }, undated ? 'Sæt dato på programugen' :
        entry.status === 'empty' ? 'Opret program' :
          `Planlagt til ${date(entry.lastDate)} · Uge ${entry.calendarWeek.week}, ${entry.calendarWeek.year}` +
            (entry.lastWeek !== null ? ` · Programuge ${entry.lastWeek}` : '')),
      !undated && entry.weeksLeft !== null && h('span', { style: { display: 'block' } },
        entry.daysLeft < 0 ? 'Programmet er udløbet' :
          `${number.format(entry.weeksLeft)} uge${entry.weeksLeft === 1 ? '' : 'r'} tilbage` +
            (entry.urgency === 'red' ? ' · Under 1 uge' : entry.urgency === 'yellow' ? ' · Under 2 uger' : '')),
      entry.nextCompetition && h('span', { style: { display: 'block' } }, `Næste stævne: ${date(entry.nextCompetition)}`)))
  }))
}
