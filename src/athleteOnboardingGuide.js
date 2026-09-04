// Klik-guiden en ny atlet ser ved sit foerste login. Fire trin, valgt fordi de
// er stederne en ny bruger reelt kan gaa i staa: parathed (foerste nye
// interaktion), find-session (hvor er min traening) og log-saet (selve
// kerne-handlingen). "Hjem"-overblikket og selve traeningsugen er ikke med --
// de kraever ingen handling og har ingen reel risiko for at gaa i staa.
export const ATHLETE_ONBOARDING_GUIDE_STEPS = [
  {
    key: 'velkommen',
    variant: 'intro',
    body: 'Her finder du dit træningsprogram, logger dine løft og holder styr på din udvikling.',
  },
  {
    key: 'parathed',
    heading: 'Start med din parathed.',
    body: 'Før du træner, logger du søvn, energi og hvordan kroppen føles. Det tager under et minut og hjælper dig og din coach med at følge formen.',
  },
  {
    key: 'find-session',
    heading: 'Sådan finder du din træning.',
    body: 'På Hjem ser du ugens program. Sessionen der står for tur er markeret som "Næste". Tryk på den, så folder den sig ud med dagens øvelser.',
  },
  {
    key: 'log-saet',
    heading: 'Sådan logger du et sæt.',
    body: 'For hver øvelse skriver du vægten og reps du løftede, og vælger den RPE der passer. Gør det sæt for sæt, så følger programmet med.',
  },
]

export function totalOnboardingGuideSteps() {
  return ATHLETE_ONBOARDING_GUIDE_STEPS.length
}

export function isLastOnboardingGuideStep(index) {
  return index >= ATHLETE_ONBOARDING_GUIDE_STEPS.length - 1
}

export function clampOnboardingGuideStep(index) {
  const n = Number.isFinite(index) ? index : 0
  return Math.min(Math.max(n, 0), ATHLETE_ONBOARDING_GUIDE_STEPS.length - 1)
}

// Server-side kilde: onboarding_completed_at paa athletes-raekken, saa
// tilstanden foelger brugeren paa tvaers af enheder (ikke kun browseren hvor
// guiden foerst blev vist).
export function hasCompletedOnboardingGuide(athlete) {
  return athlete?.onboarding_completed_at != null
}
