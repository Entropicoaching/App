import { today, dateLabel } from '../athleteShared'
import { kostDage } from './kostVisning.js'

export default function KostHistorik({ logs }) {
  const days = kostDage(logs, today())
  return <section className="kost-card" aria-labelledby="kost-historik">
    <h2 id="kost-historik">Kosthistorik</h2>
    {days.length ? <table style={{ width: '100%', textAlign: 'left' }}>
      <caption>Loggede kalorier pr. dato</caption>
      <thead><tr><th scope="col">Dato</th><th scope="col">kcal</th></tr></thead>
      <tbody>{days.map(day => <tr key={day.date}>
        <th scope="row">{dateLabel(day.date)}</th>
        <td>{day.kcal === null ? 'Ukendt' : day.kcal.toLocaleString('da-DK', { maximumFractionDigits: 1 })}</td>
      </tr>)}</tbody>
    </table> : <p className="kost-muted">Ingen kosthistorik at vise endnu.</p>}
  </section>
}
