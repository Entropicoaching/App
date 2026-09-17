// ORDRE 263 · commit 2 — pausetimeren mellem sæt skal bruge "den pause der
// står i programmet" hvis coachen har skrevet den. Datamodellen ændres ikke
// (ingen ny kolonne, jf. ordren) — coachen skriver pausen i øvelsens frie
// notefelt (fx "Pause 90 sek", "hvile 2 min", "rest 1:30"). Samme
// regex-stil som ProgramTab.jsx's parseDuration for tids-øvelser, men kun
// når ordet pause/hvile/rest går forud — ellers ville en plankes egen
// holdetid i intensity/reps aldrig kunne skelnes fra en pause-instruktion.
// Ingen match → en fornuftig standardpause.
const DEFAULT_REST_SECONDS = 90

export function parseRestSecondsFromNote(note) {
  if (!note) return null
  const scoped = String(note).toLowerCase().match(/(?:pause|hvile|rest)\D{0,8}(.+)/)
  if (!scoped) return null
  const tail = scoped[1]
  let m = tail.match(/^(\d+):(\d{2})/)
  if (m) return +m[1] * 60 + +m[2]
  m = tail.match(/^(\d+(?:[.,]\d+)?)\s*min/)
  if (m) return Math.round(parseFloat(m[1].replace(',', '.')) * 60)
  m = tail.match(/^(\d+)\s*(?:sek|sec|s)\b/)
  if (m) return +m[1]
  return null
}

export function restSecondsForExercise(ex) {
  return parseRestSecondsFromNote(ex?.note) ?? DEFAULT_REST_SECONDS
}
