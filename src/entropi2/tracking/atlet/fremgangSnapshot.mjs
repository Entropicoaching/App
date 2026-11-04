import { calendarDay, addCalendarDays } from '../../../calendarDate.js'

// Projection of a complete daily source; readiness retains its own native scale.
// Host identity and last completed Copenhagen day own the scope. No IO.
export function fremgangSnapshot(props = {}) {
  if (props.enabled !== true) return null
  const { athleteId, now, snapshot } = props
  const today = now == null ? null : calendarDay(now), endDate = today && addCalendarDays(today, -1)
  if (typeof athleteId !== 'string' || !athleteId.trim() || !endDate) return { status: 'unavailable' }
  if (snapshot == null) return { status: 'unavailable' }
  if (snapshot.athleteId !== athleteId || snapshot.endDate !== endDate) return { status: 'unavailable' }
  if (snapshot.status === 'loading') return { status: 'loading' }
  if (snapshot.status !== 'ready' || snapshot.complete !== true) return { status: 'error' }
  // These empty collections are deliberately outside this wellbeing-only view.
  // Training, nutrition and weight retain their existing Mine data presentation.
  return { status: 'ready', complete: true, athleteId, endDate,
    dailyRows: snapshot.dailyRows, dailySource: snapshot.dailySource, exerciseLogs: [], mealRows: [], weightRows: [] }
}
