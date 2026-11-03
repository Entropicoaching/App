import { createElement as h } from 'react'
import { chartGeometry, trackingViewModel } from './trackingContract.mjs'

const format = value => value === null ? 'Mangler' : new Intl.NumberFormat('da-DK', { maximumFractionDigits: 1 }).format(value)
const colors = ['#8ee3cf', '#ffcb83']
const trendText = { rising: 'Stigende', falling: 'Faldende', stable: 'Stabil', unknown: 'Ukendt' }
const box = { minWidth: 0, padding: 16, border: '1px solid #68736e', borderRadius: 12, background: '#17211e' }
const cell = { textAlign: 'left', padding: '8px 6px', verticalAlign: 'top', overflowWrap: 'anywhere' }

function signal(value) {
  return value.signal ? h('p', null, h('strong', null,
    `${value.signal.level === 'attention' ? 'Opmærksomhed' : 'Information'}: ${value.signal.label}. `), value.signal.reason) :
    h('p', null, 'Intet signal leveret. Det er ikke en vurdering af, at alt er normalt.')
}

function chart(rows, fields, labels, unit, title) {
  const geometry = chartGeometry(rows, fields)
  const hasData = geometry.min !== null
  return h('div', null,
    rows.length > 0 && h('p', null, `Seneste punkt (${rows.at(-1).day}): `,
      fields.map((field, i) => `${labels[i]}: ${format(rows.at(-1)[field])}${rows.at(-1)[field] === null ? '' : ` ${unit}`}`).join(' · ')),
    hasData ? h('figure', { style: { margin: '12px 0' } },
      h('svg', { viewBox: '0 0 320 96', role: 'img', 'aria-label': title,
        style: { display: 'block', width: '100%', height: 'auto' } },
      ...geometry.paths.map((d, i) => h('path', { key: `path-${i}`, d, fill: 'none', stroke: colors[i], strokeWidth: 2,
        strokeDasharray: i ? '6 4' : undefined })),
      ...geometry.points.flatMap((line, i) => line.flatMap((p, j) => p ? [h('circle', {
        key: `point-${i}-${j}`, cx: p.x, cy: p.y, r: 2.5, fill: colors[i],
      })] : []))),
      h('figcaption', null, `${rows[0].day} – ${rows.at(-1).day}. Skala ${format(geometry.min)}–${format(geometry.max)} ${unit}. `,
        ...labels.map((label, i) => h('span', { key: label, style: { color: colors[i] } },
          `${i ? ' · ' : ''}${label} (${i ? 'stiplet' : 'fuld linje'})`)))) :
      h('p', null, 'Ingen registrerede værdier i perioden.'),
    rows.length > 0 && h('details', null, h('summary', { style: { minHeight: 44, cursor: 'pointer' } }, 'Se værdier og datamangler'),
      h('table', { style: { width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' } },
        h('caption', null, title),
        h('thead', null, h('tr', null, ...['Dato', ...labels].map(label => h('th', { key: label, scope: 'col', style: cell }, label)))),
        h('tbody', null, ...rows.map(row => h('tr', { key: row.day },
          h('th', { scope: 'row', style: cell }, row.day),
          ...fields.map(field => h('td', { key: field, style: cell }, `${format(row[field])}${row[field] === null ? '' : ` ${unit}`}`))))))))
}

function card(title, value, content) {
  return h('section', { style: box, 'aria-label': title }, h('h3', { style: { marginTop: 0 } }, title),
    value.state === 'ready' ? h('div', null, content(), signal(value)) : h('p', null,
      value.state === 'invalid' ? 'Data kunne ikke vises. Grundlaget skal kontrolleres.' : 'Der er endnu ingen data at vise.'))
}

/** Pure, read-only React section. Import only when a future caller enables it.
 * enabled defaults to false; no data access or effects at the OFF boundary.
 */
export default function BelastningOgTrend({ enabled = false, data } = {}) {
  if (enabled !== true) return null
  const model = trackingViewModel(data)
  return h('section', { 'aria-label': 'Belastning og trend', style: {
    color: '#f0f4f1', background: '#101815', padding: 12, borderRadius: 16,
    fontFamily: 'inherit', overflowWrap: 'anywhere', minWidth: 0,
  } }, h('h2', null, 'Belastning og trend'),
  h('p', null, model.asOf ? `Opgjort til og med ${model.asOf}. Grundlag: atletens egne registreringer.` : 'Opgørelsesdato mangler eller formatet understøttes ikke.'),
  h('p', null, 'Signaler er grundlag for coachens evaluering og planlægning. Manglende registreringer er ikke nul.'),
  h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 290px), 1fr))', gap: 12 } },
    card('Akut og kronisk belastning', model.load, () => h('div', null,
      h('p', null, 'Akut: 7 dage. Kronisk: 28 dage omregnet til 7 dage. Samme belastningsenhed for begge linjer.'),
      chart(model.load.days, ['acute', 'chronic'], ['Akut', 'Kronisk'], model.load.unit, 'Belastning over tid'))),
    card('e1RM-trend og plateau', model.strength, () => h('div', null,
      h('p', null, 'e1RM er estimeret maksimal styrke for én gentagelse. Sammenlign kun samme øvelse og beregningsmetode.'),
      model.strength.exercises.length === 0 ? h('p', null, 'Ingen øvelser med et styrkegrundlag.') :
        model.strength.exercises.map(exercise => h('section', { key: exercise.id, 'aria-label': exercise.label },
          h('h4', null, exercise.label),
          h('p', null, `${trendText[exercise.trend]} trend. Plateau: ${exercise.plateau === null ? 'Ukendt' : exercise.plateau ? 'Ja' : 'Nej'}. ${exercise.reason}`),
          chart(exercise.days, ['e1rmKg'], ['e1RM'], 'kg', `${exercise.label}: estimeret styrke`))))),
    card('Protein og kcal mod mål · 4 uger', model.nutrition, () => h('div', null,
      h('p', null, 'Ugerne slutter på de viste datoer. Daglige gennemsnit for registrerede dage sammenholdes med mål for samme dage.'),
      chart(model.nutrition.weeks, ['proteinG', 'proteinGoalG'], ['Protein', 'Proteinmål'], 'g/dag', 'Protein de seneste 4 uger'),
      chart(model.nutrition.weeks, ['kcal', 'kcalGoal'], ['Energi', 'Energimål'], 'kcal/dag', 'Energi de seneste 4 uger'),
      h('p', null, model.nutrition.weeks.length ? model.nutrition.weeks.map(w => `${w.day}: ${w.loggedDays}/7 dage registreret`).join(' · ') : 'Ingen uger registreret.'))),
    card('Kropsvægt · 7 dages gennemsnit', model.weight, () => h('div', null,
      chart(model.weight.days, ['kg', 'mean7Kg'], ['Vægt', '7 dages gennemsnit'], 'kg', 'Vægt og gennemsnit'),
      h('p', null, 'Gennemsnittet bruger kun registrerede målinger i de seneste 7 kalenderdage.'),
      h('p', null, model.weight.days.length ? model.weight.days.map(d => `${d.day}: ${d.samples7}/7 måledage`).join(' · ') : 'Ingen måledage registreret.')))))
}
