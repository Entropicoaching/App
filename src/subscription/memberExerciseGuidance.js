import { findExercise, SUBSTITUTION_MODE } from './exerciseCatalogue.js'
import { isMemberBodyweightMovement, parseTimedPrescription } from './memberExerciseLogging.js'

// Korte fokuspunkter til øvelser, som programmotorens reviewkatalog kan vise.
// De beskriver udførelsen uden at vurdere smerte, skader eller bevægelighed.
const CUES_BY_EXERCISE_ID = Object.freeze({
  'high-bar-squat': ['Hold trykket gennem hele foden.', 'Lad knæ og hofte bevæge sig sammen gennem vendingen.'],
  'low-bar-squat': ['Spænd øvre ryg, så stangen ligger stabilt.', 'Hold balancen over midtfoden, mens hoften går tilbage og ned.'],
  'barbell-bench-press': ['Saml skulderbladene og hold fødderne i gulvet.', 'Sænk stangen kontrolleret til samme punkt på brystet.'],
  'dumbbell-bench-press': ['Hold håndleddene over albuerne.', 'Sænk håndvægtene roligt til samme dybde i begge sider.'],
  'conventional-deadlift': ['Start med stangen over midtfoden.', 'Pres gulvet væk og hold stangen tæt på kroppen.'],
  'sumo-deadlift': ['Start med stangen over midtfoden.', 'Pres knæene i tåretningen og hold stangen tæt.'],
  'romanian-deadlift': ['Skub hoften bagud med let bøjede knæ.', 'Hold vægten tæt og vend, mens ryggen stadig er stabil.'],
  'stiff-legged-deadlift': ['Hold knævinklen næsten uændret gennem sættet.', 'Før stangen tæt langs benene, mens hoften går bagud.'],
  'pause-squat': ['Find en stabil bundposition før pausen.', 'Bevar spændingen og rejs dig uden at skynde på vendingen.'],
  'front-squat': ['Hold albuerne højt, så stangen ligger roligt.', 'Bevar trykket gennem hele foden på vej ned og op.'],
  'chest-supported-row': ['Hold brystet mod støtten gennem hele sættet.', 'Træk albuerne tilbage uden at løfte skuldrene.'],
  'cable-row': ['Hold overkroppen rolig.', 'Træk grebet ind og før det kontrolleret tilbage.'],
  'tempo-squat': ['Brug det samme rolige tempo hele vejen ned.', 'Bevar balancen over midtfoden gennem vendingen.'],
  'machine-row': ['Hold bryst og overkrop stabile mod maskinen.', 'Træk albuerne tilbage og slip vægten kontrolleret.'],
  'split-squat': ['Fordel fødderne, så forreste fod bliver i gulvet.', 'Sænk kroppen roligt og pres gennem forreste ben.'],
  'overhead-press': ['Spænd mave og balder før hvert sæt.', 'Pres stangen tæt forbi ansigtet og afslut over skuldrene.'],
  'dumbbell-incline-press': ['Hold håndleddene over albuerne.', 'Sænk håndvægtene roligt og pres dem i samme bane.'],
  'close-grip-bench-press': ['Hold grebet smalt nok til, at håndled og albuer stadig flugter.', 'Sænk stangen kontrolleret og hold fødderne i gulvet.'],
  'lateral-raise': ['Løft med en rolig albueføring.', 'Stop før skuldrene trækker sig op mod ørerne.'],
  'lat-pulldown': ['Hold brystkassen rolig og fødderne i gulvet.', 'Træk albuerne ned og før grebet kontrolleret tilbage.'],
  'ab-wheel': ['Spænd balder og mave, før du ruller ud.', 'Vend, før lænden mister sin stabile position.'],
  'home-goblet-squat': ['Hold håndvægten tæt foran brystet.', 'Bevar trykket gennem hele foden på vej ned og op.'],
  'home-box-squat': ['Stå stabilt foran boksen og hold vægten tæt.', 'Rør boksen kontrolleret og rejs dig uden at falde tilbage.'],
  'home-dumbbell-bench-press': ['Hold håndleddene over albuerne.', 'Sænk håndvægtene roligt til samme dybde i begge sider.'],
  'home-dumbbell-floor-press-main': ['Lad overarmene lande roligt på gulvet.', 'Hold håndleddene over albuerne, når du presser.'],
  'home-dumbbell-deadlift': ['Start med håndvægtene tæt ved fødderne.', 'Pres gulvet væk og hold vægtene tæt på kroppen.'],
  'home-dumbbell-sumo-deadlift': ['Stå bredt med knæene i tåretningen.', 'Hold håndvægten tæt og pres gulvet væk.'],
  'home-dumbbell-rdl': ['Skub hoften bagud med let bøjede knæ.', 'Hold håndvægtene tæt og overkroppen stabil.'],
  'home-split-squat': ['Fordel fødderne, så forreste fod bliver i gulvet.', 'Sænk kroppen roligt og pres gennem forreste ben.'],
  'home-reverse-lunge': ['Træd roligt bagud og behold balancen på forreste fod.', 'Pres gennem forreste ben, når du samler fødderne igen.'],
  'home-one-arm-row': ['Støt kroppen, så overkroppen er rolig.', 'Træk albuen mod hoften og sænk håndvægten kontrolleret.'],
  'home-dumbbell-floor-press': ['Lad overarmene lande roligt på gulvet.', 'Hold håndleddene over albuerne, når du presser.'],
  'home-close-grip-push-up': ['Hold kroppen samlet fra skuldre til fødder.', 'Sænk brystet roligt med albuerne tættere på kroppen.'],
  'home-dumbbell-overhead-press': ['Spænd mave og balder før hvert sæt.', 'Pres håndvægtene op i en stabil bane over skuldrene.'],
  'home-band-pulldown': ['Fastgør elastikken, så den ligger stabilt.', 'Træk albuerne ned og slip spændingen kontrolleret.'],
  'home-lateral-raise': ['Løft med en rolig albueføring.', 'Stop før skuldrene trækker sig op mod ørerne.'],
  'home-dead-bug': ['Hold lænden rolig mod gulvet.', 'Bevæg modsat arm og ben uden at miste spændingen.'],
})

