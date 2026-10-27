import { filterVideoQueue, videoQueueItems, videoQueueOptions } from './videoQueueFilter.mjs'

const liftLabels = { squat: 'Squat', bench: 'Bænkpres', deadlift: 'Dødløft' }
const controlStyle = { minHeight: 44, maxWidth: '100%', fontSize: '1rem' }

export default function VideoQueueFilter({ items, hiddenAthleteIds, filters, setFilters, error, refreshing, refresh, renderItem }) {
  const { athleteId, lift } = filters
  const queue = videoQueueItems(items, hiddenAthleteIds)
  const options = videoQueueOptions(queue)
  const filtered = filterVideoQueue(queue, athleteId, lift)
  return (
    <section aria-label="Videokø" style={{ marginBottom: '1rem', padding: '0.85rem', border: '1px solid #7a7770' }}>
      <h2 style={{ fontSize: '1.1rem', marginTop: 0 }}>Videokø</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'end' }}>
        <label style={{ display: 'grid', gap: '0.3rem', maxWidth: '100%' }}>
          Atlet
          <select value={athleteId} onChange={event => setFilters({ ...filters, athleteId: event.target.value })} style={controlStyle}>
            <option value="">Alle atleter</option>
            {athleteId && !options.athletes.some(athlete => athlete.id === athleteId) && <option value={athleteId}>Valgt atlet har ingen videoer</option>}
            {options.athletes.map(athlete => <option key={athlete.id} value={athlete.id}>{athlete.name}</option>)}
          </select>
        </label>
        <label style={{ display: 'grid', gap: '0.3rem', maxWidth: '100%' }}>
          Løft
          <select value={lift} onChange={event => setFilters({ ...filters, lift: event.target.value })} style={controlStyle}>
            <option value="">Alle løft</option>
            {lift && !options.lifts.includes(lift) && <option value={lift}>Valgt løft har ingen videoer</option>}
            {options.lifts.map(value => <option key={value} value={value}>{liftLabels[value] || value}</option>)}
          </select>
        </label>
        <button type="button" disabled={!athleteId && !lift} onClick={() => setFilters({ athleteId: '', lift: '' })} style={controlStyle}>Nulstil filtre</button>
      </div>
      <p role="status" aria-live="polite">Viser {filtered.length} af {queue.length} videoer</p>
      {error && <div role="alert">Videokøen kunne ikke opdateres. Listen kan være forældet. <button type="button" disabled={refreshing} onClick={refresh} style={controlStyle}>Prøv igen</button></div>}
      {filtered.length === 0 && <p>{queue.length === 0 ? 'Ingen videoer i den hentede kø.' : 'Ingen videoer matcher filtrene.'}</p>}
      <div style={{ display: 'grid', gap: '0.4rem' }}>{filtered.map(renderItem)}</div>
    </section>
  )
}
