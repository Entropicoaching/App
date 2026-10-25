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
    body: 'Før du træner, logger du søvn, energi og hvordan kroppen føles. Det hjælper dig og din coach med at følge formen.',
  },
  {
    key: 'find-session',
    heading: 'Sådan ser du din uge og dagens pas.',
    body: 'På Hjem ser du ugens plan og kortet med dagens næste sæt. Tryk på "Hele passet" nederst i sætkortet for at se et pasoverblik med alle øvelser og sæt.',
  },
  {
    key: 'log-saet',
    heading: 'Sådan logger du dagens pas.',
    body: 'Tjek kg (vægt) og reps (gentagelser) i sætkortet, og ret tallene, hvis du løftede noget andet. Når du har lavet sættet, trykker du på "Godkendt" for at gemme det. Du kan også vælge RPE. RPE er dit eget skøn over, hvor hårdt sættet føltes, og der er ingen rigtige eller forkerte tal. Er du i tvivl om noget, så spørg din coach.',
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
