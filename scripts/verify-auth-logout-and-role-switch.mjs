// Regressionslås for ORDRE 20 bug 1 (log ud virkede ikke, ingen vej til
// coach-visning uden at logge ud) — se ORDRE 23. Ren kildetekst-verifikation,
// samme stil som scripts/verify-athlete-first-day-flow.mjs: låser at de
// specifikke rettelser stadig er der, og at ingen af de rå
// `supabase.auth.signOut()`-kald (selve bugen) er sneget sig ind igen.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const supabaseJs = readFileSync(new URL('../src/supabase.js', import.meta.url), 'utf8')
const dashboard = readFileSync(new URL('../src/Dashboard.jsx', import.meta.url), 'utf8')
const athleteView = readFileSync(new URL('../src/AthleteView.jsx', import.meta.url), 'utf8')
const appJsx = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
const authSignOut = readFileSync(new URL('../src/authSignOut.js', import.meta.url), 'utf8')

// --- signOutHard: sessionen skal ALTID ryddes, uanset signOut-udfaldet -----
assert.match(supabaseJs, /export async function signOutHard\(\)/)
assert.match(supabaseJs, /signOutHardCore\(\s*\(\) => supabase\.auth\.signOut\(\)/,
  'signOutHard skal forsøge et rigtigt signOut (så refresh-token også ugyldiggøres server-side)')
assert.match(supabaseJs, /isSupabaseAuthTokenKey\(key\)\) localStorage\.removeItem\(key\)/,
  'signOutHard skal rydde de persisterede sb-*-auth-token-nøgler lokalt')
{
  // reload() skal ligge UDEN FOR signOutHardCore-kaldet — dvs. køre uanset om
  // det (interne) signOut-forsøg lykkedes, fejlede eller timede ud. Var den
  // ved en fejl havnet INDE i signOutHardCore's egen try/catch, ville en
  // clearFn-fejl kunne forhindre reload'en.
  const fnStart = supabaseJs.indexOf('export async function signOutHard()')
  const fnBody = supabaseJs.slice(fnStart, supabaseJs.indexOf('\n}\n', fnStart))
  const coreCallEnd = fnBody.indexOf(')\n  window.location.reload()')
  assert.ok(coreCallEnd > 0,
    'window.location.reload() skal stå umiddelbart efter (uden for) signOutHardCore-kaldet i signOutHard')
}

// --- authSignOut.js: selve garantien (clearFn kører altid) ------------------
assert.match(authSignOut, /export async function signOutHardCore\(signOutFn, clearFn, timeoutMs\)/)
assert.match(authSignOut, /\}\s*finally\s*\{\s*clearFn\(\)\s*\}/,
  'clearFn skal stå i en finally-blok, ikke kun i success- eller catch-grenen')

// --- Ingen rå signOut() tilbage nogen steder (det VAR bugen) ----------------
for (const [name, src] of [['Dashboard.jsx', dashboard], ['AthleteView.jsx', athleteView]]) {
  assert.doesNotMatch(src, /supabase\.auth\.signOut\(\)/,
    `${name} skal bruge signOutHard() overalt, ikke det rå supabase.auth.signOut() der kunne fejle stille`)
}
assert.equal((dashboard.match(/signOutHard\(\)/g) || []).length, 2,
  'Dashboards to "Log ud"-knapper (sidebar + mobil-menu) skal begge bruge signOutHard()')
assert.ok(/signOutHard\(\)/.test(athleteView), 'AthleteView skal have mindst ét signOutHard()-kald')

// --- AthleteView: en atlet-session (ikke kun edge-case-skærmen) har en ------
// synlig log-ud-vej. Før ORDRE 20 fandtes der INGEN log-ud-knap i selve
// topbaren — kun i "konto ikke koblet"-skærmen.
assert.match(athleteView, /aria-label="Konto"/, 'AthleteView topbar skal have en synlig konto-menu')
assert.match(athleteView, />Log ud</, 'Konto-menuen skal indeholde en "Log ud"-knap')

// --- Coach-visning kan vælges UDEN at logge ud ------------------------------
// (a) App.jsx: den ikke-preview AthleteView-gren skal have en genopslags-vej
//     der IKKE går via signOut/login.
assert.match(appJsx, /onRecheckRole=\{\(\) => resolveRef\.current\?\.\(session\.user\.id, session\.user\.email\)\}/,
  'App.jsx skal give AthleteView en vej til at genopslå rollen uden login/logout')
// (b) AthleteView: "Skift til coach-visning" skal kalde handleRecheckRole (som
//     kalder onRecheckRole), IKKE signOut — ellers er "uden at logge ud" brudt.
assert.match(athleteView, /'Skift til coach-visning'/)
{
  const labelIdx = athleteView.indexOf("'Skift til coach-visning'")
  const btnStart = athleteView.lastIndexOf('<button', labelIdx)
  assert.ok(btnStart >= 0, 'Kunne ikke finde <button ...> der omslutter "Skift til coach-visning"')
  const context = athleteView.slice(btnStart, labelIdx)
  assert.match(context, /handleRecheckRole/,
    '"Skift til coach-visning"-knappen skal kalde handleRecheckRole, ikke en logout')
  assert.doesNotMatch(context, /signOutHard|supabase\.auth\.signOut/,
    '"Skift til coach-visning"-knappen må IKKE logge brugeren ud')
}
assert.match(athleteView, /async function handleRecheckRole\(\) \{[\s\S]*?await onRecheckRole\?\.\(\)/,
  'handleRecheckRole skal reelt kalde den genopslags-funktion App.jsx sender ned')

console.log('Log ud rydder altid sessionen (session + gemt/cachet rolle via en fuld genindlæsning), og coach-visning kan vælges uden at logge ud.')
