// Klient-opdatering: sikrer at nye deploys faktisk når atleternes enheder,
// særligt iOS-hjemmeskærms-PWA'er der ellers kan køre en forældet app-bundle.
// Sammen med service-workerens network-first-navigation (public/sw.js) giver
// det en pålidelig opdateringssti uden serverstyrede cache-headers.

const CURRENT_BUILD_ID = typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : null
const RELOAD_GUARD_KEY = 'entropi_update_reloaded_for'

async function checkForUpdate() {
  if (!CURRENT_BUILD_ID || document.visibilityState !== 'visible') return
  // Skub også service-workeren til at tjekke efter en ny version af sig selv.
  try {
    const reg = await navigator.serviceWorker?.getRegistration()
    reg?.update()
  } catch { /* sw endnu ikke klar — ignorér */ }
  let latest
  try {
    const res = await fetch(`/version.json?ts=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) return
    latest = (await res.json()).buildId
  } catch { return /* offline eller ingen version.json (fx dev) */ }
  if (!latest || latest === CURRENT_BUILD_ID) return
  // Loop-værn: reload kun én gang pr. ny build, så en stædig cache ikke
  // udløser uendelige genindlæsninger.
  if (sessionStorage.getItem(RELOAD_GUARD_KEY) === latest) return
  sessionStorage.setItem(RELOAD_GUARD_KEY, latest)
  location.reload()
}

export function setupAppUpdate() {
  if (!CURRENT_BUILD_ID) return
  // Når en ny service worker tager kontrol (efter en deploy), genindlæs så den
  // nye app-shell/bundle faktisk bruges. refreshing-værn undgår reload-storm.
  if ('serviceWorker' in navigator) {
    let refreshing = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return
      refreshing = true
      location.reload()
    })
  }
  document.addEventListener('visibilitychange', checkForUpdate)
  window.addEventListener('focus', checkForUpdate)
  window.addEventListener('online', checkForUpdate)
  checkForUpdate()
}
