// ORDRE 226 · commit 2: klienten bygges af de fire submoduler
// (@supabase/auth-js, postgrest-js, storage-js, functions-js) i stedet for
// @supabase/supabase-js — som ALDRIG bruges for sin egen skyld, kun for
// createClient()'s sammensætning af netop disse fire, PLUS en Realtime-klient
// (@supabase/realtime-js/phoenix.js, ~18 KB gzip) som appen aldrig kalder
// (ingen .channel()-brug nogen steder i src/, se docs/RAPPORT-201.md). Alle
// fire submoduler har hver deres officielle "Standalone import for
// bundle-sensitive environments"-eksempel i egen kildekode (samme mønster
// genskabt her) og er allerede installeret (npms hoisting af
// @supabase/supabase-js's egne dependencies, se package.json). Ingen ny
// afhængighed — samme pakketræ, bare importeret direkte i stedet for
// gennem @supabase/supabase-js's wrapper-klasse (node_modules/@supabase/
// supabase-js/src/SupabaseClient.ts), som denne fil bevidst efterligner
// (auth-headere, storageKey-format, fetch-indpakning) for at holde
// eksisterende sessioner og RLS-kald uændrede.
import { GoTrueClient } from '@supabase/auth-js'
import { PostgrestClient } from '@supabase/postgrest-js'
import { StorageClient } from '@supabase/storage-js'
import { FunctionsClient } from '@supabase/functions-js'
import { signOutHardCore, isSupabaseAuthTokenKey } from './authSignOut'

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

// Samme storageKey-format som @supabase/supabase-js selv beregner
// (`sb-<projekt-ref>-auth-token`, ref = URL-hostens første label) — skal
// være UÆNDRET, ellers mister enhver allerede logget ind bruger sin session
// (localStorage-nøglen ville skifte navn under dem). authSignOut.js's
// isSupabaseAuthTokenKey() forventer netop dette `sb-*-auth-token`-mønster.
const AUTH_STORAGE_KEY = `sb-${new URL(SUPABASE_URL).hostname.split('.')[0]}-auth-token`

const authApiHeaders = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }

const authClient = new GoTrueClient({
  url: `${SUPABASE_URL}/auth/v1`,
  headers: authApiHeaders,
  storageKey: AUTH_STORAGE_KEY,
  persistSession: true,
  autoRefreshToken: true,
  // Skal være true for at "glemt adgangskode"-linket kan logge atleten ind
  // med en midlertidig recovery-session (App.jsx lytter efter PASSWORD_RECOVERY-
  // eventet). Der er intet andet redirect-baseret flow i appen, så det er sikkert
  // at slå til.
  detectSessionInUrl: true,
  fetch: fetchWithTimeout,
})

// Erstatter @supabase/supabase-js's interne (ikke-eksporterede) fetchWithAuth
// (node_modules/@supabase/supabase-js/src/lib/fetch.ts): lægger `apikey` og
// `Authorization: Bearer <session-token, falder tilbage til SUPABASE_KEY>`
// på ethvert REST/Storage/Functions-kald der ikke selv allerede sætter dem —
// samme adfærd, minus dens sporings-/nye-nøgleformat-logik som denne app
// aldrig bruger (ingen OpenTelemetry, kun det gamle JWT-nøgleformat).
function withAuthHeaders(fetchImpl) {
  return async (input, init = {}) => {
    const headers = new Headers(init.headers)
    if (!headers.has('apikey')) headers.set('apikey', SUPABASE_KEY)
    if (!headers.has('Authorization')) {
      const { data: { session } } = await authClient.getSession()
      headers.set('Authorization', `Bearer ${session?.access_token ?? SUPABASE_KEY}`)
    }
    return fetchImpl(input, { ...init, headers })
  }
}

const authedFetch = withAuthHeaders(fetchWithTimeout)
const rest = new PostgrestClient(`${SUPABASE_URL}/rest/v1`, { schema: 'public', fetch: authedFetch })
const storageClient = new StorageClient(`${SUPABASE_URL}/storage/v1`, {}, authedFetch)

