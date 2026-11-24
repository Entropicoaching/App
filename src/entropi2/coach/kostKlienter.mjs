// Ordre 2103 (Marc 24. nov.: "kost kan købes alene"): en kostklient har en sendt kostuge og intet program.
// Samme regel som atletens egen læsning (laesninger.js, 42 dage); intet nyt felt, ingen migration.
// En læsefejl eller manglende tabel giver ingen kostklienter, så coachens forside er som før.
export const KOST_KLIENT_DAGE = 42
export const civil = day => typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day)

export async function laesKostKlienter(client, athleteIds, day) {
  if (!client || typeof client.from !== 'function' || !civil(day) || !Array.isArray(athleteIds) || !athleteIds.length) return new Set()
  const fra = new Date(Date.parse(`${day}T00:00:00Z`) - KOST_KLIENT_DAGE * 86400000).toISOString().slice(0, 10)
  try {
    const { data, error } = await client.from('kostplan_v1_plans').select('athlete_id')
      .in('athlete_id', athleteIds).eq('status', 'godkendt').gte('valid_from', fra).limit(1000)
    if (error || !Array.isArray(data)) return new Set()
    return new Set(data.map(row => row?.athlete_id).filter(id => typeof id === 'string'))
  } catch {
    return new Set()
  }
}

// Kostklient på coachsiden: kostpakken er sendt, og ingen uge har øvelser.
export const harProgram = weeks => Array.isArray(weeks) && weeks.some(w => w && Number(w.exercise_count) > 0)
export const erKostKlient = (athlete, weeks) => athlete?.kostPakke === true && !harProgram(weeks)
