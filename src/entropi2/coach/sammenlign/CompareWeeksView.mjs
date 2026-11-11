import { antalOrd } from '../../antalOrd.mjs'
import { createElement as h } from 'react'
import { compareWeeks } from './compareWeeks.mjs'

const number = new Intl.NumberFormat('da-DK', { maximumFractionDigits: 1 })
const format = value => value === null ? 'Ukendt' : number.format(value)
const delta = value => value === null ? 'Kan ikke sammenlignes' :
  `${value > 0 && number.format(value) !== '0' ? '+' : ''}${number.format(Object.is(value, -0) || Math.abs(value) < 0.05 ? 0 : value)}`
const period = w => `${w.start} – ${w.end}${w.provisional ? ` (foreløbig, til ${w.through})` : ''}`

// Opt-in only. OFF must return before reading snapshot or today getters.
export default function CompareWeeksView(props = {}) {
  if (props.enabled !== true) return null
  const model = compareWeeks(props.snapshot, props.today)
  if (!model.ready) return h('p', { role: 'status' }, model.message)
  const { first, second } = model
  const table = (caption, rows) => h('div', { style: { overflowX: 'auto' } },
    h('table', null,
      h('caption', null, caption),
      h('thead', null, h('tr', null,
        ...['Mål', period(first), period(second), 'Forskel (anden minus første)'].map(label => h('th', { key: label, scope: 'col' }, label)))),
      h('tbody', null, ...rows.map(row => h('tr', { key: row.key },
        h('th', { scope: 'row' }, `${row.label} (${row.unit})`),
        h('td', null, format(row.first)), h('td', null, format(row.second)), h('td', null, delta(row.delta)))))))
  return h('section', { 'aria-label': 'Sammenlign to uger' },
    !props.embedded && h('h2', null, 'Sammenlign to uger'),
    h('details', { 'data-u9-forklaring': '' }, h('summary', { style: { cursor: 'pointer', minHeight: 44 } }, 'Forklaring'), h('p', null, 'Observerede forskelle for samme atlet. Ugerne kan have forskellig datadækning; tallene er ikke en vurdering eller en trend.')),
    table('Træning, kost og kropsvægt', model.metrics),
    h('p', null, `RPE: ${format(first.training.rpeCount)} / ${format(second.training.rpeCount)} sæt med dokumenteret atletindtastning. Vægt: ${format(first.weight.days)} ${antalOrd(first.weight.days, 'entydig vejedag', 'entydige vejedage')} / ${format(second.weight.days)} ${antalOrd(second.weight.days, 'entydig vejedag', 'entydige vejedage')}; ${format(first.weight.conflicts)} ${antalOrd(first.weight.conflicts, 'dag', 'dage')} / ${format(second.weight.conflicts)} ${antalOrd(second.weight.conflicts, 'dag', 'dage')} med modstridende værdier udeladt.`),
    table('Top-e1RM pr. løft og variant', model.lifts.map(lift => ({ ...lift, label: lift.name, unit: 'kg' }))),
    !model.lifts.length ? h('p', null, 'Ingen kvalificerede tunge sæt i det tilgængelige grundlag.') : null,
    h('details', { 'data-u9-forklaring': '' }, h('summary', { style: { cursor: 'pointer', minHeight: 44 } }, 'Forklaring'), h('p', null, 'Pas tælles ved mindst ét logget sæt, ikke som bekræftet gennemførte pas. Volumen er kg × gentagelser for alle ikke-sprungne sæt. RPE er snit af dokumenterede atletindtastninger. Kostsnit gælder kun loggede dage, som kan være ufuldstændige. Vægt vægter hver entydig vejedag én gang. e1RM bruger Epley for tunge sæt med kendt blok; lette sæt og deload/taper/aflastning udelades. Ukendt betyder, at grundlaget mangler eller ikke kan bruges.')))
}
