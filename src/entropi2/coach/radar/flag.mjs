// Separate release switch. No URL, storage, environment or implicit Entropi 2 opt-in.
export const DEFAULT_COACH_RADAR = false
export function coachRadarEnabled(value) {
  return value === undefined ? DEFAULT_COACH_RADAR === true : value === true
}
