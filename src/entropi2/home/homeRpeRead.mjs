const dayOf = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Copenhagen', year: 'numeric', month: '2-digit', day: '2-digit' })
const given = v => v != null && String(v).trim() !== ''

// Ordre 1594: ét opslag af atletens egne sæt (kun rpe og dato, ingen sprungne, de nyeste 60). Sandt, når den
// seneste loggede dag har RPE i mindst ét sæt. Hver fejl giver false, så passet opfører sig som før.
// Samme klient og RLS som resten af Hjem; klienten hentes først ved kald, aldrig ved import.
export async function readHomeRpeLastTime({ athleteId, client } = {}) {
  if (typeof athleteId !== 'string' || !athleteId.trim()) return false
  try {
    const database = client ?? (await import('../../supabase.js')).supabase
    const page = await database.from('exercise_logs').select('rpe_actual,logged_at')
      .eq('athlete_id', athleteId).eq('skipped', false).order('logged_at', { ascending: false }).limit(60)
    if (page?.error || !Array.isArray(page?.data)) return false
    let latest = null, used = false
    for (const row of page.data) {
      const at = Date.parse(row?.logged_at)
      if (!Number.isFinite(at)) continue
      const day = dayOf.format(at)
      if (latest == null || day > latest) { latest = day; used = false }
      if (day === latest && given(row.rpe_actual)) used = true
    }
    return used
  } catch { return false }
}
