import { summarizeKostWeek } from './kostUge.mjs'

const statuses = { logged: 'Med logning', missing: 'Ingen logning', unavailable: 'Data ikke tilgængelige', future: 'Kommende dag' }
const number = value => value === null ? '—' : value.toLocaleString('da-DK', { maximumFractionDigits: 1 })
const dateLabel = value => value.slice(8, 10) + '.' + value.slice(5, 7) + '.' + value.slice(0, 4)

export default function KostUge({ selectedDate, input }) {
  if (!input) return <section aria-label="Kostuge"><h2>Kostuge</h2><p>Ugedata er ikke tilgængelige.</p></section>
  let week
  try {
    week = summarizeKostWeek({ ...input, selectedDate })
  } catch {
    return <section aria-label="Kostuge"><h2>Kostuge</h2><p>Ugedata kunne ikke vises.</p></section>
  }
  return (
    <section aria-label="Kostuge" style={{ marginBottom: '1.5rem', color: '#edeae2' }}>
      <h2>Kostuge · {dateLabel(week.startDate)} – {dateLabel(week.endDate)}</h2>
      <p>{week.counts.logged} dage med logning · {week.counts.missing} dage uden logning · {week.counts.unavailable} dage uden datadækning · {week.counts.future} kommende dage</p>
      <p>Registrerede mængder er ikke nødvendigvis hele dagens indtag. Dage uden logning tælles ikke som nul.</p>
      { [['kcal', 'Kalorier', 'kcal'], ['protein', 'Protein', 'g']].map(([key, label, unit]) => {
        const metric = week.metrics[key]
        const pair = metric.comparison
        return <div key={key}>
          <h3>{label}</h3>
          <p>Gennemsnit af registreret mængde: {number(metric.average)} {unit} ({metric.knownDays} dage med kendte tal).</p>
          <p>Sammenlignelige dage: {pair.days}. Registreret gennemsnit: {number(pair.intakeAverage)} {unit} · gennemsnit af datoernes mål: {number(pair.targetAverage)} {unit} · forskel: {number(pair.difference)} {unit}.</p>
        </div>
      }) }
      <div style={{ overflowX: 'auto' }}>
        <table>
          <caption>Registreringer og mål for hver dato. — betyder ukendt eller ingen registreret mængde.</caption>
          <thead><tr><th scope="col">Dato</th><th scope="col">Logning</th><th scope="col">kcal / datomål</th><th scope="col">Protein g / datomål</th></tr></thead>
          <tbody>{week.days.map(day => <tr key={day.date}>
            <th scope="row">{dateLabel(day.date)}</th><td>{statuses[day.status]}</td>
            <td>{number(day.totals.kcal)} / {number(day.targets.kcal)}</td>
            <td>{number(day.totals.protein)} / {number(day.targets.protein)}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <p>Mål vises kun, når der findes et dateret målsnapshot. Sammenligningen bruger samme datoer for registreringer og mål.</p>
    </section>
  )
}
