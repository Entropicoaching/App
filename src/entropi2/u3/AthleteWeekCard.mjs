import * as React from 'react'

// Hooks hentes via navnerummet: Analysis' lukkede prøveharness erstatter 'react'
// med en fixture, der kun har createElement. Komponenten monteres kun med U3-flaget.
const h = React.createElement
import { calendarDay } from '../../calendarDate.js'
import { readAthleteU3Shared } from './readAthleteU3.mjs'
import { athleteWeekCardModel } from './athleteWeekModel.mjs'

import { formatNumber, signed } from './format.mjs'
import { Bars, Dots, FocusBox, Sparkline } from './charts.mjs'

// Samme kort, farver og typografi som Fremgangs øvrige Entropi 2-kort.
export const card = { padding: 20, marginBottom: 16, border: '1px solid #414139', borderRadius: 16, background: '#1c1c18' }
const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))', gap: 10 }
const tile = { padding: 10, border: '1px solid #2f2f29', borderRadius: 12, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }
const small = { fontSize: 13, lineHeight: 1.35, color: '#c1beb5' }
const big = { fontSize: 20, fontWeight: 700, lineHeight: 1.15, color: '#edeae2' }

// U3b: hver linje som lille kort med ét tal og en graf. Teksten fra modellen
// står i aria-label, så skærmlæsere får hele sætningen.
function tileParts(line) {
  if (line.key === 'training') {
    const tons = line.text.split(' · ')[1]
    return { value: `${line.done}/${line.planned} pas`, sub: tons ? `${tons} løftet` : null,
      chart: h(Dots, { done: line.done, total: line.planned, label: `${line.done} af ${line.planned} pas gennemført` }) }
  }
  if (line.key === 'nutrition') {
    const target = line.proteinTarget
    return { value: `${line.days}/7 dage`,
      sub: typeof line.proteinAverage === 'number' ? `${formatNumber(Math.round(line.proteinAverage))} g protein${target ? ` · mål ${formatNumber(target)}` : ''}` : null,
      chart: h(Bars, { values: line.series ?? [], target, good: v => !target || v >= 0.9 * target,
        label: 'Protein pr. dag mandag til søndag. Stiplet linje er dit mål.' }) }
  }
  if (line.key === 'weight') {
    return { value: `${formatNumber(line.average, 1)} kg`,
      sub: `${signed(line.kg)} kg/uge${line.onTrack === true ? ' · mod målet' : line.onTrack === false ? ' · ikke mod målet' : ''}`,
      chart: h(Sparkline, { values: line.series ?? [], label: 'Vægt de seneste 28 dage', color: line.onTrack === false ? '#da9d8e' : '#8ab5bc' }) }
  }
  if (line.key === 'readiness') {
    return { value: formatNumber(Math.round(line.average)), sub: 'readiness i snit',
      chart: h(Bars, { values: line.series ?? [], label: 'Readiness pr. dag mandag til søndag' }) }
  }
  return { value: line.text, sub: null, chart: null }
}

// Ren visning af ugekortet. Er alle fire linjer under minimum, vises "Min uge" ikke.
// Styrke vises i "Din udvikling" lige nedenunder, ikke her (U3b: ingen dobbelt e1RM).
export function AthleteWeekCardView({ model }) {
  if (!model) return null
  return h('div', { 'data-u3-athlete-top': true },
    model.showCard && h('section', { 'aria-label': 'Min uge', 'data-u3-week-card': true, style: card },
      h('h2', { style: { fontSize: '1.15rem', marginTop: 0 } }, model.label),
      h(FocusBox, { focus: model.focus }),
      h('div', { style: grid }, ...model.lines.map(line => {
        const part = tileParts(line)
        return h('div', { key: line.key, 'data-u3-line': line.key, 'aria-label': `${line.label}: ${line.text}`, style: tile },
          h('span', { style: small }, line.label),
          h('strong', { style: big }, part.value),
          part.sub && h('span', { style: small }, part.sub),
          part.chart)
      })),
      model.sentence && h('p', { 'data-u3-coupling': true, style: { ...small, fontSize: 14, marginBottom: 0, marginTop: 12 } }, model.sentence)))
}

// Monteres kun, når U3-flaget er tændt og der er en klient. L4 køres, når
// Fremgang åbnes. Indtil svaret er kommet, vises intet (ingen tomme tal).
export default function AthleteWeekCard({ client, athlete, now, weightLogs }) {
  const today = calendarDay(now ?? new Date())
  const [data, setData] = React.useState(null)
  React.useEffect(() => {
    let live = true
    setData(null)
    if (!client || !athlete?.id || !today) return undefined
    readAthleteU3Shared(client, athlete.id, today).then(result => { if (live) setData(result) }, () => {})
    return () => { live = false }
  }, [client, athlete?.id, today])
  if (!data || data.day !== today) return h('div', { 'data-u3-athlete-top': true })
  const model = athleteWeekCardModel({ today, athlete, data, weightLogs, now: now ?? new Date() })
  return h(AthleteWeekCardView, { model })
}
