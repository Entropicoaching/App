// ORDRE 41 — fund #3: der findes ingen selvbetjent vej tilbage ind i appen for
// en atlet der har glemt sin adgangskode (ingen "glemt adgangskode"-link,
// ingen håndtering af et Supabase-recovery-link). Uden Marc ved siden af er
// det en total spærring. Denne verifikation dækker begge halvdele: at bede om
// et link (Auth.jsx) og at lande tilbage fra det (App.jsx/SetNewPassword.jsx).
//
// Ligesom resten af repoets scripts/verify-*.mjs er der ingen DOM/React-test-
// opsætning her — adfærden verificeres ved (1) rene funktionskald og (2)
// tekstmatch mod selve kildekoden for at bekræfte at delene rent faktisk er
// koblet sammen.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { athleteAuthErrorMessage } from '../src/athleteOnboarding.js'

// --- Fejlbeskeder for de to nye auth-tilstande ------------------------------
assert.equal(
  athleteAuthErrorMessage({ message: 'unmapped provider error' }, 'reset'),
  'Linket kunne ikke sendes. Tjek emailadressen og prøv igen.',
)
assert.equal(
  athleteAuthErrorMessage({ message: 'unmapped provider error' }, 'update-password'),
  'Adgangskoden kunne ikke gemmes. Prøv igen.',
)
assert.equal(
  athleteAuthErrorMessage({ message: 'Password should be at least 6 characters' }, 'update-password'),
  'Adgangskoden er for kort.',
  'Kendte fejlbeskeder skal stadig genkendes uanset mode',
)

const auth = readFileSync(new URL('../src/Auth.jsx', import.meta.url), 'utf8')
const supabaseClient = readFileSync(new URL('../src/supabase.js', import.meta.url), 'utf8')
const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
const setNewPassword = readFileSync(new URL('../src/SetNewPassword.jsx', import.meta.url), 'utf8')

// --- Bede om et link (Auth.jsx) ---------------------------------------------
assert.match(auth, /Glemt adgangskode\?/, 'Login-skærmen skal tilbyde en vej ud af en glemt adgangskode')
assert.match(auth, /setMode\('reset'\)/, '"Glemt adgangskode?" skal skifte til reset-tilstanden')
assert.match(auth, /resetPasswordForEmail\(normalizedEmail, \{\s*redirectTo: window\.location\.origin,?\s*\}\)/,
  'Reset-tilstanden skal rent faktisk bede Supabase sende et link')
assert.match(auth, /mode !== 'reset'/, 'Adgangskode-feltet skal skjules i reset-tilstanden (der er intet at taste)')

// --- Lande tilbage fra linket (supabase.js + App.jsx + SetNewPassword.jsx) --
assert.match(supabaseClient, /detectSessionInUrl:\s*true/,
  'Klienten skal kunne parse recovery-linkets URL, ellers etableres der aldrig en session at sætte den nye adgangskode i')
assert.match(supabaseClient, /export const isPasswordRecoveryUrl =/)
assert.match(supabaseClient, /type=recovery/, 'Skal genkende Supabases recovery-markør i URL-fragmentet')

assert.match(app, /import SetNewPassword from '\.\/SetNewPassword'/)
assert.match(app, /useState\(isPasswordRecoveryUrl\)/,
  'passwordRecovery skal initieres SYNKRONT fra URL\'en, ikke vente på et event der kan nå at fyre for tidligt')
assert.match(app, /if \(passwordRecovery\) \{\s*return <SetNewPassword/,
  'Recovery-skærmen skal vises FØR den normale rolle-baserede visning')
assert.match(app, /window\.history\.replaceState\(null, '', window\.location\.pathname\)/,
  'Recovery-markøren skal fjernes fra URL\'en efter brug, ellers genudløses skærmen ved et refresh')

assert.match(setNewPassword, /supabase\.auth\.updateUser\(\{ password \}\)/)
assert.match(setNewPassword, /password\.length < 6/, 'Bør fange en for kort adgangskode lokalt frem for en rundtur til serveren')
assert.match(setNewPassword, /onDone\(\)/)
assert.match(setNewPassword, /!ready/, 'Skal vise en ventetilstand mens recovery-sessionen etableres i baggrunden')

console.log('Glemt-adgangskode-flowet beder om et link (Auth.jsx) og lander korrekt tilbage fra det (App.jsx + SetNewPassword.jsx), uden at røre coach-visningen.')
