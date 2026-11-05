import { antalOrd } from '../../antalOrd.mjs'
import { createElement as h } from 'react'
import { blokslutModel, formatBlokslutNumber as number } from './blokslutModel.mjs'

const date = day => day.split('-').reverse().join('.')
const style = { color: '#edeae2', background: '#141410', padding: 16, width: '100%',
  maxWidth: 480, minWidth: 0, boxSizing: 'border-box', overflowWrap: 'anywhere',
  fontFamily: 'Arial, sans-serif', lineHeight: 1.6 }

// Leaf only; caller must explicitly opt in. OFF reads no snapshot or clock.
export default function BlokslutView(props = {}) {
  if (props.entropi2 !== true) return null
  const m = blokslutModel(props)
  const heading = h('h2', null, 'Din blok i overblik')
  if (m.status !== 'ready') return h('section', { 'aria-label': 'Din blok i overblik', style }, heading,
    h('p', { role: m.status === 'error' ? 'alert' : 'status' }, m.message))
  return h('section', { 'aria-label': 'Din blok i overblik', 'data-entropi2-blokslut': true, style }, heading,
    h('p', null, `${date(m.start)} til ${date(m.through)}${m.through < m.end ? ' · Blokken er ikke afsluttet endnu.' : ''}`),
    h('p', null, `Pas gennemført: ${number(m.completed)} af ${number(m.planned)} planlagt til og med den seneste blokuge.`),
    m.confirmed === 0 && h('p', null, 'Ingen bekræftede træningssæt i blokken endnu.'),
    m.uncertain && h('p', { role: 'status' }, 'Nogle sæt er afventende, ugyldige eller modstridende. Opgørelsen er ufuldstændig.'),
    h('h3', null, 'Styrke fra blokstart til nu'),
    h('ul', { style: { paddingLeft: 20 } }, ...m.lifts.map(row => h('li', { key: row.lift },
      `${row.lift}: ${row.delta === null ? row.message
        : `${number(row.baseline.value)} → ${number(row.current.value)} kg e1RM (${row.delta > 0 ? '+' : ''}${number(row.delta)} kg).`}`))),
    h('h3', null, 'Ét fokus til næste blok'), h('p', null, m.focus),
    h('details', null,
      h('summary', { style: { minHeight: 44, paddingTop: 8, boxSizing: 'border-box', cursor: 'pointer' } }, 'Volumen pr. uge og beregning'),
      h('ul', { style: { paddingLeft: 20 } }, ...m.weeks.map((w, i) => h('li', { key: w.start },
        `Uge ${i + 1} (${date(w.start)}–${date(w.end)}): ${w.tonnage === null ? 'Volumen kan ikke opgøres sikkert.'
          : w.sets === 0 ? 'Ingen bekræftede sæt.' : `${number(w.tonnage)} kg løftet · ${number(w.sets)} sæt.`}`))),
      h('p', null, 'e1RM er et beregnet enrepetitionsmaksimum, ikke en testet rekord. Bedste tunge sæt i første og seneste blokuge sammenlignes kun i samme rep-område. Varianter, lette sæt, deload og taper indgår ikke i styrketallene.'),
      ...m.lifts.filter(row => row.delta !== null).map(row => h('p', { key: row.lift },
        `${row.lift}: startsæt ${date(row.baseline.date)}, seneste sæt ${date(row.current.date)} · ${row.baseline.zone} ${antalOrd(row.baseline.zone, 'gentagelse', 'gentagelser')}.`)),
      h('p', null, 'Volumen er summen af registrerede kg × gentagelser for alle øvelser, også lette sæt og deload. Uger tælles fra blokkens start. Et pas er gennemført, når alle planlagte sæt er bekræftet med gyldige målinger; oversprungne sæt tæller ikke som gennemført. Manglende logning beviser ikke manglende træning. Programmet ændres ikke.')))
}
