import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  athleteAuthErrorMessage,
  athleteOnboardingStorageKey,
  completeAthleteOnboarding,
  hasCompletedAthleteOnboarding,
  normalizeAthleteLoginEmail,
} from '../src/athleteOnboarding.js'

assert.equal(normalizeAthleteLoginEmail('  Athlete.Name@Example.COM  '),
  'athlete.name@example.com')
assert.equal(normalizeAthleteLoginEmail(''), '')
assert.equal(normalizeAthleteLoginEmail(null), '')
assert.equal(athleteAuthErrorMessage({ message: 'Invalid login credentials' }),
  'Email eller adgangskode er forkert.')
assert.equal(athleteAuthErrorMessage({ message: 'Email not confirmed' }),
  'Bekræft din email via linket, før du logger ind.')
assert.equal(athleteAuthErrorMessage({ message: 'unmapped provider error' }, 'signup'),
  'Kontoen kunne ikke oprettes. Tjek oplysningerne eller kontakt din coach.')

function memoryStorage(entries = {}) {
  const values = new Map(Object.entries(entries))
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
  }
}

const firstAthleteId = 'athlete-1'
const secondAthleteId = 'athlete-2'
const legacyStorage = memoryStorage({ entropi_onboarded: 'true' })
assert.equal(hasCompletedAthleteOnboarding(legacyStorage, firstAthleteId), true)
assert.equal(legacyStorage.getItem('entropi_onboarded'), null)
assert.equal(legacyStorage.getItem(athleteOnboardingStorageKey(firstAthleteId)), 'true')
assert.equal(hasCompletedAthleteOnboarding(legacyStorage, secondAthleteId), false)
assert.equal(completeAthleteOnboarding(legacyStorage, secondAthleteId), true)
assert.equal(hasCompletedAthleteOnboarding(legacyStorage, secondAthleteId), true)
assert.equal(athleteOnboardingStorageKey(''), '')

const auth = readFileSync(new URL('../src/Auth.jsx', import.meta.url), 'utf8')
const dashboard = readFileSync(new URL('../src/Dashboard.jsx', import.meta.url), 'utf8')
const athleteView = readFileSync(new URL('../src/AthleteView.jsx', import.meta.url), 'utf8')

assert.match(auth, /const normalizedEmail = normalizeAthleteLoginEmail\(email\)/)
assert.match(auth, /setError\(athleteAuthErrorMessage\(result\.error, mode\)\)/)
assert.match(auth, /signInWithPassword\(\{ email: normalizedEmail, password \}\)/)
assert.match(auth, /signUp\(\{ email: normalizedEmail, password \}\)/)
assert.match(auth, /mode === 'signup' && !result\.data\?\.session/)
assert.match(auth, /setPassword\(''\)/)
assert.match(auth, /setMode\('login'\)/)
assert.match(auth, /Tjek din email\. Vi har sendt et bekræftelseslink/)
assert.match(auth, /Brug den samme emailadresse, som din coach har registreret/)
assert.match(auth, /Træning &amp; coaching/)
assert.match(auth, /role="status"/)
assert.match(dashboard, /email: normalizeAthleteLoginEmail\(na\.email\) \|\| null/)
assert.doesNotMatch(dashboard, /email: na\.email\.trim\(\) \|\| null/)
assert.match(dashboard, /openProfile\(data, 'program'\)/)
assert.match(dashboard, /setAddingWeek\(true\)/)
assert.match(dashboard, /Opret den første programuge\./)
assert.match(dashboard, /login kan først kobles, når den er udfyldt/)
assert.match(athleteView, /hasCompletedAthleteOnboarding\(localStorage, data\.id\)/)
assert.match(athleteView, /completeAthleteOnboarding\(localStorage, athlete\.id\)/)
assert.match(athleteView, /setTab\(currentWeek \? 'program' : 'hjem'\)/)
assert.match(athleteView, /currentWeek \? 'Se dit program →' : 'Gå til forsiden →'/)
assert.doesNotMatch(athleteView, /localStorage\.setItem\('entropi_onboarded'/)

console.log('Ny-atlet-email, kontobinding og den personlige velkomst er bundet til ét sikkert onboardingflow.')
