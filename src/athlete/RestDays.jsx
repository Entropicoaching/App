import { restDays, restDate, REST_WEEKDAYS } from './restDays.mjs'

export default function RestDays({ week, weekStart }) {
  const days = restDays(week)
  if (!days.length) return null
  return (
    <section aria-label="Ugens hviledage" style={{ margin: '0.75rem 0 1.25rem', color: '#a9a69e' }}>
      {days.map(day => (
        <div key={day.weekday} data-hviledag={day.weekday} style={{ padding: '0.65rem 0', borderBottom: '1px solid rgba(237,234,226,0.07)', overflowWrap: 'anywhere', lineHeight: 1.5 }}>
          <div style={{ fontSize: '0.85rem', color: '#edeae2' }}>{REST_WEEKDAYS[day.weekday]}{restDate(weekStart, day.weekday) ? ` · ${restDate(weekStart, day.weekday)}` : ''} · Hviledag</div>
          <div style={{ fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>{day.text}</div>
        </div>
      ))}
    </section>
  )
}
