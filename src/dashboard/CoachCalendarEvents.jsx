import { s } from '../dashboardShared'
import { coachCalendarDays } from './coachCalendarEvents.mjs'

export default function CoachCalendarEvents({ athletes, openProfile }) {
  const days = coachCalendarDays(athletes)
  return (
    <section aria-label="Stævnedatoer" style={{ ...s.card, marginBottom: '1.5rem' }}>
      <h2 style={{ ...s.cardLabel, marginTop: 0 }}>Stævnedatoer</h2>
      {days.length === 0 && <p style={{ color: '#98948a' }}>Ingen stævnedatoer angivet.</p>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '0.75rem' }}>
        {days.map(day => (
          <div key={day.date} data-coach-event-day={day.date} style={{ minWidth: 0, border: '1px solid rgba(200,146,58,0.35)', padding: '0.6rem' }}>
            <time dateTime={day.date} style={{ display: 'block', color: '#c8923a', marginBottom: '0.4rem' }}>
              {new Date(day.date + 'T12:00:00').toLocaleDateString('da-DK', { day: 'numeric', month: 'long', year: 'numeric' })}
            </time>
            {day.athletes.map(athlete => (
              <button key={athlete.id} type="button" onClick={() => openProfile(athlete, 'stævne')}
                style={{ ...s.btnGhost, display: 'block', width: '100%', minHeight: 44, whiteSpace: 'normal', overflowWrap: 'anywhere', textAlign: 'left', marginTop: '0.3rem' }}>
                {athlete.name} · Stævne
              </button>
            ))}
          </div>
        ))}
      </div>
    </section>
  )
}
