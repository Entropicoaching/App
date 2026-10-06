// ORDRE 1459 — hjælpere til pause-linjen på sæt-kortet: tidsformat (delt med
// RestPauseFooter) og "forklaret"-flaget, så forklaringen kun står, til pausen
// har kørt én gang. Enhver storage-fejl sluger sig selv (som restPause.js).
const FORKLARET_KEY = 'entropi_pause_forklaret'

// 89 sek. står som 1:29 (under et minut: 45s), så atleten ikke regner selv.
export const visTid = (sek) => sek >= 60 ? `${Math.floor(sek / 60)}:${String(sek % 60).padStart(2, '0')}` : `${sek}s`

export function harSetPauseForklaring(storage = globalThis.localStorage) {
  try { return storage?.getItem(FORKLARET_KEY) === '1' } catch { return false }
}

export function markerPauseForklaring(storage = globalThis.localStorage) {
  try { storage?.setItem(FORKLARET_KEY, '1') } catch { /* ingen storage: forklaringen vises igen, ufarligt */ }
}
