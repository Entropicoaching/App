// ORDRE 131 — "stille fejl, runde 5", commit 2/3: nogle fejl på atletens vej
// kan IKKE vises og rettes samme sted (fx et brud midt i en videoupload, hvor
// hele appen kan være genindlæst/lukket, så der ikke er noget "her" tilbage
// at vise en fejl i). De skal stadig kunne ses af coachen — se RAPPORT-131.md.
//
// video_analyses.session_context er det ENESTE JSON-felt der rejser fra
// atletens enhed til coachens (samme felt ordre 109 · commit 3 brugte til
// kalibrerings-årsagen) — der findes ingen migration, og ordren forbyder at
// lave en. Så: en lille, whitelistet kø af stille-fejl-koder gemmes lokalt
// (samme mønster som readinessDraft.js), og "tømmes" ind i session_context
// næste gang atleten rent faktisk får oprettet en video_analyses-række
// (uploadAndGo). Findes koden aldrig en videorække at hænge på (atleten
// bruger ikke videocoach igen), ser coachen den ikke i étlinje-resuméet — kun
// i frontend_errors (allerede logget separat, se AthleteView.jsx) — se
// "Ærlige grænser" i rapporten.
//
// Rene funktioner, enhedstestbare uden browser (storage sendes eksplicit).
const SILENT_FAIL_PREFIX = 'entropi_silent_fail_pending'
const MAX_PENDING = 5
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000 // 7 dage — matcher "i denne uge" i coach-visningen

// Whitelist: aldrig fri tekst ind i session_context (samme forsigtighed som
// PLATE_CALIBRATION_REASONS i videoCoachUpload.js).
export const SILENT_FAIL_CODES = new Set([
  'silent:pr-insert-failed',       // G14 — PR-registrering fejlede stille
  'silent:weight-log-failed',      // G15 — vægtlogning fejlede stille
  'silent:video-upload-interrupted', // G16 — app lukket/genindlæst midt i videoupload
])

function pendingKey(athleteId) {
  return `${SILENT_FAIL_PREFIX}:${athleteId}`
}

function readPending(athleteId, storage) {
  try {
    if (!storage || !athleteId) return []
    const raw = storage.getItem(pendingKey(athleteId))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writePending(athleteId, storage, list) {
  try {
    if (!storage || !athleteId) return
    storage.setItem(pendingKey(athleteId), JSON.stringify(list))
  } catch { /* fuld/utilgængelig storage må aldrig vælte kalderen */ }
}

// Kaldes lige efter en stille fejl er opdaget (fx en INSERT der fejlede uden
// at atleten kan vises en besked der giver mening at rette lige nu).
export function recordSilentFail(athleteId, code, storage = globalThis.localStorage, at = new Date().toISOString()) {
  if (!athleteId || !SILENT_FAIL_CODES.has(code)) return false
  const list = readPending(athleteId, storage)
  list.push({ code, at })
  writePending(athleteId, storage, list.slice(-MAX_PENDING))
  return true
}

// Læs de sidste (endnu ikke tømte), ikke-forældede fejl — brugt af coach-
// visningen når den er tømt ind i en session_context, og til test.
export function pendingSilentFails(athleteId, storage = globalThis.localStorage, now = Date.now()) {
  return readPending(athleteId, storage).filter(entry =>
    entry && SILENT_FAIL_CODES.has(entry.code) &&
    now - new Date(entry.at).getTime() <= MAX_AGE_MS)
}

// Lægger den ventende kø ind i en (endnu ikke gemt) video_analyses-rækkes
// session_context — kalderen skal selv rydde kø'en (clearPendingSilentFails)
// FØRST når rækken er bekræftet gemt, så en fejlet gemning ikke taber
// koderne. Rører intet hvis kø'en er tom — ingen ekstra nøgle tilføjes.
export function attachPendingSilentFails(sessionContext, athleteId, storage = globalThis.localStorage) {
  const pending = pendingSilentFails(athleteId, storage)
  if (!pending.length) return sessionContext
  return { ...sessionContext, silent_fails: pending }
}

// Ryd kø'en efter en BEKRÆFTET gemning (se attachPendingSilentFails ovenfor).
export function clearPendingSilentFails(athleteId, storage = globalThis.localStorage) {
  writePending(athleteId, storage, [])
}

// G16 — "browser mister fokus midt i upload": lykkes en videoupload eller
// fejler den forudsigeligt (netfejl, afvist af storage), kan appen ALTID nå
// at vise atleten noget — men lukkes/genindlæses hele fanen midt i selve
// overførslen (baggrunds-suspendering, appen tvunget lukket), kører INGEN
// kode nogensinde færdig, og atleten ser aldrig hverken kvittering eller
// fejl. En markør sat FØR overførslen og ryddet ved ethvert bekræftet udfald
// (succes, fejl ELLER annullering) afslører det: findes markøren stadig ved
// NÆSTE app-åbning, må den forrige session være sluttet uden at nå et
// bekræftet udfald.
const UPLOAD_INFLIGHT_PREFIX = 'entropi_vc_upload_inflight'

function uploadInflightKey(athleteId) {
  return `${UPLOAD_INFLIGHT_PREFIX}:${athleteId}`
}

export function markUploadInflight(athleteId, requestId, storage = globalThis.localStorage, at = new Date().toISOString()) {
  try {
    if (!storage || !athleteId) return
    storage.setItem(uploadInflightKey(athleteId), JSON.stringify({ requestId, at }))
  } catch { /* fuld/utilgængelig storage må aldrig vælte selve uploaden */ }
}

export function clearUploadInflight(athleteId, storage = globalThis.localStorage) {
  try {
    if (!storage || !athleteId) return
    storage.removeItem(uploadInflightKey(athleteId))
  } catch { /* se ovenfor */ }
}

// Kaldes ved AthleteView-mount (= reelt en frisk app-åbning, aldrig et
// genrender). Rydder selv markøren, så samme afbrydelse kun opdages én gang.
export function takeStaleUploadInflight(athleteId, storage = globalThis.localStorage) {
  try {
    if (!storage || !athleteId) return null
    const raw = storage.getItem(uploadInflightKey(athleteId))
    if (!raw) return null
    storage.removeItem(uploadInflightKey(athleteId))
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

// ORDRE 131 · commit 3: bygger coachens étlinje-resumé ("Atleten havde
// netproblemer 2 gange i denne uge") ud fra de seneste video_analyses-rækkers
// session_context.silent_fails — se AthleteSilentFailNote.jsx (den eneste
// bruger, kaldt fra Dashboard.jsx ét sted). Ren funktion (ingen Supabase-
// afhængighed), så den kan enhedstestes uden en levende database.
export function summarizeSilentFailsForCoach(rows, now = Date.now()) {
  const cutoff = now - WEEK_MS
  let total = 0
  for (const row of rows || []) {
    const fails = row?.session_context?.silent_fails
    if (!Array.isArray(fails)) continue
    for (const entry of fails) {
      if (!entry || !SILENT_FAIL_CODES.has(entry.code)) continue
      const at = new Date(entry.at).getTime()
      if (!Number.isFinite(at) || at < cutoff) continue
      total++
    }
  }
  if (!total) return null
  return `Atleten havde netproblemer ${total} ${total === 1 ? 'gang' : 'gange'} i denne uge.`
}
