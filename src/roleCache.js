// ORDRE 201 (oprindeligt i App.jsx) + ORDRE 233 · commit 1 (flyttet hertil,
// uændret format): den lokalt huskede rolle-gæt, plus en ren, enhedstestbar
// udvælgelse af hvilken skærm-chunk der skal forudindlæses for den.
//
// roleCacheKey/readCachedRole/writeCachedRole er ordre 201's oprindelige
// mønster (localStorage pr. bruger-id, se docs/RAPPORT-201.md) — flyttet ud
// af App.jsx uden adfærdsændring, så vite.config.js's forudindlæsnings-plugin
// (se der) kan bage PRÆCIS samme udvælgelseskode ind i index.html's inline
// script i stedet for at vedligeholde en separat kopi der kan gå i utakt.
export function roleCacheKey(userId) {
  return `entropi_role_guess_${userId}`
}

export function readCachedRole(userId) {
  try { return localStorage.getItem(roleCacheKey(userId)) } catch { return null }
}

export function writeCachedRole(userId, role) {
  try { localStorage.setItem(roleCacheKey(userId), role) } catch { /* privat fane e.l. — gættet dropper blot næste gang */ }
}

// Samme mønster som authSignOut.js's isSupabaseAuthTokenKey (sb-*-auth-token)
// — GoTrueClient (src/supabase.js) gemmer hele sessionen, inkl. session.user.id,
// under netop denne nøgle, ingen anden konfiguration (ingen userStorage).
const AUTH_TOKEN_KEY_PATTERN = /^sb-.*-auth-token$/

function findAuthTokenKey(storage) {
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i)
    if (key && AUTH_TOKEN_KEY_PATTERN.test(key)) return key
  }
  return null
}

// Rollen for DENNE browser, uden noget Supabase-kald: finder auth-tokenets
// gemte bruger-id og slår op i samme cache readCachedRole ovenfor læser.
// Tager et lager-objekt (ikke det globale localStorage direkte) så funktionen
// er ren og kan enhedstestes uden en browser — se roleCache.test.js. Kaster
// aldrig: enhver uventet form (tom, korrupt JSON, manglende nøgle) giver
// blot null, dvs. "intet gæt", aldrig en fejl der stopper siden.
export function guessRoleFromStorage(storage) {
  try {
    const tokenKey = findAuthTokenKey(storage)
    if (!tokenKey) return null
    const raw = storage.getItem(tokenKey)
    if (!raw) return null
    const userId = JSON.parse(raw)?.user?.id
    if (!userId) return null
    return storage.getItem(roleCacheKey(userId))
  } catch {
    return null
  }
}

// Hvilken chunk-href der skal forudindlæses for en gættet rolle. chunkHrefs
// er bagt ind ved byggetid (se vite.config.js) med de faktiske, hashede
// filnavne — kun 'coach' og 'athlete' er gyldige roller (App.jsx's
// resolveRole skriver aldrig andet, se roleCacheKey-brugen der). Alt andet
// (ukendt rolle, intet gæt, manglende href) -> null, dvs. ingen
// forudindlæsning, adfærd som i dag.
export function preloadHrefForRole(role, chunkHrefs) {
  if (role === 'coach') return chunkHrefs?.coach || null
  if (role === 'athlete') return chunkHrefs?.athlete || null
  return null
}
