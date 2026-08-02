// Entitlement-model for abonnementsproduktet.
//
// Dette er en INTERN produktværdi — ikke et adgangssystem. Der er ingen
// server, ingen validering og ingen betaling bag den i slice 1. Formålet er
// at holde grænserne mellem de tre niveauer eksplicitte fra starten, så et
// rigtigt adgangssystem senere kan hænges på ét sted.

export const TIERS = ['free', 'member', 'coaching']

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
  if (feature === 'history.progression') return 'Progression pr. øvelse er ikke inkluderet på dit niveau.'
  if (feature === 'coaching.personal') return 'Personlig coaching foregår i Entropis atletportal.'
  return 'Ikke inkluderet på dit niveau.'
}

export function isTier(value) {
  return TIERS.includes(value)
}
