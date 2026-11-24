// Ordre 2103 (Marc 24. nov.: "kost kan købes alene"): en kostklient har en sendt kostuge og intet program.
// Samme regel som atletens egen læsning (laesninger.js, 42 dage); intet nyt felt, ingen migration.
// En læsefejl eller manglende tabel giver ingen kostklienter, så coachens forside er som før.
export const KOST_KLIENT_DAGE = 42
export const civil = day => typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day)

// Svaret er et Map: atlet-id til { sendtTil, kladde }. sendtTil er sidste dag i en sendt (godkendt) kostuge, kladde er sand,
// når der ligger en plan, coachen ikke har sendt (forslag). Hvem er solgt kost uden en sendt uge, kan kun ses på kladden.
export async function laesKostKlienter(client, athleteIds, day) {
  if (!client || typeof client.from !== 'function' || !civil(day) || !Array.isArray(athleteIds) || !athleteIds.length) return new Map()
  const fra = new Date(Date.parse(`${day}T00:00:00Z`) - KOST_KLIENT_DAGE * 86400000).toISOString().slice(0, 10)
  try {
    const { data, error } = await client.from('kostplan_v1_plans').select('athlete_id,status,valid_from')
      .in('athlete_id', athleteIds).in('status', ['forslag', 'godkendt']).gte('valid_from', fra).limit(1000)
    if (error || !Array.isArray(data)) return new Map()
    const ud = new Map()
    for (const row of data) {
      if (typeof row?.athlete_id !== 'string') continue
      const nu = ud.get(row.athlete_id) || { sendtTil: null, kladde: false }
      if (row.status === 'godkendt' && civil(row.valid_from) && (nu.sendtTil == null || row.valid_from > nu.sendtTil)) nu.sendtTil = row.valid_from
      else if (row.status === 'forslag') nu.kladde = true
      ud.set(row.athlete_id, nu)
    }
    return ud
  } catch {
    return new Map()
  }
}

// Kostklient på coachsiden: kostpakken er sendt, og ingen uge har øvelser.
export const harProgram = weeks => Array.isArray(weeks) && weeks.some(w => w && Number(w.exercise_count) > 0)
export const erKostKlient = (athlete, weeks) => athlete?.kostPakke === true && !harProgram(weeks)

// Ordre 2113: hvad coachen mangler for en kostklient. 'foerste': kun en kladde, intet sendt. 'ny': sidste sendte dag er forbi.
// Intet program er en forudsætning; atleter med program følger træningsreglerne. Uden kladde kan en solgt kostklient ikke kendes.
export function kostMangler(athlete, weeks, day) {
  if (!athlete || harProgram(weeks) || !civil(day)) return null
  if (athlete.kostPakke === true) return civil(athlete.kostSendtTil) && athlete.kostSendtTil < day ? 'ny' : null
  return athlete.kostKladde === true ? 'foerste' : null
}
