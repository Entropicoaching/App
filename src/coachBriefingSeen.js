// ORDRE 325 · commit 1 — "Set" på et punkt under "Kræver dit blik". Lukker
// hullet RAPPORT-317 (n8n) fandt: entropi_coach_briefing_v1 havde intet
// "set"-felt, så mailen kun kunne bruge alder til at afgøre om noget
// stadig venter — selv når Marc allerede havde set punktet i appen.
// public.coach_briefing_seen (supabase/sql/coach-briefing-seen-v1.sql,
// IKKE kørt af denne ordre) gemmer coach_id + punkt-nøgle + tidspunkt;
// RPC'en læser den og lægger `seen_at` på hvert punkt, så mailen kan skelne
// "gammel og stadig ventende" fra "gammel, men allerede set".
//
// Punkt-nøglen skal være STABIL for samme forekomst (samme klik i dag og i
// morgen skal ramme samme nøgle), men skal ÆNDRE SIG når der reelt er noget
// nyt at se — ellers ville "Set" dæmpe punktet for evigt. coachPriority.js's
// egen `message-<athlete>-<track>`-nøgle er ikke nok alene her: den ændrer
// sig ikke når endnu en besked ankommer på samme spor. Derfor lægges
// dato-delen af det seneste tidspunkt (UTC, samme som RPC'ens
// `at time zone 'utc'`) oveni for beskeder. Video og signal har allerede en
// stabil, entydig identitet (analysens id · atlet+detector).
export function coachBriefingPointKey(item) {
  if (!item) return null
  if (item.kind === 'signal') {
    const athleteId = item.athlete?.id
    const detector = item.signal?.o_detector
    if (!athleteId || !detector) return null
    return `signal-${athleteId}-${detector}`
  }
  if (item.kind === 'video') {
    const videoId = item.video?.id
    return videoId ? `video-${videoId}` : null
  }
  if (item.kind === 'message') {
    const athleteId = item.athlete?.id
    const track = item.track
    if (!athleteId || !track) return null
    const day = item.createdAt ? new Date(item.createdAt).toISOString().slice(0, 10) : 'ukendt-dato'
    return `message-${athleteId}-${track}-${day}`
  }
  if (item.kind === 'automation') {
    const alertId = item.alert?.id
    return alertId ? `automation-${alertId}` : null
  }
  return item.key || null
}

// Samme "kopieret, ikke stille"-princip som automationAlertResolveErrorMessage
// (src/automationAlerts.js): SQL-filen ligger kun under supabase/sql/ og
// køres først efter Marcs ja. Indtil da skal "Set" fejle synligt og pænt ved
// punktet, ikke bare ingenting gøre.
export function coachBriefingSeenErrorMessage(error) {
  const text = String(error?.message || '')
  const missing = error?.code === '42P01' || error?.code === 'PGRST205' || error?.code === 'PGRST202' ||
    /does not exist|could not find the table/i.test(text)
  if (missing) {
    return 'Kunne ikke gemme "Set": databasetabellen findes ikke endnu. Punktet forbliver som i dag.'
  }
  return text ? `Kunne ikke gemme "Set": ${text}` : 'Kunne ikke gemme "Set". Prøv igen.'
}
