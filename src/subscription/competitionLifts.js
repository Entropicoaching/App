// Konkurrenceløftene — og de tre knapper man skruer på.
//
// Marc, 5. august 2026: "vi bliver nødt til at tænke hvordan bliver et individ
// stærkere, vi skruer på volume, frekvens og intensitet for konkurrenceløftene."
// Og: konkurrenceløftene skal ALTID være med når udstyret tillader det.
//
// Før dette lå de tre størrelser ikke nogen steder. `progression` var én
// tekststreng per program, og der fandtes ingen måde at se — endsige måle —
// hvor meget squat en bruger faktisk får om ugen.
//
// Designvalg: tallene UDLEDES af programmets pas, de skrives ikke ved siden af.
// To kilder ville drive fra hinanden, og så ville tallet lyve.

export const COMPETITION_LIFTS = ['squat', 'bench', 'deadlift']

export const LIFT_LABEL = {
  squat: 'Squat',
  bench: 'Bænkpres',
  deadlift: 'Dødløft',
}

// En øvelse tæller kun som konkurrenceløft hvis den bærer `lift`. Det er
// bevidst eksplicit: 'knaeboej' er en kropsvægtssquat og 'gobletsquat' er en
// håndvægtssquat — begge er squat-mønstre, men ingen af dem er DET løft man
// bliver målt på. Kun stangen tæller.
export function isCompetitionLift(exercise) {
  return Boolean(exercise && COMPETITION_LIFTS.includes(exercise.lift))
}

function alleOevelser(program) {
  const ud = []
  for (const session of program.sessions) {
    for (const exercise of session.exercises) ud.push({ session, exercise })
  }
  return ud
}

// Hvilke konkurrenceløft findes overhovedet i programmet.
export function liftsInProgram(program) {
  const fundet = new Set()
  for (const { exercise } of alleOevelser(program)) {
    if (isCompetitionLift(exercise)) fundet.add(exercise.lift)
  }
  return COMPETITION_LIFTS.filter(l => fundet.has(l))
}

// FREKVENS: hvor mange pas om ugen rammer løftet.
export function frequency(program, lift) {
  const pas = new Set()
  for (const { session, exercise } of alleOevelser(program)) {
    if (exercise.lift === lift) pas.add(session.id)
  }
  return pas.size
}

// VOLUME: arbejdssæt om ugen på løftet.
export function weeklySets(program, lift) {
  let sum = 0
  for (const { exercise } of alleOevelser(program)) {
    if (exercise.lift === lift) sum += exercise.sets
  }
  return sum
}

// --- progressive overload ---------------------------------------------------
//
// Marc, 5. august: "tænk progressive overload, så en langsom stigning i RPE."
//
// Intensiteten er derfor ikke ét tal, men en kurve over en blok. Modellen er
// bevidst lille — tre tal per løft — så den kan læses og rettes af et menneske
// frem for at være en algoritme man skal tage på ordet.
//
// Ugen udledes af GENNEMFØRTE PAS, ikke af kalenderen. Man rykker frem ved at
// træne. En bruger der holder en uges pause taber ikke sin blok, og en der
// tager to pas på en dag springer ikke en uge over.

// Marcs specifikation 5. august 2026: femugers blokke, RPE starter omkring
// 6–6,5 i uge 1 og slutter 8,5–9 i uge 5. Rammen er hans; fordelingen inden
// for intervallet er valgt i programs.js og står dokumenteret dér.
export const RPE_PROGRESSION_CONFIRMED = true
export const BLOCK_WEEKS = 5

// FREKVENSMÅL, Marc 5. august: "så høj frekvens som giver mening — vi skal dog
// have fatigue management." Bænk tåler mest, de to tunge underkropsløft mindst.
// [min, max] pas om ugen.
export const FREQUENCY_TARGET = {
  squat: [1, 2],
  bench: [2, 3],
  deadlift: [1, 2],
}

// Fatigue management i praksis: rammer man samme løft flere gange om ugen, kan
// passene ikke alle være tunge. `role` siger hvad passet er til.
//   'tung'    — dagens hovedløft, kører blokkens RPE
//   'let'     — teknik og volumen, kører lavere RPE end den tunge dag
export const LIFT_ROLES = ['tung', 'let']

