// ORDRE 76 — "stille fejl, runde 4", G12: parathedsformularens felter
// (søvn/energi/motivation/stress/ømhed) levede kun i React-state. Lukkede
// atleten fanen — eller skiftede væk og telefonen ryddede tabben — midt i
// udfyldningen, var alt tastet væk uden varsel. Samme mønster som F8/F9
// (sæt-loggerens/chattens ugemte input), en anden skærm.
//
// Rene funktioner, samme stil som videoCoachSubmission.js's kø-funktioner:
// storage sendes eksplicit (default globalThis.localStorage) så de kan
// enhedstestes uden en rigtig browser, og enhver fejl (privat vindue,
// fuld storage) sluger sig selv i stedet for at vælte formularen.
const READINESS_DRAFT_PREFIX = 'entropi_readiness_draft'

function readinessDraftKey(athleteId, date) {
  return `${READINESS_DRAFT_PREFIX}:${athleteId}:${date}`
}

// "Tomt" = intet der ville gå tabt ved et fanelukke — ingen grund til at
// skrive eller beholde et udkast.
export function isEmptyReadinessDraft(input) {
  if (!input) return true
  return !input.sleep && !input.energy && !input.motivation && !input.stress &&
    !input.soreness && (!input.soreZones || input.soreZones.length === 0)
}

export function saveReadinessDraft(athleteId, date, input, storage = globalThis.localStorage) {
  try {
    if (!storage || !athleteId || !date) return false
    storage.setItem(readinessDraftKey(athleteId, date), JSON.stringify(input))
    return true
  } catch {
    return false
  }
}

export function loadReadinessDraft(athleteId, date, storage = globalThis.localStorage) {
  try {
    if (!storage || !athleteId || !date) return null
    const raw = storage.getItem(readinessDraftKey(athleteId, date))
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function clearReadinessDraft(athleteId, date, storage = globalThis.localStorage) {
  try {
    if (!storage || !athleteId || !date) return
    storage.removeItem(readinessDraftKey(athleteId, date))
  } catch { /* et fejlet removeItem må ikke vælte gem-flowet */ }
}
