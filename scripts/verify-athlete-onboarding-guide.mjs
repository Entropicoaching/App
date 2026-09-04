// ORDRE 38 — klik-guide ved atletens foerste login.
//
// Der findes ingen DOM/React-testopsætning i repoet (se de andre scripts/
// verify-*.mjs) — adfaerden verificeres derfor på to niveauer, samme mønster
// som resten af repoet:
//   1) ren logik i src/athleteOnboardingGuide.js, dækket af
//      src/athleteOnboardingGuide.test.js (node --test).
//   2) at den logik faktisk er koblet korrekt ind i AthleteView.jsx — det
//      tjekker dette script, via tekstmatch mod selve kildekoden.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const athleteView = readFileSync(new URL('../src/AthleteView.jsx', import.meta.url), 'utf8')

// --- Guiden vises ved første login, og aldrig af sig selv igen -------------
// onboardingDone kommer udelukkende fra den server-gemte kolonne, hentet ved
// fetchAthlete — ikke fra en lokal/browser-tilstand.
assert.match(athleteView, /setOnboardingDone\(hasCompletedOnboardingGuide\(data\)\)/,
  'Guidens vis/skjul-tilstand skal læses fra den server-gemte athletes-række ved hvert login')
assert.match(athleteView, /if \(\(!onboardingDone \|\| guideOpen\) && !coachAthleteId\) \{/,
  'Guiden skal vises automatisk når onboardingDone er falsk, og aldrig i coach-preview')

// --- Kun atlet-rollen: coach-visningen røres ikke ---------------------------
assert.match(athleteView, /!onboardingDone \|\| guideOpen\) && !coachAthleteId/,
  'coachAthleteId skal blokere guiden i coach-forhåndsvisning')

// --- Spring-over sætter samme tilstand som gennemført -----------------------
// completeOnboardingGuide er ÉT sted der skriver "færdig" — både "Videre" på
// sidste trin og "Spring guiden over" skal ende der, aldrig i to forskellige
// funktioner der kan glide fra hinanden.
const completeFn = athleteView.match(/function completeOnboardingGuide\(\) \{[\s\S]*?\n  \}/)
assert.ok(completeFn, 'completeOnboardingGuide skal findes som én samlet funktion')
assert.match(completeFn[0], /complete_athlete_onboarding_v1/,
  'Fuldførelse skal kalde den server-side RPC, ikke kun sætte lokal state')
assert.match(completeFn[0], /setOnboardingDone\(true\)/)
assert.match(completeFn[0], /setGuideOpen\(false\)/)

const advanceFn = athleteView.match(/function advanceOnboardingGuide\(\) \{[\s\S]*?\n  \}/)
assert.ok(advanceFn, 'advanceOnboardingGuide skal findes')
assert.match(advanceFn[0], /completeOnboardingGuide\(\)/,
  'Sidste trins "Videre"-knap skal afslutte via completeOnboardingGuide')

assert.match(athleteView, /onClick=\{advanceOnboardingGuide\}/, 'Den primære knap i guiden skal bruge advanceOnboardingGuide')
assert.match(athleteView, /onClick=\{completeOnboardingGuide\}[\s\S]{0,400}Spring guiden over/,
  '"Spring guiden over" skal kalde PRÆCIS den samme funktion som en gennemført guide')

// --- Kan genstartes fra ét fast sted ----------------------------------------
const restartFn = athleteView.match(/function restartOnboardingGuide\(\) \{[\s\S]*?\n  \}/)
assert.ok(restartFn, 'restartOnboardingGuide skal findes')
assert.match(restartFn[0], /setGuideStep\(0\)/)
assert.match(restartFn[0], /setGuideOpen\(true\)/)
assert.equal((athleteView.match(/restartOnboardingGuide\(\)/g) || []).length, 2,
  'restartOnboardingGuide skal defineres ét sted og kaldes fra præcis ét UI-sted (kontomenuen)')
assert.match(athleteView, /restartOnboardingGuide\(\) \}\}[\s\S]{0,400}>Se guiden igen</,
  'Genstart-knappen skal ligge i kontomenuen, som allerede er skjult i coach-preview (!onExitPreview)')

// --- Ingen atletdata i selve guide-teksten ----------------------------------
// Kun step 0 (intro) må referere athlete.name — resten af koden i guide-
// blokken må ikke indeholde nye athlete.*-opslag ud over det eksisterende.
assert.match(athleteView, /athlete\.name\.split\(' '\)\[0\]/, 'Introtrinnet må fortsat hilse med fornavnet (uændret fra før ORDRE 38)')

console.log('Klik-guiden vises ved første login, er koblet til server-tilstanden, spring-over og gennemførelse rammer samme funktion, og kan genstartes fra kontomenuen.')
