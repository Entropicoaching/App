// ORDRE 314 · blok 1 — om "næste sæt"-linjen (dæmpet, ingen felter) skal vises
// i Dagens pas. Persisteret lokalt (samme mønster som restPause.js: storage
// sendes eksplicit, default globalThis.localStorage, enhver fejl sluger sig
// selv) — det er en visningspræference for enheden, ikke atletdata, derfor
// ingen athleteId-scope.
const KEY = 'entropi_dagens_pas_vis_naeste_saet'

export function loadShowNextSetPreview(storage = globalThis.localStorage) {
  try {
    if (!storage) return true
    const raw = storage.getItem(KEY)
    return raw === null ? true : raw === '1'
  } catch {
    return true
  }
}

export function saveShowNextSetPreview(value, storage = globalThis.localStorage) {
  try {
    if (!storage) return
    storage.setItem(KEY, value ? '1' : '0')
  } catch { /* en fejlet skrivning må ikke vælte togglen */ }
}
