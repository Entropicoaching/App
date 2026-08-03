// Reviewbare standardrecepter for programmotoren. De er lokale udkast, ikke
// brugeraktiverede programmer. Et udkast kan først tildeles når Marc har låst
// det som en ny programversion i den sikre write-path.

export const PRESCRIPTION_LIBRARY_VERSION = 3
export const STANDARD_LOAD_INCREMENT_KG = 2.5

const GENERAL = {
  'squat-pattern': { sets: 3, reps: '5–7', targetReps: 6, targetRpe: '6–7', weekOnePercentOfEstimated1RM: 0.725, progressionPercent: 0.025 },
  'bench-pattern': { sets: 3, reps: '6–8', targetReps: 7, targetRpe: '6–7', weekOnePercentOfEstimated1RM: 0.675, progressionPercent: 0.025 },
  'hinge-pattern': { sets: 2, reps: '5–6', targetReps: 5, targetRpe: '6–7', weekOnePercentOfEstimated1RM: 0.70, progressionPercent: 0.025 },
  'hinge-assistance': { sets: 2, reps: '8–10', targetRpe: '6–7' },
  'squat-assistance': { sets: 2, reps: '8–10', targetRpe: '6–7' },
  'squat-variation': { sets: 2, reps: '6–8', targetRpe: '6–7' },
  'bench-variation': { sets: 2, reps: '8–10', targetRpe: '6–7' },
  'upper-press-variation': { sets: 2, reps: '8–10', targetRpe: '6–7' },
  'upper-press-assistance': { sets: 2, reps: '8–12', targetRpe: '6–7' },
  'lower-assistance': { sets: 2, reps: '8–12', targetRpe: '6–7' },
  pull: { sets: 3, reps: '8–12', targetRpe: '6–7' },
  'vertical-pull': { sets: 2, reps: '8–12', targetRpe: '6–7' },
  'upper-assistance': { sets: 2, reps: '10–15', targetRpe: '6–7' },
  core: { sets: 2, reps: '8–15', targetRpe: '6–7' },
}

const POWERLIFTING = {
  ...GENERAL,
  'squat-pattern': { sets: 3, reps: '4–6', targetReps: 5, targetRpe: '6–7', weekOnePercentOfEstimated1RM: 0.75, progressionPercent: 0.025 },
  'bench-pattern': { sets: 3, reps: '4–6', targetReps: 5, targetRpe: '6–7', weekOnePercentOfEstimated1RM: 0.70, progressionPercent: 0.025 },
  'hinge-pattern': { sets: 2, reps: '3–5', targetReps: 4, targetRpe: '6–7', weekOnePercentOfEstimated1RM: 0.725, progressionPercent: 0.025 },
  'squat-assistance': { sets: 2, reps: '5–7', targetRpe: '6–7' },
  'bench-variation': { sets: 2, reps: '5–7', targetRpe: '6–7' },
}

const LIBRARIES = { 'general-strength': GENERAL, 'powerlifting-foundation': POWERLIFTING }

const MAIN_ROLES = new Set(['squat-pattern', 'bench-pattern', 'hinge-pattern'])

function beginnerPrescription(prescription, role) {
  const result = {
    ...prescription,
    // Fire dage for en nybegynder er en frekvensfordeling, ikke tilladelse til
    // at kopiere den øvedes ugentlige volumen. V1-begynderbanen har højst to
    // arbejdssæt pr. øvelse og et enkelt, synligt RPE-6-mål.
    sets: Math.min(prescription.sets, 2),
    targetRpe: '6',
  }
  if (MAIN_ROLES.has(role) && Number.isFinite(result.weekOnePercentOfEstimated1RM)) {
    result.weekOnePercentOfEstimated1RM = Math.round(Math.max(0.5, result.weekOnePercentOfEstimated1RM - 0.025) * 1000) / 1000
  }
  return result
}

export function prescriptionFor(goal, role, level = 'oevet', equipment = 'gym') {
  const base = LIBRARIES[goal]?.[role]
  if (!base || !['begynder', 'oevet'].includes(level) || !['home', 'gym'].includes(equipment)) return null
  const prescription = level === 'begynder' ? beginnerPrescription(base, role) : { ...base }
  return {
    ...prescription,
    // Begge udstyrsbaner bruger samme synlige standardtrin. Evidensmotoren
    // fastholder stadig belastningen, når ugens logning ikke kan godkendes.
    loadIncrementKg: STANDARD_LOAD_INCREMENT_KG,
    maximumRealizedProgressionPercent: 0.03,
    experienceLane: level,
    equipmentLane: equipment,
    libraryVersion: PRESCRIPTION_LIBRARY_VERSION,
    status: 'review',
  }
}
