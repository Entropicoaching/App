// Ren logik bag LazyBoundary.jsx's chunk-genforsøg (ordre 163 · del 2), holdt
// adskilt fra React så den kan enhedstestes uden en DOM (samme princip som
// authSignOut.js/authSignOut.test.js: injicér de sideeffekt-bærende dele
// (storage, reload, ventetid) i stedet for at kalde window/sessionStorage
// direkte, så testen kan styre dem uden en rigtig browser).
//
// To forskellige fejl kan ramme en dynamisk import():
//  1) Et forbigående netværksglip på en fil der reelt findes — prøves igen
//     med kort back-off, lykkes typisk andet forsøg. Ingen genindlæsning.
//  2) En ægte stale chunk-reference efter en deploy (telefonen har den gamle
//     index.html liggende og beder om et filnavn der ikke findes længere) —
//     et gentaget forsøg på SAMME url hjælper aldrig. Kun ét helside-genload
//     (som henter en frisk index.html med de nye filnavne) løser det. En
//     sessionStorage-nøgle forhindrer en uendelig genload-løkke hvis fejlen
//     er ægte (fx et permanent netværksudfald).
export function isChunkLoadError(err) {
  return /dynamically imported module|Importing a module script failed|Failed to fetch/i.test(err?.message || '')
}

export async function loadChunkWithRetry(factory, {
  tries = 2,
  delayMs = 400,
  wait = (ms) => new Promise((r) => setTimeout(r, ms)),
  hasReloadedOnce,
  markReloaded,
  reload,
} = {}) {
  let lastErr
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      return await factory()
    } catch (err) {
      lastErr = err
      if (!isChunkLoadError(err)) throw err
      if (attempt < tries - 1) await wait(delayMs)
    }
  }
  if (!hasReloadedOnce()) {
    markReloaded()
    reload()
    return new Promise(() => {}) // hæng indtil genindlæsningen sker
  }
  throw lastErr
}
