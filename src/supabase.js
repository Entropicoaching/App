import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY

// Instrumentering: kun i dev, så produktions-konsollen holdes ren. Bruges til at
// måle hvad "første skrivning efter app-åbning" faktisk venter på (auth-refresh
// vs. selve POST'en).
const DEBUG = import.meta.env.DEV
const log = (...a) => { if (DEBUG) console.log('[auth]', ...a) }

// --- Global fetch med hård timeout ------------------------------------------
// Uden en timeout kan ét kald — eller GoTrue's token-refresh — hænge næsten i det
// uendelige når en mobilforbindelse lige er vågnet fra dvale. Og da alle authed
// requests serialiseres bag en igangværende refresh, betyder én hængende refresh
// at det FØRSTE skrivekald efter app-åbning kunne tage op mod et minut. En
// AbortController lægger et fast loft, så vi hellere fejler hurtigt og prøver igen.
const FETCH_TIMEOUT_MS = 12000
function fetchWithTimeout(input, init = {}) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
  // Respektér en evt. medsendt signal (fx Supabase's egen abort), og kombinér
  // den med vores timeout.
  const outer = init.signal
  if (outer) {
    if (outer.aborted) ctrl.abort()
    else outer.addEventListener('abort', () => ctrl.abort(), { once: true })
  }
  return fetch(input, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(timer))
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false, // ren email/password-login, ingen OAuth-redirect at parse
  },
  global: { fetch: fetchWithTimeout },
})

// --- Proaktiv token-fornyelse -----------------------------------------------
// Fornyer et udløbet/næsten-udløbet access-token FØR det første kald, så selve
// skrivningen ikke skal vente på en synkron refresh. Kaldes ved app-start og
// hver gang appen bliver synlig igen (visibilitychange/focus/pageshow) — det er
// netop dér token typisk er blevet forældet mens fanen lå i baggrunden.
//
//   - Deduplikeret: samtidige kald deler ét refresh-løfte.
//   - Tidsbegrænset: blokerer aldrig længere end REFRESH_TIMEOUT_MS. Ved timeout
//     lader vi bare kaldet gå videre; klientens egen auto-refresh samler op.
const REFRESH_TIMEOUT_MS = 8000
const REFRESH_MARGIN_MS = 60000 // forny hvis token udløber inden for 60s
let warmupInFlight = null

export function warmupAuth() {
  if (warmupInFlight) return warmupInFlight
  warmupInFlight = (async () => {
    const t0 = Date.now()
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { log('ingen session'); return }
      const msLeft = (session.expires_at || 0) * 1000 - Date.now()
      if (msLeft > REFRESH_MARGIN_MS) { log(`token frisk (${Math.round(msLeft / 1000)}s tilbage)`); return }
      log(`token udløber om ${Math.round(msLeft / 1000)}s → fornyer proaktivt`)
      let timedOut = false
      const timeout = new Promise(res => setTimeout(() => { timedOut = true; res() }, REFRESH_TIMEOUT_MS))
      await Promise.race([supabase.auth.refreshSession(), timeout])
      log(timedOut ? `refresh timeout efter ${REFRESH_TIMEOUT_MS}ms (fortsætter)` : `refresh ok på ${Date.now() - t0}ms`)
    } catch (e) {
      log('refresh-fejl (ignoreret):', e?.message || e)
    } finally {
      warmupInFlight = null
    }
  })()
  return warmupInFlight
}

// Kør proaktiv fornyelse ved app-start og når appen genoptages fra baggrunden.
if (typeof window !== 'undefined') {
  warmupAuth()
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') warmupAuth()
  })
  window.addEventListener('focus', () => warmupAuth())
  window.addEventListener('pageshow', () => warmupAuth())
}

// Kør et Supabase-kald robust ved appstart/transiente fejl.
//
// `run` er en funktion der bygger og udfører forespørgslen og returnerer
// { data, error } (byg den INDE i funktionen — query-objekter kan kun bruges én
// gang, så hvert retry skal bygge en frisk forespørgsel).
//
// To ting håndteres:
//   1) Venter på at auth-sessionen er hæftet (og proaktivt fornyet) før første
//      forsøg, så kaldet ikke rammer RLS som anonym ved cold start (= 0 rækker
//      uden fejl) eller står i kø bag en langsom refresh.
//   2) Prøver igen ved reel fejl med stigende ventetid.
export async function withRetry(run, { tries = 3, delay = 400 } = {}) {
  await warmupAuth()
  let last
  for (let i = 0; i < tries; i++) {
    last = await run()
    if (!last.error) return last
    if (i < tries - 1) await new Promise(r => setTimeout(r, delay * (i + 1)))
  }
  return last
}

// --- Baggrunds-skrivekø -----------------------------------------------------
// Til optimistiske skrivninger: UI opdateres straks, mens selve skrivningen sker
// her bagefter. Skrivningerne serialiseres (bevarer rækkefølge og undgår at
// hamre klienten under en refresh) og prøves igen ved transiente fejl.
//
// `run` bygger og udfører skrivningen og returnerer { data, error }. Returnerer
// det sidste resultat, så kalderen kan vise en diskret fejl hvis det slog fejl.
let writeChain = Promise.resolve()
export function queueWrite(run, { tries = 4, delay = 600 } = {}) {
  const task = writeChain.then(async () => {
    await warmupAuth()
    let last
    for (let i = 0; i < tries; i++) {
      const t0 = Date.now()
      // Supabase returnerer normalt fetch-fejl som { error }, men en abort/timeout
      // kan kaste — normalisér begge dele til et { error }-resultat.
      try { last = await run() }
      catch (e) { last = { error: e } }
      if (!last?.error) { if (DEBUG && i > 0) log(`skriv ok efter ${i + 1} forsøg (${Date.now() - t0}ms)`); return last }
      log(`skriv fejlede (forsøg ${i + 1}/${tries}):`, last.error?.message || last.error)
      if (i < tries - 1) await new Promise(r => setTimeout(r, delay * (i + 1)))
    }
    return last
  })
  // Hold kæden i live selv hvis en opgave kaster, så en fejl ikke blokerer alt bagefter.
  writeChain = task.then(() => {}, () => {})
  return task
}