// Hvor meget lavere den lette dag ligger. Ét sted, så det kan skrues på.
export const LIGHT_DAY_RPE_OFFSET = 1.5

export const RPE_STEP = 0.5

// Runder til nærmeste halve RPE. Ingen siger "RPE 7,3" i et træningscenter.
function rundRpe(v) {
  return Math.round(v / RPE_STEP) * RPE_STEP
}

// RPE i en given uge af blokken. Uge 1 er start, sidste uge er slut, og
// derimellem stiger den lineært i halve trin.
export function rpeForWeek(progression, week, role = 'tung') {
  if (!progression) return null
  const { start, slut, uger } = progression
  const offset = role === 'let' ? LIGHT_DAY_RPE_OFFSET : 0
  if (uger <= 1) return rundRpe(slut - offset)
  const i = Math.min(Math.max(week, 1), uger)
  return rundRpe(start + ((slut - start) * (i - 1)) / (uger - 1) - offset)
}

// Frekvensen holdt op mod målet. Returnerer null når løftet ikke er i
// programmet — det er en anden fejl, som missingCompetitionLifts fanger.
export function frequencyCheck(program, lift) {
  const faktisk = frequency(program, lift)
  if (faktisk === 0) return null
  const [min, max] = FREQUENCY_TARGET[lift]
  return { faktisk, min, max, holder: faktisk >= min && faktisk <= max }
}

// Hele kurven — til at kigge på og vurdere om stigningen er for hurtig.
export function rpeCurve(progression) {
  if (!progression) return []
  return Array.from({ length: progression.uger }, (_, i) => rpeForWeek(progression, i + 1))
}

// Hvilken uge i blokken er man i? Udledt af gennemførte pas og programmets
// ugentlige frekvens. Blokken gentager sig — efter sidste uge starter man
// forfra, hvilket er hvad en deload/ny blok er i praksis.
export function weekInBlock(program, gennemfoertePas, progression) {
  if (!progression || !program.days) return 1
  const uge = Math.floor(gennemfoertePas / program.days)
  return (uge % progression.uger) + 1
}

// INTENSITET: kan ikke udledes af sæt og reps alene — den kræver en angivelse.
// Returnerer null når programmet ikke siger det, så en manglende værdi bliver
// SYNLIG frem for at blive gættet til noget plausibelt.
export function intensity(program, lift) {
  const angivelser = []
  for (const { exercise } of alleOevelser(program)) {
    if (exercise.lift !== lift) continue
    if (exercise.rpeProgression) {
      const k = rpeCurve(exercise.rpeProgression)
      angivelser.push(`RPE ${k[0]} → ${k[k.length - 1]} over ${k.length} uger`)
    } else if (exercise.percent1rm) angivelser.push(`${exercise.percent1rm} % af 1RM`)
    else if (exercise.rpe) angivelser.push(`RPE ${exercise.rpe}`)
  }
  return angivelser.length ? [...new Set(angivelser)].join(' · ') : null
}

// Samlet billede pr. løft. Det er den her et menneske skal kunne kigge på og
// sige "det er for lidt squat" eller "den intensitet holder ikke".
export function liftSummary(program) {
  return COMPETITION_LIFTS.map(lift => ({
    lift,
    label: LIFT_LABEL[lift],
    findes: frequency(program, lift) > 0,
    frekvens: frequency(program, lift),
    saetPrUge: weeklySets(program, lift),
    intensitet: intensity(program, lift),
  }))
}

// REGLEN Marc satte 5. august: tillader udstyret en stang, skal alle tre
// konkurrenceløft være med. `minEquipment: 2` er "fuldt træningscenter".
//
// Bemærk hvad reglen IKKE siger: den kræver intet af hjemme- og
// håndvægtsprogrammer. Man kan ikke lave konkurrenceløft uden stang, og et
// program skal ikke straffes for at være ærligt om sit udstyr.
export const BARBELL_EQUIPMENT_TIER = 2

export function requiresCompetitionLifts(program) {
  return program.minEquipment >= BARBELL_EQUIPMENT_TIER
}

// Returnerer de løft der MANGLER. Tom liste = programmet holder.
export function missingCompetitionLifts(program) {
  if (!requiresCompetitionLifts(program)) return []
  const har = new Set(liftsInProgram(program))
  return COMPETITION_LIFTS.filter(l => !har.has(l))
}
