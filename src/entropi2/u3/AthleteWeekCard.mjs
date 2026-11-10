import * as React from 'react'

// Hooks hentes via navnerummet: Analysis' lukkede prøveharness erstatter 'react'
// med en fixture, der kun har createElement. Komponenten monteres kun med U3-flaget.
const h = React.createElement
import { calendarDay } from '../../calendarDate.js'
import { readAthleteU3Shared } from './readAthleteU3.mjs'
import { athleteWeekCardModel, COUPLING_PENDING } from './athleteWeekModel.mjs'

// Samme kort, farver og typografi som Fremgangs øvrige Entropi 2-kort.
export const card = { padding: 20, marginBottom: 16, border: '1px solid #414139', borderRadius: 16, background: '#1c1c18' }
const row = { display: 'grid', gridTemplateColumns: 'minmax(5.5rem, auto) 1fr', gap: 8, paddingBlock: 4, lineHeight: 1.5 }

// Ren visning af ugekortet og udviklingen. Er alle fire linjer under minimum,
// vises "Min uge" ikke.
export function AthleteWeekCardView({ model }) {
  if (!model) return null
  return h('div', { 'data-u3-athlete-top': true },
    model.showCard && h('section', { 'aria-label': 'Min uge', 'data-u3-week-card': true, style: card },
      h('h2', { style: { fontSize: '1.15rem', marginTop: 0 } }, model.label),
      ...model.lines.map(line => h('div', { key: line.key, 'data-u3-line': line.key, style: row },
        h('strong', null, line.label), h('span', null, line.text))),
      model.sentence && h('p', { 'data-u3-coupling': true, style: { lineHeight: 1.6, marginBottom: 0 } }, model.sentence)),
    model.showCard && !model.sentence && h('p', { 'data-u3-coupling-pending': true, style: { lineHeight: 1.6, opacity: 0.8 } }, COUPLING_PENDING),
    model.strength && h('section', { 'aria-label': 'Udvikling', 'data-u3-strength': true, style: card },
      h('h2', { style: { fontSize: '1.15rem', marginTop: 0 } }, 'Udvikling'),
      ...model.strength.lifts.map(line => h('div', { key: line.key, 'data-u3-lift': line.key, style: row },
        h('strong', null, line.label), h('span', null, line.text))),
      model.strength.message && h('p', { style: { lineHeight: 1.6, marginBottom: 0 } }, model.strength.message)))
}

// Monteres kun, når U3-flaget er tændt og der er en klient. L4 køres, når
// Fremgang åbnes. Indtil svaret er kommet, vises intet (ingen tomme tal).
export default function AthleteWeekCard({ client, athlete, now, weightLogs, fremgangLogs, strengthUnavailable }) {
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
  const model = athleteWeekCardModel({ today, athlete, data, weightLogs,
    fremgangLogs: strengthUnavailable ? null : fremgangLogs, now: now ?? new Date() })
  return h(AthleteWeekCardView, { model })
}