export const supabase = {
  auth: authClient,
  from: (relation) => rest.from(relation),
  rpc: (fn, args, options) => rest.rpc(fn, args, options),
  storage: storageClient,
  get functions() {
    return new FunctionsClient(`${SUPABASE_URL}/functions/v1`, { customFetch: authedFetch })
  },
}

// ORDRE 61 · commit 2: standardklientens fetch har et fast 12s-loft
// (fetchWithTimeout ovenfor) - uegnet til en videoupload på svagt mobilnet,
// som bevidst ingen tidsgrænse har. En videoupload skal til gengæld kunne
// afbrydes af atleten selv, hvilket storage-js's .upload() ikke understøtter
// direkte (ingen AbortSignal-mulighed i dens FileOptions). Denne
// engangs-storageklient genbruger den DELTE klients session (samme
// bearer-opslag som authedFetch ovenfor), men binder til ét enkelt
// AbortSignal, så en afbrudt upload aldrig kan afbryde andre samtidige kald —
// og uden en ny GoTrueClient-instans (ordre 61's oprindelige version
// oprettede en hel ny klient med samme storageKey for netop at genbruge
// sessionen; det er ikke længere nødvendigt, når bearer-opslaget allerede
// går direkte til den delte authClient ovenfor).
export function createAbortableUploadClient(signal) {
  const uploadFetch = async (input, init = {}) => {
    const headers = new Headers(init.headers)
    if (!headers.has('apikey')) headers.set('apikey', SUPABASE_KEY)
    if (!headers.has('Authorization')) {
      const { data: { session } } = await authClient.getSession()
      headers.set('Authorization', `Bearer ${session?.access_token ?? SUPABASE_KEY}`)
    }
    return fetch(input, { ...init, headers, signal })
  }
  return { storage: new StorageClient(`${SUPABASE_URL}/storage/v1`, {}, uploadFetch) }
}

// Sand hvis siden netop blev åbnet fra et "glemt adgangskode"-link (Supabase
// lægger `type=recovery` i URL-fragmentet). Læses SYNKRONT ved modul-load, så
// App.jsx ikke er afhængig af hvornår PASSWORD_RECOVERY-eventet når frem —
// det interne URL-parse-kald kan i princippet fyre før React har nået at
// registrere sin lytter.
export const isPasswordRecoveryUrl =
  typeof window !== 'undefined' && /type=recovery/.test(window.location.hash)

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

// --- Robust log-ud ------------------------------------------------------
// BUG (ORDRE 20): "Log ud" kunne stå og gøre ingenting. @supabase/auth-js'
// signOut() awaiter et netværkskald til /logout, og GoTrueAdminApi.signOut()
// KASTER videre enhver fejl der ikke er en AuthError (fx en abortet fetch fra
// vores egen fetchWithTimeout, eller et rent netværksdrop) — uden nogensinde
// at nå frem til at rydde den lokale session. Ved en flaky/langsom
// forbindelse (mobil vågnet fra dvale, akkurat den slags cold-start denne fil
// allerede kæmper med andetsteds) endte brugeren derfor logget ind for
// evigt, uden fejlbesked, fordi ingen af de eksisterende onClick-handlere
// fangede den afviste promise.
//
// signOutHard() garanterer i stedet at sessionen ALTID forsvinder lokalt:
// den forsøger et rigtigt signOut (så refresh-token også ugyldiggøres på
// serveren), men rydder under alle omstændigheder selv den persisterede
// sb-*-auth-token-nøgle bagefter og genindlæser siden — uanset om
// netværkskaldet lykkedes, fejlede eller timede ud.
const SIGNOUT_TIMEOUT_MS = 5000
export async function signOutHard() {
  await signOutHardCore(
    () => supabase.auth.signOut(),
    () => {
      try {
        for (const key of Object.keys(localStorage)) {
          if (isSupabaseAuthTokenKey(key)) localStorage.removeItem(key)
        }
      } catch { /* localStorage utilgængelig (fx privat browsing) */ }
    },
    SIGNOUT_TIMEOUT_MS,
  )
  window.location.reload()
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
