import { analyseAtlet1Enabled, renderAnalyseAtlet1 } from './analyseAtlet1.mjs'
import { renderBlockStrength } from './blokStyrke.mjs'
import { createElement as h, useState } from 'react'
import FremgangTab from './FremgangTab.jsx'
import EnkelFremgangTab from './EnkelFremgangTab.jsx'
import { s } from '../athleteShared.js'
import { fokusModel } from './fremgangFokusModel.mjs'

const kg = value => String(value).replace('.', ',')
const date = value => value.split('-').reverse().join('.')
const control = { minHeight: 44, padding: '0.65rem', cursor: 'pointer', color: '#edeae2', background: '#24241f', border: '1px solid #777267', font: 'inherit' }
function liftText(points) {
  const first = points[0], last = points.at(-1)
  if (!last) return 'Ingen tunge sæt endnu.'
  const value = `e1RM ${kg(last.e1rm)} kg den ${date(last.dag)}.`
  if (points.length === 1) return value + ' Første måling. Flere træningsdage viser udviklingen.'
  const delta = last.e1rm - first.e1rm
  return `${value} ${delta > 0 ? '+' : ''}${kg(delta)} kg siden ${date(first.dag)}.`
}
function curve(points) {
  if (points.length < 2) return null
  const min = Math.min(...points.map(p => p.e1rm)), max = Math.max(...points.map(p => p.e1rm))
  const coordinates = points.map((p, i) => `${8 + i * 284 / (points.length - 1)},${52 - (p.e1rm - min) * 44 / (max - min || 1)}`).join(' ')
  return h('svg', { viewBox: '0 0 300 60', 'aria-hidden': true, style: { width: '100%', height: 60 } },
    h('polyline', { points: coordinates, fill: 'none', stroke: '#c8923a', strokeWidth: 2 }))
}
function LegacyFremgangFokus(props) {
  const [showWeight, setShowWeight] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const model = fokusModel(props)
  const Legacy = props.enkelOn === true ? EnkelFremgangTab : FremgangTab
  const latestWeight = model.weights.at(-1)
  return h('section', { 'aria-label': 'Dit fremgangsoverblik' },
    h('h1', null, 'Din fremgang'),
    renderBlockStrength(h, { ...props, enabled: props.blokStyrke === true && props.enkelDel !== 'rekorder', loading: props.fremgangLoading }),
    h('section', { style: s.card, 'aria-label': 'Hovedløftenes udvikling' },
      h('h2', null, 'Bliver du stærkere?'),
      props.fremgangLoading ? h('p', { role: 'status' }, 'Henter løftehistorik…')
        : props.fremgangLogs == null ? h('p', null, 'Løftehistorikken er ikke klar endnu.')
        : model.lifts.map(lift => h('article', { key: lift.key, 'data-fokus-loeft': lift.key },
          h('h3', null, lift.label), h('p', null, liftText(lift.points)), curve(lift.points))),
      h('p', null, 'e1RM er et skøn over det tungeste, du kunne løfte én gang. Kun tunge sæt på højst 8 reps tæller med.')),
    h('section', { style: s.card, 'aria-label': 'Ugens gennemførte sæt' },
      h('h2', null, 'Ugens gennemførte sæt'),
      h('p', { 'data-fokus-saet': true }, props.currentWeek ? `${model.completed} sæt gennemført i programuge ${props.currentWeek.week_number ?? ''}.` : 'Ingen programuge endnu.'),
      h('p', null, 'Sæt fra den aktuelle programuge, også lokale sæt der venter på net. Sprungne sæt tæller ikke med.')),
    h('label', { style: { display: 'flex', alignItems: 'center', gap: 8, minHeight: 44 } },
      h('input', { type: 'checkbox', checked: showWeight, onChange: event => setShowWeight(event.target.checked === true), style: { width: 24, height: 24 } }), 'Vis kropsvægt i overblikket'),
    showWeight && h('section', { style: s.card, 'aria-label': 'Kropsvægt' },
      h('h2', null, 'Kropsvægt'),
      h('p', null, latestWeight ? `${kg(latestWeight.weight)} kg den ${date(latestWeight.day)}.` : 'Ingen vejninger endnu.'),
      model.weights.length > 1 && h('p', null, `${kg(Math.round((latestWeight.weight - model.weights[0].weight) * 10) / 10)} kg siden ${date(model.weights[0].day)}.`)),
    h('button', { type: 'button', 'aria-expanded': expanded, style: control, onClick: () => setExpanded(value => !value) }, expanded ? 'Skjul detaljer' : 'Se alle detaljer'),
    expanded && h('section', { 'aria-label': 'Alle fremgangsdetaljer' }, h(Legacy, { ...props, blokStyrke: false, currentWeek: props.currentWeek || { sessions: [] } })))
}

// APP-ANALYSE-ATLET1: keep the legacy component and its handlers intact when off.
export default function AnalyseAtlet1Entry(props) {
  return analyseAtlet1Enabled(props) ? renderAnalyseAtlet1(h, props) : h(LegacyFremgangFokus, props)
}
