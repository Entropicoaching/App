import { createElement as h } from 'react'
import { s } from '../dashboardShared.js'
import { buildProgramOverblik, copenhagenDay } from '../programOverblik.mjs'

const colors = { red: '#ffb0a0', yellow: '#f1cf7b', normal: '#edeae2', unknown: '#b8b4a8' }
const number = new Intl.NumberFormat('da-DK', { maximumFractionDigits: 1 })
const date = value => value.split('-').reverse().join('.')

export default function ProgramOverblik({ athletes = [], calendarWeeks = {}, hiddenAthleteIds = new Set(), openProfile, today, loading = false, loadError = false }) {
  const ready = loading === false && !loadError
  const day = ready ? copenhagenDay(today) : null
  const entries = ready && day ? buildProgramOverblik({ athletes: athletes.filter(a => !hiddenAthleteIds.has(a.id)), calendarWeeks, today: day }) : []
  return h('section', { 'aria-label': 'Programoverblik', style: { ...s.page, color: '#edeae2', fontFamily: s.wrap.fontFamily, fontWeight: s.wrap.fontWeight, textAlign: 'left', lineHeight: 1.5, maxWidth: 900, marginInline: 'auto', boxSizing: 'border-box' } },
    h('h1', { style: { ...s.topbarTitle, margin: '0 0 1rem', letterSpacing: 'normal' } }, 'Programoverblik'),
    h('details', null, h('summary', { style: { minHeight: 44, cursor: 'pointer' } }, 'Om datoerne'),
      h('p', null, 'Sidste planlagte uge dækker syv dage fra startdatoen. Uger tilbage beregnes fra i dag i dansk tid.')),
    loadError ? h('p', { role: 'alert' }, 'Programoverblikket kunne ikke hentes.') : !ready ? h('p', { role: 'status' }, 'Henter atleter…') :
      !day ? h('p', { role: 'alert' }, 'Datoerne kunne ikke vises. Åbn programmet fra atletens profil.') :
      h('ul', { style: { listStyle: 'none', padding: 0 } },
        ...entries.map(entry => h('li', { key: entry.athlete.id, style: { marginBlock: 12 } },
          h('button', {
            type: 'button', onClick: () => openProfile(entry.athlete, 'program'),
            style: { ...s.card, display: 'block', width: '100%', minHeight: 44, textAlign: 'left', padding: 16, font: 'inherit', cursor: 'pointer', color: colors[entry.urgency], background: '#1c1c18', border: `1px solid ${colors[entry.urgency]}`, overflowWrap: 'anywhere' },
          },
          h('strong', null, entry.athlete.name),
          h('div', null, entry.status === 'planned'
            ? `Planlagt til ${date(entry.lastDate)} · Uge ${entry.calendarWeek.week}, ${entry.calendarWeek.year}${Number.isSafeInteger(entry.lastWeek) && entry.lastWeek > 0 ? ` · Programuge ${entry.lastWeek}` : ''}`
            : entry.status === 'undated' ? 'Sæt dato på programmet'
              : Array.isArray(calendarWeeks[entry.athlete.id]) ? 'Opret program' : 'Åbn program'),
          entry.weeksLeft !== null ? h('div', null, `${number.format(entry.weeksLeft)} uge${entry.weeksLeft === 1 ? '' : 'r'} tilbage`, entry.daysLeft < 0 ? ' · Programmet er udløbet' : entry.urgency === 'red' ? ' · Under 1 uge' : entry.urgency === 'yellow' ? ' · Under 2 uger' : '') : null,
          entry.nextCompetition ? h('div', null, `Næste stævne: ${date(entry.nextCompetition)}`) : null))),
        entries.length === 0 ? h('li', null, 'Ingen atleter at vise.') : null))
}