function exerciseIdFrom(value) {
  if (typeof value === 'string') return value
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return typeof value.exerciseId === 'string' ? value.exerciseId : null
}

function manualSubstitutionsFor(exercise) {
  const substitutions = []
  for (const exerciseId of exercise.manualSubstitutionIds) {
    const substitute = findExercise(exerciseId)
    // A broken catalogue reference must not become a user-facing suggestion.
    if (!substitute) return null
    substitutions.push(Object.freeze({
      exerciseId: substitute.id,
      exerciseName: substitute.name,
    }))
  }
  return Object.freeze(substitutions)
}

export function memberExerciseGuidance(value) {
  const exerciseId = exerciseIdFrom(value)
  const exercise = exerciseId ? findExercise(exerciseId) : null
  const cues = exerciseId ? CUES_BY_EXERCISE_ID[exerciseId] : null
  if (!exercise || !Array.isArray(cues) || cues.length < 1 || cues.length > 2) return null

  const manualSubstitutions = manualSubstitutionsFor(exercise)
  if (!manualSubstitutions) return null

  const movement = typeof value === 'object' && value !== null
    ? value
    : { exerciseId }
  const timedPrescription = parseTimedPrescription(movement.prescription)

  return Object.freeze({
    exerciseId: exercise.id,
    exerciseName: exercise.name,
    cues: Object.freeze([...cues]),
    measurement: Object.freeze({
      load: isMemberBodyweightMovement(movement) ? 'bodyweight' : 'external-load',
      target: timedPrescription ? 'time' : 'repetitions',
      timedPrescription: timedPrescription ? Object.freeze({ ...timedPrescription }) : null,
    }),
    substitutionMode: SUBSTITUTION_MODE,
    autoSelectSubstitution: false,
    manualSubstitutions,
  })
}
