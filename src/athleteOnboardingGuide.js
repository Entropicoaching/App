import { homeModel } from './entropi2/home/homeModel.mjs'

// Klik-guiden en ny atlet ser ved sit foerste login. Tre trin (ordre 2065, foer
// fire): velkommen, find dit pas og log et saet. Dagsform har sin egen plads i
// kortet "I dag" paa Hjem og kraever ingen forklaring foer foerste saet.
// Trinnet "find dit pas" lover kun det, klienten faktisk ser: har klienten pas
// i dag, peger det paa "Start dagens pas"; ellers siger det, hvornaar foerste
// pas er, og hvor det findes (se onboardingGuideSteps).
const VELKOMMEN = {
  key: 'velkommen',
  variant: 'intro',
  body: 'Her finder du dit træningsprogram, logger dine løft og holder styr på din udvikling.',
}
const FIND_PAS_I_DAG = {
  key: 'find-session',
  heading: 'Sådan finder du dagens pas.',
  body: 'På Hjem står dagens pas øverst. Tryk på "Start dagens pas". Så åbner du "Overblik over passet" øverst i loggen for at se alle øvelser og sæt. Hele ugens plan finder du under "Se mit program".',
}
const LOG_SAET = {
  key: 'log-saet',
  heading: 'Sådan logger du dagens pas.',
  body: 'Tjek kg (vægt) og reps (gentagelser) i sætkortet, og ret tallene, hvis du løftede noget andet. Når du har lavet sættet, trykker du på den store knap nederst for at gemme det. Den hedder "Som planlagt", når tallene er som i planen, og "Godkendt", når du har rettet dem. Du kan også vælge RPE under "Tilføj oplevet anstrengelse (RPE)". RPE er dit eget skøn over, hvor hårdt sættet føltes, og der er ingen rigtige eller forkerte tal. Er du i tvivl om noget, så spørg din coach.',
}
export const ATHLETE_ONBOARDING_GUIDE_STEPS = [VELKOMMEN, FIND_PAS_I_DAG, LOG_SAET]

const UGEDAGE = ['søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag']
const MAANEDER = ['januar', 'februar', 'marts', 'april', 'maj', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'december']
function foerstePasDato(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso))
  if (!m) return null
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  return `${UGEDAGE[d.getUTCDay()]} den ${Number(m[3])}. ${MAANEDER[Number(m[2]) - 1]}`
}

// Hvad klienten faktisk ser paa Hjem efter guiden, regnet med Hjems egen model
// (homeModel): 'i-dag' (knappen "Start dagens pas"), 'senere' (foerste pas paa
// en dato eller en uge uden fast dag) eller 'intet' (intet pas endnu).
export function beregnGuideKontekst({ allWeeks, currentWeek, exerciseLogs, athlete, now } = {}) {
  let model
  try { model = homeModel({ allWeeks: allWeeks || [], currentWeek, exerciseLogs: exerciseLogs || [], athlete, now }) } catch { model = null }
  if (model?.kind === 'today') return { pas: 'i-dag', landing: 'hjem' }
  if (model?.kind === 'next') return { pas: 'senere', dato: foerstePasDato(model.date), landing: 'hjem' }
  return { pas: 'intet', landing: currentWeek ? 'program' : 'hjem' }
}

// Guidens kontekst ud fra atleten og den aktive uge alene (ordre 2065; AthleteView er pinned og sender kun disse). Ny atlet har ingen logs. Genaabning efter foerste gennemloeb (onboarding_completed_at sat) bruger den neutrale tekst og den gamle landing.
export function guideKontekstFraAtlet(athlete, currentWeek) {
  if (athlete?.onboarding_completed_at != null) return { pas: 'i-dag', landing: undefined }
  return beregnGuideKontekst({ allWeeks: currentWeek ? [currentWeek] : [], currentWeek, exerciseLogs: [], athlete })
}

export function onboardingGuideSteps(kontekst) {
  if (!kontekst || kontekst.pas === 'i-dag') return ATHLETE_ONBOARDING_GUIDE_STEPS
  const find = kontekst.pas === 'senere'
    ? {
      key: 'find-session',
      heading: 'Sådan finder du dit første pas.',
      body: `${kontekst.dato ? `Dit første pas er ${kontekst.dato}.` : 'Dit første pas ligger i din næste uge.'} Du finder det øverst på Hjem under "Start næste pas", og hele ugens plan står under Program.`,
    }
    : {
      key: 'find-session',
      heading: 'Sådan finder du dit program.',
      body: 'Dit program og hvert pas finder du under Program. Står der intet pas endnu, har din coach ikke lagt det ind.',
    }
  return [VELKOMMEN, find, LOG_SAET]
}

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
