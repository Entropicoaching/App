import { createElement as h } from 'react'
import { planGrundlag, formatBasis as f } from './planGrundlag.mjs'

const card = { border: '1px solid currentColor', borderRadius: 12, padding: 16, marginBlock: 16 }
const cell = { padding: 10, textAlign: 'left', verticalAlign: 'top' }
const period = w => `${w.start} – ${w.end}`
const kg = n => n === null ? 'Data mangler' : `${f(n)} kg`

// Deliberately not imported by any entry point. OFF returns before reading data.
export default function PlanGrundlagView(props) {
  if (props.enabled !== true) return null
  const model = planGrundlag(props.snapshot, props.today)
  if (model.state !== 'ready') return h('section', { 'aria-label': 'Planlægningsgrundlag' },
    h('h2', null, 'Grundlag for næste blok'), h('p', { role: 'status' }, model.message))
  const c = model.compliance
  return h('section', { 'aria-label': 'Planlægningsgrundlag', 'data-coach-planlaegning': true,
    style: { color: 'inherit', lineHeight: 1.6, maxWidth: '100%', minWidth: 0 } },
  h('h2', null, 'Grundlag for næste blok'),
  h('p', null, `${period({ start: model.block.start_date, end: model.block.end_date })} · ${model.block.weekCount} uger`),
  h('p', null, model.message),
  h('section', { style: card, 'aria-label': 'Neutrale observationer' },
    h('h3', null, 'Observationer'),
    model.observations.length ? h('ul', null, ...model.observations.map(o => h('li', { key: o }, o)))
      : h('p', null, 'Der er ikke tilstrækkelige registreringer til sammenligninger.')),
  h('section', { style: card, 'aria-label': 'Gennemførelsesgrad' }, h('h3', null, 'Registreret gennemførelse'),
    h('p', null, model.planReady ? `${f(c.planned)} planlagte sæt.` : 'Planen er ikke fuldt dokumenteret.'),
    h('p', null, model.logsReady ? `${f(c.confirmed)} gennemført · ${f(c.skipped)} sprunget over · ${f(c.percent)}${c.percent === null ? '' : ' %'}.`
      : 'Loggrundlaget mangler eller er ikke entydigt.'),
    h('p', null, 'Andel gennemførte sæt af alle planlagte sæt. Oversprungne sæt tæller særskilt. Manglende registrering er ikke dokumentation for fravær.')),
  ...model.lifts.map(lift => h('details', { key: lift.lift, style: card, open: lift.lift === 'Squat' },
    h('summary', { style: { minHeight: 44, cursor: 'pointer', paddingBlock: 8 } }, lift.lift),
    h('div', { style: { overflowX: 'auto', maxWidth: '100%' }, tabIndex: 0, role: 'region', 'aria-label': `${lift.lift}: ugetabel` },
      h('table', { style: { borderCollapse: 'collapse', width: '100%' } },
        h('caption', null, `${lift.lift} pr. blokuge`),
        h('thead', null, h('tr', null, ...['Uge', 'Sæt', 'Volumen (kg × reps)', 'Bedste e1RM', 'RPE (egne svar)'].map(label =>
          h('th', { key: label, scope: 'col', style: cell }, label)))),
        h('tbody', null, ...lift.points.map(p => h('tr', { key: p.start },
          h('th', { scope: 'row', style: cell }, period(p)), h('td', { style: cell }, f(p.sets)),
          h('td', { style: cell }, kg(p.tonnage)), h('td', { style: cell }, kg(p.e1rm)),
          h('td', { style: cell }, p.rpe === null ? 'Data mangler' : `${f(p.rpe)} (${f(p.rated)} af ${f(p.sets)} sæt)`)))))),
    h('p', null, lift.comparison ? `e1RM: ${f(lift.comparison.percent)} % fra første til sidste blokuge (${lift.comparison.zone} reps).`
      : 'Ingen e1RM-sammenligning i samme rep-område mellem første og sidste blokuge.'))),
  h('p', null, 'Volumen er gennemførte hovedløftssæt og tonnage, inklusive lette sæt. e1RM bruger Epley fra tunge sæt med 1–8 reps; deload, taper og aflastning er udeladt. Varianter indgår ikke. RPE er gennemsnit af dokumenterede egne svar; manglende svar er udeladt.'),
  h('section', { style: card, 'aria-label': 'Kropsvægtstrend' }, h('h3', null, 'Kropsvægt'),
    model.weight.state === 'unknown' ? h('p', null, 'Vægtgrundlaget mangler eller er ikke entydigt.')
      : h('ul', null, ...model.weight.points.map(p => h('li', { key: p.start },
        `${p.start}: ${kg(p.value)} · ${p.days} vejedage`))),
    h('p', null, model.weight.delta === null ? 'Sammenligning kræver mindst tre vejedage i både første og sidste blokuge.'
      : `Forskel mellem ugegennemsnit: ${kg(model.weight.delta)}.`)),
  h('section', { style: card, 'aria-label': 'Smerte- og stopnoter' }, h('h3', null, 'Smerte- og stopnoter'),
    h('p', null, 'Markeringerne finder omtale i noterne; de er ikke en vurdering af symptomer.'),
    !model.logsReady ? h('p', null, 'Notegrundlaget er ikke klar.') : model.notes.length === 0
      ? h('p', null, 'Ingen noter i det komplette loggrundlag.')
      : h('ul', null, ...model.notes.map(n => h('li', { key: n.key, style: { marginBottom: 12, overflowWrap: 'anywhere' } },
        n.day ? h('time', { dateTime: n.day }, n.day) : `Blokuge fra ${n.weekStart}`, ` · ${n.exercise}`,
        h('p', null, [n.pain && 'Smerte nævnt', n.stop && 'Stop nævnt', n.skipped && 'Sæt sprunget over'].filter(Boolean).join(' · ')),
        h('p', { style: { whiteSpace: 'pre-wrap' } }, n.text))))))
}
