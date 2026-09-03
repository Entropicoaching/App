// Ren orkestrering af "log ud, koste hvad det vil" — ingen DOM- eller
// Supabase-afhængighed, så garantien (prøv et rigtigt signOut, men ryd
// ALTID den lokale session bagefter — uanset succes, fejl eller timeout) kan
// testes uden browser eller netværk. supabase.js binder de rigtige
// side-effekter (Supabase-klienten, localStorage, en side-reload) på.
//
// Baggrund (ORDRE 20, bug 1): @supabase/auth-js' signOut() afviser (i stedet
// for at returnere et fejl-objekt) på enhver netværksfejl der ikke er en
// AuthError — fx en timeout fra denne apps egen fetchWithTimeout. Ubehandlet
// lod det brugeren stå logget ind for evigt uden fejlbesked.

export function isSupabaseAuthTokenKey(key) {
  return typeof key === 'string' && key.startsWith('sb-') && key.endsWith('-auth-token')
}

// signOutFn: () => Promise — det "rigtige" signOut-kald, kan afvise/hænge.
// clearFn: () => void — rydder sessionen lokalt ubetinget; kaldes PRÆCIS én
//          gang, uanset om signOutFn lykkedes, fejlede eller timede ud.
// timeoutMs: hvor længe der max ventes på signOutFn før der ryddes alligevel.
export async function signOutHardCore(signOutFn, clearFn, timeoutMs) {
  let timedOut = false
  try {
    await Promise.race([
      Promise.resolve().then(signOutFn),
      new Promise(resolve => setTimeout(() => { timedOut = true; resolve() }, timeoutMs)),
    ])
  } catch {
    // Fejltypen er ligegyldig her (kastet AuthError, abortet fetch, rent
    // netværksdrop) — clearFn skal køre uanset, se finally.
  } finally {
    clearFn()
  }
  return { timedOut }
}
