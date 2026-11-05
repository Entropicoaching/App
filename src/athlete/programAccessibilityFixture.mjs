// Public synthetic fixture: deliberately repeated pass/lift names and set numbers.
import { programQolFixture } from './programQolFixture.mjs'

export function accessibilityFixture(extra = {}) {
  const props = programQolFixture({ progOpenSession: 'session-1-0', exWarmupExpanded: new Set() })
  const week = props.allWeeks[1]
  week.start_date = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Copenhagen' })
  for (const session of week.sessions) {
    session.title = 'Testpas'
    session.exercises = [1, 2].map(index => ({ id: `${session.id}-row-${index}`, name: 'Squat',
      sets: 2, reps: '5', intensity: 'RPE 8' }))
  }
  return { ...props, ...extra }
}

export const sessionName = index => `Testpas · pas ${index}, uge 1`
export const setName = (exercise, set, session = 1) => `${sessionName(session)}, Squat, øvelse ${exercise}, sæt ${set}`
export const inputKey = (exercise, set) => `session-1-0-row-${exercise}_${set}`
export const completeLogs = () => [1, 2].flatMap(exercise => [1, 2].map(set => ({
  exercise_id: `session-1-0-row-${exercise}`, set_number: set, weight: 80, reps_completed: 5,
})))
