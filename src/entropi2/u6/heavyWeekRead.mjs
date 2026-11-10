import { heavyWeekFrom } from './heavyWeek.mjs'
import { L4_LOG_COLUMNS } from '../u3/readAthleteU3.mjs'

// U6 del 3: én læsning af exercise_logs for én atlet, kun når readiness allerede falder.
// Samme tabel og kolonner som U3's læsning plus id, så weeklyLoad tæller hvert sæt for sig, også når
// samme øvelsesrække er logget flere dage. Rammer den loftet eller fejler, vises intet forslag.
export const HEAVY_WEEK_CAP = 1500

export async function readHeavyWeekLogs({ client, athleteId, day } = {}) {
  const from = heavyWeekFrom(day)
  if (!client || typeof client.from !== 'function' || typeof athleteId !== 'string' || !athleteId || !from) return null
  try {
    const result = await client.from('exercise_logs').select(`id, ${L4_LOG_COLUMNS}`).eq('athlete_id', athleteId)
      .gte('logged_at', `${from}T00:00:00Z`).order('logged_at').limit(HEAVY_WEEK_CAP + 1)
    if (result?.error || !Array.isArray(result?.data) || result.data.length > HEAVY_WEEK_CAP) return null
    return result.data
  } catch { return null }
}
