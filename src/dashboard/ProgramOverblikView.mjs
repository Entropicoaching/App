import { createElement as h } from 'react'
import { buildProgramOverblik } from '../programOverblik.mjs'

const colors = { red: '#ffb0a0', yellow: '#f1cf7b', normal: '#edeae2', unknown: '#b8b4a8' }
const number = new Intl.NumberFormat('da-DK', { maximumFractionDigits: 1 })
const date = value => value.split('-').reverse().join('.')

export default function ProgramOverblik({ athletes = [], calendarWeeks = {}, hiddenAthleteIds = new Set(), openProfile, today, loading = false, loadError = false }) {
  const entries = buildProgramOverblik({ athletes: athletes.filter(a => !hiddenAthleteIds.has(a.id)), calendarWeeks, today })
  return h('section', { 'aria-label': 'Programoverblik', style: { color: '#edeae2', maxWidth: 900, marginInline: 'auto' } },
    h('h1', null, 'Programoverblik'),
    h('p', null, 'Sidste planlagte uge dækker syv dage fra startdatoen. Uger tilbage beregnes fra i dag i dansk tid.'),
    loading ? h('p', { role: 'status' }, 'Henter atleter…') : loadError ? h('p', { role: 'alert' }, 'Atleterne kunne ikke hentes.') :
      h('ul', { style: { listStyle: 'none', padding: 0 } },
        ...entries.map(entry => h('li', { key: entry.athlete.id, style: { marginBlock: 12 } },
          h('button', {
            type: 'button', onClick: () => openProfile(entry.athlete, 'program'),
            style: { display: 'block', width: '100%', minHeight: 44, textAlign: 'left', padding: 16, font: 'inherit', cursor: 'pointer', color: colors[entry.urgency], background: '#1c1c18', border: `1px solid ${colors[entry.urgency]}`, overflowWrap: 'anywhere' },
          },
          h('strong', null, entry.athlete.name),
          h('div', null, entry.status === 'planned'
            ? `Planlagt til ${date(entry.lastDate)} · Uge ${entry.calendarWeek.week}, ${entry.calendarWeek.year} · Programuge ${entry.lastWeek ?? 'ukendt'}`
            : entry.status === 'undated' ? 'Program uden dato' : 'Intet program'),
          entry.weeksLeft !== null ? h('div', null, `${number.format(entry.weeksLeft)} uge${entry.weeksLeft === 1 ? '' : 'r'} tilbage`, entry.daysLeft < 0 ? ' · Programmet er udløbet' : entry.urgency === 'red' ? ' · Under 1 uge' : entry.urgency === 'yellow' ? ' · Under 2 uger' : '') : null,
          entry.nextCompetition ? h('div', null, `Næste stævne: ${date(entry.nextCompetition)}`) : null))),
        entries.length === 0 ? h('li', null, 'Ingen atleter at vise.') : null))
}
