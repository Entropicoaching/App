import { antalOrd } from '../../antalOrd.mjs'
import { createElement as h } from 'react'
import { weeklyIntensity } from './intensityModel.mjs'

const percent = new Intl.NumberFormat('da-DK', { style: 'percent', maximumFractionDigits: 1 })
const date = day => `${day.slice(8, 10)}.${day.slice(5, 7)}.${day.slice(0, 4)}`

// Strict opt-in before reading data or the caller's clock. Unwired leaf.
export default function IntensityView(props = {}) {
  if (props.entropi2 !== true) return null
  const model = weeklyIntensity(props.exerciseLogs, props.asOf)
  if (model.ready && !model.weeks.some(week => week.classified > 0)) return null
  const style = { color: '#edeae2', background: '#141410', padding: 16,
    width: '100%', maxWidth: 560, minWidth: 0, boxSizing: 'border-box',
    overflowWrap: 'anywhere', fontFamily: 'Arial, sans-serif', lineHeight: 1.6 }
  return h('section', { 'aria-label': 'Intensitet pr. uge', style },
    h('h2', null, 'Intensitet pr. uge'), h('p', null, model.message),
    ...model.weeks.filter(week => week.classified > 0).map(week => h('section', { key: week.start,
      'aria-label': `${date(week.start)} til ${date(week.end)}` },
    h('h3', null, `${date(week.start)} til ${date(week.end)}`),
    h('p', null, `${week.classified} af ${week.total} ${antalOrd(week.total, 'registreret sæt', 'registrerede sæt')} fordelt. ${week.unknown} sæt uden gyldig måling eller e1RM-reference.`),
    week.total === 0 ? h('p', null, 'Ingen registrerede sæt i ugen.')
      : h('ul', { style: { paddingLeft: 20 } }, ...week.zones.map(zone =>
        h('li', { key: zone.key }, `${zone.label}: ${zone.count} sæt (${zone.share === null ? 'andel ukendt' : percent.format(zone.share)}).`))))),
    model.ready && h('p', null, 'Reference-e1RM leveres for samme øvelse og vægtenhed, kendt på sættets tidspunkt. Tallene beskriver belastningen og er ikke en træningsanbefaling.'))
}
