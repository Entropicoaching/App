// Entitlement-model for abonnementsproduktet.
//
// Dette er en INTERN produktværdi — ikke et adgangssystem. Der er ingen
// server, ingen validering og ingen betaling bag den i slice 1. Formålet er
// at holde grænserne mellem de tre niveauer eksplicitte fra starten, så et
// rigtigt adgangssystem senere kan hænges på ét sted.

import { PROGRAMS, STARTER_PROGRAM_ID } from './programs.js'

export const TIERS = ['free', 'member', 'coaching']

// De niveauer DENNE app kan sætte. 'coaching' er med i modellen, fordi en
// bruger kan have det — men appen leverer det ikke og må derfor ikke tilbyde
// det som et valg. I profilen er det et link til Entropi Coach i stedet.
export const SELECTABLE_TIERS = ['free', 'member']

export const TIER_LABEL = {
  free: 'Gratis',
  member: 'Medlem',
  coaching: '1:1-coaching',
}

export const TIER_NOTE = {
  free: 'Startprogram, logning og simpel historik.',
  member: 'Hele programbiblioteket og progression pr. øvelse.',
  coaching: 'Leveres i den eksisterende Entropi-atletportal — ikke i denne app.',
}

// Feature → de tiers der har adgang. Bevidst en eksplicit liste frem for et
// hierarki: 'coaching' er et andet produkt, ikke "member + mere", og skal
// kunne mangle ting som 'member' har.
const ACCESS = {
  'program.starter': ['free', 'member', 'coaching'],
  'program.library': ['member', 'coaching'],
  // Løkken: følg → evaluér indsats → nyt tilpasset program → følg igen.
  // Det er DET der er produktet, jf. status/APP-FLOW.md — ikke adgangen til
  // flere programmer. Gratis kan træne, men programmet lærer intet om én.
  'program.adaptive': ['member', 'coaching'],
  'training.log': ['free', 'member', 'coaching'],
  'history.sessions': ['free', 'member', 'coaching'],
  'history.progression': ['member', 'coaching'],
  // Findes i modellen, men leveres aldrig af denne app.
  'coaching.personal': ['coaching'],
}

export function can(entitlement, feature) {
  const allowed = ACCESS[feature]
  if (!allowed) return false
  return allowed.includes(entitlement)
}

// Hvad brugeren får at vide når noget ikke er inkluderet. Aldrig en pris,
// aldrig en købsknap — første slice viser intet betalingsflow.
export function missingFeatureNote(feature) {
  if (feature === 'program.library') return 'Flere programmer er ikke inkluderet på dit niveau.'
  if (feature === 'program.adaptive') return 'Programmet tilpasser sig ikke på dit niveau. Du vælger selv det næste.'
  if (feature === 'history.progression') return 'Progression pr. øvelse er ikke inkluderet på dit niveau.'
  if (feature === 'coaching.personal') return 'Personlig coaching foregår i Entropis atletportal.'
  return 'Ikke inkluderet på dit niveau.'
}

export function isTier(value) {
  return TIERS.includes(value)
}

// --- gratis-sporet ----------------------------------------------------------
//
// Gratis er en åben ende, ikke en løkke: vælg program → følg det → vælg et nyt.
// Den eneste grænse der skal håndhæves er HVILKE programmer der kan vælges, og
// at der ikke sker en tilpasning undervejs.
//
// CT-031: gratis starter med ét program, og listen vokser over tid. Derfor en
// EKSPLICIT liste og ikke en regel — at lægge et program ud gratis skal være en
// beslutning nogen har truffet, ikke en konsekvens af at det har lavt
// udstyrskrav. Tilføj et id her, og hele appen følger med.
export const FREE_PROGRAM_IDS = [STARTER_PROGRAM_ID]

// Hvad brugeren rent faktisk kan vælge imellem på sit niveau.
export function availableProgramIds(entitlement) {
  if (can(entitlement, 'program.library')) return PROGRAMS.map(p => p.id)
  if (can(entitlement, 'program.starter')) {
    // Kun de gratis-udpegede der stadig findes i kataloget. Et id der bliver
    // fjernet fra PROGRAMS må ikke kunne overleve som et dødt valg her.
    return FREE_PROGRAM_IDS.filter(id => PROGRAMS.some(p => p.id === id))
  }
  return []
}

// Er der overhovedet et valg at træffe? Med ét gratis program er svaret nej i
// dag — tegningen siger flertal, CT-031 siger senere. UI'et skal kunne skelne
// mellem "du må ikke vælge" og "der er kun ét at vælge".
export function canChooseProgram(entitlement) {
  return availableProgramIds(entitlement).length > 1
}

// Må dette program bruges på niveauet? Ét sted at spørge, så et programvalg
// aldrig kan smutte uden om grænsen.
export function canUseProgram(entitlement, programId) {
  return availableProgramIds(entitlement).includes(programId)
}

// --- hvad et niveau indeholder ----------------------------------------------
//
// Til forsiden. Den skal kunne stille de to søjler op mod hinanden UDEN at
// gentage listen i JSX — en landingsside der lover noget ACCESS ikke giver er
// en løgn der først opdages af en betalende bruger.

export const FEATURE_LABEL = {
  'program.starter': 'Et program der passer til dig',
  'program.library': 'Hele programbiblioteket',
  'program.adaptive': 'Programmet tilpasser sig efter hver uge',
  'training.log': 'Log dine sæt undervejs',
  'history.sessions': 'Historik over dine pas',
  'history.progression': 'Progression pr. øvelse',
}

// Rækkefølgen er salgsrækkefølgen: det vigtigste først. 'coaching.personal'
// står bevidst IKKE her — det er et andet produkt og hører ikke til på
// forsiden for abonnementet.
export const LANDING_FEATURES = [
  'program.starter',
  'program.adaptive',
  'program.library',
  'training.log',
  'history.sessions',
  'history.progression',
]

// Hvad niveauet giver og ikke giver, i fast rækkefølge.
export function featureSummary(entitlement) {
  return LANDING_FEATURES.map(feature => ({
    feature,
    label: FEATURE_LABEL[feature],
    included: can(entitlement, feature),
  }))
}
