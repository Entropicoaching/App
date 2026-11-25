import { calendarDay } from '../../../calendarDate.js'
import { laesSkjulTraening } from '../../conversation/kostKlientLaesning.mjs'

// Ordre 2145 (Marc 24. nov.: "1 ja til alle tre"): dagen efter den sendte kostuges sidste dag, og indtil en ny uge er sendt,
// ser kostklienten "Ny kostuge er på vej fra Marc" i stedet for en tom Kost. Kost forsvinder ikke i hullet: kostPakke gælder
// 42 dage fra en godkendt plans start (laesKostPakke), så atleten er stadig kostklient.
export const NY_KOSTUGE_TEKST = 'Ny kostuge er på vej fra Marc'

// Kun ren læsning med de eksisterende former (kostplan_v1_plans som i laesKostPakke). Hullet er der, når ingen godkendt plan
// starter i dag eller senere. Læsefejl, ukendt klient eller manglende tabel giver aldrig teksten (false).
export async function laesNyKostuge(client, athleteId, today) {
  if (typeof athleteId !== 'string' || !athleteId || calendarDay(today) !== today) return false
  if (!client || typeof client.from !== 'function') return false
  try {
    const { data, error } = await client.from('kostplan_v1_plans').select('id')
      .eq('athlete_id', athleteId).eq('status', 'godkendt').gte('valid_from', today).limit(1)
    return !error && Array.isArray(data) && data.length === 0
  } catch {
    return false
  }
}

// Hjem og Kost: uden klient hentes appens egen (som Hjems øvrige læsere). Ethvert svar er sikkert: fejl giver false.
export async function laesNyKostugeSikkert({ athleteId, today, client } = {}) {
  try {
    return await laesNyKostuge(client ?? (await import('../../../supabase.js')).supabase, athleteId, today)
  } catch {
    return false
  }
}

// Atleten er kostklient uden træning (laesSkjulTraening) og har hul efter sidste sendte dag. Kost bruger den; Hjem kender
// allerede kostklienten og bruger laesNyKostugeSikkert.
export async function laesKostHul({ athlete, today, client } = {}) {
  try {
    const database = client ?? (await import('../../../supabase.js')).supabase
    if (!(await laesSkjulTraening(database, athlete))) return { kostKlient: false, nyUge: false }
    return { kostKlient: true, nyUge: await laesNyKostuge(database, athlete.id, today) }
  } catch {
    return { kostKlient: false, nyUge: false }
  }
}
