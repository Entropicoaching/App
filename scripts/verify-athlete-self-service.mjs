// ORDRE 70 — fund G6/G7 fra ordre 41's krydstjek: en atlet der aldrig
// får/åbner bekræftelsesmailen ved oprettelse har ingen vej til et nyt link
// (G6), og kontomenuens "Log ud" logger fuldt ud på ét tryk uden fortryd
// (G7). Begge er selvbetjening: en atlet skal kunne løse dem uden at skrive
// til Marc, og et fejltryk skal ikke kunne smide en ud af en session.
//
// Valgt oveni: G11 (Auth.jsx's tilstandsskift "Opret her"/"Log ind" i
// bunden af login-skærmen manglede al padding/minHeight — samme
// underdimensionerede mønster som "Glemt adgangskode?" havde FØR ordre 41,
// og lige så billigt at rette: samme minHeight-mønster, én linje pr. sted).
//
// Ligesom resten af repoets scripts/verify-*.mjs er der ingen DOM/React-
// testopsætning her — adfærden verificeres ved tekstmatch mod selve
// kildekoden.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const auth = readFileSync(new URL('../src/Auth.jsx', import.meta.url), 'utf8')
const athleteView = readFileSync(new URL('../src/AthleteView.jsx', import.meta.url), 'utf8')

// --- G6: send bekræftelseslink igen -----------------------------------------
assert.match(auth, /rawMessage\.includes\('email not confirmed'\)/,
  'Login-fejlen "email not confirmed" skal genkendes særskilt, så vi ved hvornår linket kan sendes igen')
assert.match(auth, /supabase\.auth\.resend\(\{ type: 'signup', email: unconfirmedEmail \}\)/,
  '"Send bekræftelseslink igen" skal rent faktisk bede Supabase sende et nyt link')
assert.match(auth, /Send bekræftelseslink igen/, 'Linket skal have en synlig, dansk tekst')

// --- G7: log ud-bekræftelse i kontomenuen -----------------------------------
const logoutButtonMatch = athleteView.match(/onClick=\{\(\) => \{ setAccountMenuOpen\(false\); [^}]*signOutHard\(\)[^}]*\}\}\s*\n\s*style=\{\{[^}]*color: '#e05555'/)
assert.ok(logoutButtonMatch, 'Kontomenuens "Log ud"-knap skal findes')
assert.match(logoutButtonMatch[0], /askConfirm\(/, 'Log ud skal spørge om bekræftelse, så et fejltryk ikke logger ud midt i en session')

// --- G11: Auth.jsx's tilstandsskift har nu en tommelfinger-venlig trykflade
for (const label of ['Opret her', 'Log ind']) {
  const idx = auth.indexOf(`>${label}</span>`)
  assert.ok(idx >= 0, `"${label}" skal findes i Auth.jsx`)
  const styleStart = auth.lastIndexOf('style={{', idx)
  const snippet = auth.slice(styleStart, idx)
  assert.match(snippet, /minHeight: '44px'/, `"${label}" skal have en eksplicit minHeight på mindst 44px`)
}

// --- Ingen udråbstegn i de nye tekster ---------------------------------------
assert.ok(!/Send bekræftelseslink igen!/.test(auth))
assert.ok(!/Log ud af Entropi\?[^"']*!/.test(athleteView))

console.log('Send bekræftelseslink igen (G6), log ud-bekræftelse (G7) og Auth.jsx\'s tilstandsskift (G11) er på plads.')
