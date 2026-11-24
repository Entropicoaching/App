import { kostKlient } from '../../athlete/kostValg.mjs'
import { fremgangLogsQuery } from '../../fremgangLogs.js'

// Ordre 2132 (Marc 24. nov.: "kost kan købes alene"): en kostklient har kostpakke og hverken uge eller løftehistorik.
// Beskeder skal ikke tilbyde træningsknapper til den, men kun når læsningen er sikker: fejl, ukendt klient eller
// manglende kostPakke giver aldrig skjulte knapper. Kun ren læsning med de eksisterende former (weeks som i
// laesninger.js fetchProgram, exercise_logs som Fremgang), og kun for atleter med kostPakke === true.
export async function laesSkjulTraening(client, athlete) {
  if (athlete?.kostPakke !== true || typeof athlete.id !== 'string' || !athlete.id) return false
  if (!client || typeof client.from !== 'function') return false
  try {
    const uger = await client.from('weeks').select('*, sessions(*, exercises(*))')
      .eq('athlete_id', athlete.id).order('week_number', { ascending: true }).limit(1)
    if (uger?.error || !Array.isArray(uger?.data)) return false
    if (uger.data.length > 0) return false
    const logs = await fremgangLogsQuery(client, athlete.id, { fra: 0, til: 0 })
    if (logs?.error || !Array.isArray(logs?.data)) return false
    return kostKlient(athlete, logs.data.length > 0)
  } catch {
    return false
  }
}
