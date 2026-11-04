import { createElement as h } from 'react'
import { meetPrognose } from './prognoseModel.mjs'

const number = new Intl.NumberFormat('da-DK', { maximumFractionDigits: 0 })
const date = day => `${day.slice(8, 10)}.${day.slice(5, 7)}.${day.slice(0, 4)}`

// Controlled leaf. OFF returns before reading clock/data/callbacks.
export default function PrognoseView(props = {}) {
  if (props?.entropi2 !== true) return null
  const model = meetPrognose(props)
  const editable = typeof props.onMeetDateChange === 'function'
  return h('section', { 'aria-label': 'e1RM-prognose til stævne', style: {
    color: '#edeae2', background: '#141410', padding: 16, width: '100%', maxWidth: 560,
    minWidth: 0, boxSizing: 'border-box', overflowWrap: 'anywhere', lineHeight: 1.6,
  } },
  h('h2', null, 'e1RM-prognose til stævne'),
  h('label', { style: { display: 'block' } }, 'Stævnedato',
    h('input', { type: 'date', value: typeof props.meetDate === 'string' ? props.meetDate : '',
      min: model.today, readOnly: !editable,
      style: { display: 'block', minHeight: 44, maxWidth: '100%', boxSizing: 'border-box', font: 'inherit' },
      onChange: event => props.onMeetDateChange?.(event.target.value) })),
  !editable && h('p', null, 'Datoen vises som læst. Valg af dato kræver tilkobling.'),
  h('p', { role: model.status === 'error' ? 'alert' : 'status' }, model.message),
  ...model.lifts.filter(lift => props.meetType !== 'bench' || lift.lift === 'Bænkpres').map(lift => h('section', { key: lift.lift, 'aria-label': lift.lift },
    h('h3', null, lift.lift),
    lift.status === 'ready' ? h('p', null,
      `Skøn: ${number.format(Math.round(lift.estimate))} kg. Usikkerhedsinterval: ${number.format(Math.floor(lift.lower))}–${number.format(Math.ceil(lift.upper))} kg.`)
      : h('p', null, lift.message),
    lift.status === 'ready' && h('details', null,
      h('summary', { style: { minHeight: 44, cursor: 'pointer' } }, 'Datagrundlag'),
      h('p', null, `${lift.weeks} uger med tunge sæt fra ${date(lift.firstDay)} til ${date(lift.lastDay)}. Bedste e1RM pr. kalenderuge.`)))),
  h('details', null, h('summary', { style: { minHeight: 44, cursor: 'pointer' } }, 'Metode og begrænsninger'),
    h('p', null, 'e1RM er et beregnet enrepetitionsmaksimum efter Epley: vægt × (1 + gentagelser / 30). Kun bekræftede tunge sæt med 1–8 gentagelser i kendte programblokke fra de seneste 12 uger. Varianter, deload, taper og aflastning er udeladt.'),
    h('p', null, 'En ret linje gennem ugemaksima fremskrives til datoen. Mindst 8 uger med data og mindst 8 ugers dataspænd; seneste sæt højst 14 dage gammelt. Højst 8 uger fra seneste sæt til stævne.'),
    h('p', null, 'Intervallet er en forsigtig modelmargin med mindst 5 % grundmargin, som vokser med spredning og afstand. Det er ikke et statistisk kalibreret konfidensinterval. Ændringer i teknik, kropsvægt og dagsform indgår ikke. Prognosen ændrer ikke dit program.')))
}
