import { createElement as h } from 'react'
import { mineDataModel, mineDataVisibility } from './mineDataModel.mjs'

const number = new Intl.NumberFormat('da-DK', { maximumFractionDigits: 1 })
const date = value => value.split('-').reverse().join('.')
const styles = {
  page: { maxWidth: 480, margin: '0 auto', padding: 20, boxSizing: 'border-box',
    overflowWrap: 'anywhere', fontFamily: "'IBM Plex Sans', Arial, sans-serif", color: '#edeae2' },
  card: { border: '1px solid #414139', borderRadius: 16, padding: 20, marginBottom: 16, background: '#1c1c18' },
  title: { fontFamily: "'Playfair Display', Georgia, serif", fontSize: 32, margin: '0 0 12px' },
  heading: { fontSize: 20, margin: '0 0 12px' },
  text: { fontSize: 16, lineHeight: 1.5, margin: '8px 0', color: '#b8b4a8' },
}
const text = value => h('p', { style: styles.text }, value)
const card = (key, heading, ...children) => h('section', { key, style: styles.card, 'aria-label': heading },
  h('h3', { style: styles.heading }, heading), ...children)

// The host owns feature gating, identity and data reads.
export default function MineData(props = {}) {
  const model = mineDataModel(props)
  const { sessions, records, nutrition, weight } = model
  const visible = mineDataVisibility(model, props.showRecords !== false)
  if (!Object.values(visible).some(Boolean)) return null
  const lifts = records.lifts.slice(0, 3)
  return h('section', { style: styles.page, 'aria-label': 'Mine data' },
    h('h2', { style: styles.title }, 'Mine data'),
    text(`Seneste 4 uger · ${date(model.start)} til ${date(model.end)} (begge dage med).`),
    visible.error && h('p', { role: 'alert', style: styles.text }, 'Dine registreringer kunne ikke hentes. Prøv at åbne analyse igen.'),
    visible.sessions && card('sessions', props.sessionsLabel ?? (props.sessionsNote ? 'Pas i den viste programuge' : 'Pas gennemført'),
      text(`${sessions.completed} registrerede, gennemførte pas.`),
      text('Kun færdigregistrerede pas tæller med. Delvise og oversprungne pas er udeladt.')),
    visible.records && card('records', 'Rekorder i perioden',
      h('ul', { style: { paddingLeft: 20, lineHeight: 1.6 } }, ...lifts.map(lift =>
        h('li', { key: lift.exerciseId }, `${lift.exercise}: ${number.format(lift.weightKg)} kg × ${lift.reps} · ${date(lift.date)}`))),
      records.lifts.length > 3 ? text(`Viser 3 af ${records.lifts.length} øvelser.`) : null,
      text('Bedste registrerede sæt pr. øvelse i de 4 uger: højeste vægt, derefter flest gentagelser. Det er ikke en livstidsrekord.')),
    visible.nutrition && card('nutrition', 'Loggede kostdage', text(`${nutrition.loggedDays} registrerede dage af 28.`),
      text('Dage med en kostlog er ikke nødvendigvis hele kostdage.')),
    visible.nutrition && nutrition.assessedDays > 0 && card('nutrition-goals', 'Kostdage mod mål',
      text(`${nutrition.goalDays} af ${nutrition.assessedDays} kostdage med vurderbart mål nåede dagens mål.`),
      text('Kun registrerede dage med kendt målstatus indgår i sammenligningen.')),
    visible.weight && card('weight', 'Kropsvægt',
      text(`${weight.recordedDays} dage med registreret kropsvægt.`),
      h('ul', { style: { paddingLeft: 20, lineHeight: 1.6 } }, ...weight.weeks.filter(week => week.kg !== null).map(week =>
        h('li', { key: week.start }, `${date(week.start)}–${date(week.end)}: ${number.format(week.kg)} kg (${week.count} dage)`))),
      weight.deltaKg !== null && text(`Forskel mellem gennemsnit for perioderne fra ${date(weight.from)} og ${date(weight.to)}: ${number.format(Math.abs(weight.deltaKg) < 0.05 ? 0 : weight.deltaKg)} kg.`),
      text('Gennemsnit i perioder på 7 dage. Manglende målinger udfyldes ikke. Ændringen beskriver registreringerne.')))
}
