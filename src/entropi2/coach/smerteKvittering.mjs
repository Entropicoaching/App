// Ordre 1711 (Marc 18. nov.: "coachens opgaver er lidt off"): coachen kan kvittere en smerte- eller
// ømhedsadvarsel. Advarslen bygges kun i klienten, så kvitteringen gemmes lokalt i browseren pr. coach,
// atlet og advarselstype med det seneste niveau og den seneste dato, den dækkede. Ny eller højere smerte
// viser advarslen igen. Ingen tabel, ingen RPC; tærsklerne for advarslerne er uændrede.
export const smerteNoegle = coachId => `entropi2:smerte-kvittering:${coachId}`
const storageFor = supplied => supplied === undefined ? globalThis.localStorage : supplied
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value)

export function markFor(kind, found) {
  return { kind, date: found.date ?? null, level: found.pain ?? found.days ?? null }
}

export function erKvitteret(kvitteringer, athleteId, mark) {
  const entry = plain(kvitteringer) && plain(kvitteringer[athleteId]) ? kvitteringer[athleteId][mark?.kind] : null
  if (!plain(entry)) return false
  const nyere = typeof mark.date === 'string' && typeof entry.date === 'string' && mark.date > entry.date
  const hoejere = Number.isFinite(mark.level) && Number.isFinite(entry.level) && mark.level > entry.level
  return !nyere && !hoejere
}

export const medKvittering = (kvitteringer, athleteId, mark) => ({ ...kvitteringer,
  [athleteId]: { ...(plain(kvitteringer?.[athleteId]) ? kvitteringer[athleteId] : {}),
    [mark.kind]: { date: mark.date ?? null, level: mark.level ?? null } } })

export function indlaesKvitteringer(coachId, supplied) {
  if (typeof coachId !== 'string' || !coachId) return {}
  try {
    const raw = storageFor(supplied).getItem(smerteNoegle(coachId))
    if (typeof raw !== 'string' || raw.length > 50000) return {}
    const value = JSON.parse(raw)
    return plain(value) ? value : {}
  } catch {
    return {}
  }
}

export function gemKvitteringer(coachId, kvitteringer, supplied) {
  if (typeof coachId !== 'string' || !coachId) return false
  try {
    storageFor(supplied).setItem(smerteNoegle(coachId), JSON.stringify(kvitteringer))
    return true
  } catch {
    return false
  }
}
