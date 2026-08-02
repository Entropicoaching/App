// Entropi programmotor v1 — reviewkatalog for 2-dages styrkebase.
// Kun canonical valg må vælges automatisk. Substitutioner er synlige, men kræver
// en senere eksplicit brugerhandling eller manuel review; de vælges aldrig ud fra
// smerte, skade, sygdom eller fritekst.

export const EXERCISE_CATALOGUE_VERSION = 2
export const SUBSTITUTION_MODE = 'manual-only'

export const EXERCISE_CATALOGUE = [
  {
    id: 'high-bar-squat',
    name: 'High-bar squat',
    family: 'squat-pattern',
    roleClass: 'main',
    status: 'review',
    equipment: ['gym'],
    defaultFor: ['squat-pattern'],
    manualSubstitutionIds: ['low-bar-squat'],
  },
  {
    id: 'low-bar-squat',
    name: 'Low-bar squat',
    family: 'squat-pattern',
    roleClass: 'main',
    status: 'review',
    equipment: ['gym'],
    defaultFor: [],
    manualSubstitutionIds: ['high-bar-squat'],
  },
  {
    id: 'barbell-bench-press',
    name: 'Bænkpres',
    family: 'horizontal-press-pattern',
    roleClass: 'main',
    status: 'review',
    equipment: ['gym'],
    defaultFor: ['bench-pattern'],
    manualSubstitutionIds: ['dumbbell-bench-press'],
  },
  {
    id: 'dumbbell-bench-press',
    name: 'Håndvægtsbænkpres',
    family: 'horizontal-press-pattern',
    roleClass: 'main',
    status: 'review',
    equipment: ['gym'],
    defaultFor: [],
    manualSubstitutionIds: ['barbell-bench-press'],
  },
  {
    id: 'conventional-deadlift',
    name: 'Konventionel dødløft',
    family: 'hinge-pattern',
    roleClass: 'main',
    status: 'review',
    equipment: ['gym'],
    defaultFor: ['hinge-pattern'],
    manualSubstitutionIds: ['sumo-deadlift'],
  },
  {
    id: 'sumo-deadlift',
    name: 'Sumo dødløft',
    family: 'hinge-pattern',
    roleClass: 'main',
    status: 'review',
    equipment: ['gym'],
    defaultFor: [],
    manualSubstitutionIds: ['conventional-deadlift'],
  },
  {
    id: 'romanian-deadlift',
    name: 'Rumænsk dødløft',
    family: 'hinge-assistance-pattern',
    roleClass: 'assistance',
    status: 'review',
    equipment: ['gym'],
    defaultFor: ['hinge-assistance'],
    manualSubstitutionIds: ['stiff-legged-deadlift'],
  },
  {
    id: 'stiff-legged-deadlift',
    name: 'Stiff-legged deadlift',
    family: 'hinge-assistance-pattern',
    roleClass: 'assistance',
    status: 'review',
    equipment: ['gym'],
    defaultFor: [],
    manualSubstitutionIds: ['romanian-deadlift'],
  },
  {
    id: 'pause-squat',
    name: 'Pausesquat',
    family: 'squat-assistance-pattern',
    roleClass: 'assistance',
    status: 'review',
    equipment: ['gym'],
    defaultFor: ['squat-assistance', 'squat-variation'],
    manualSubstitutionIds: ['front-squat', 'tempo-squat'],
  },
  {
    id: 'front-squat',
    name: 'Front squat',
    family: 'squat-assistance-pattern',
    roleClass: 'assistance',
    status: 'review',
    equipment: ['gym'],
    defaultFor: [],
    manualSubstitutionIds: ['pause-squat'],
  },
  {
    id: 'chest-supported-row',
    name: 'Chest-supported row',
    family: 'upper-pull-pattern',
    roleClass: 'assistance',
    status: 'review',
    equipment: ['gym'],
    defaultFor: ['pull'],
    manualSubstitutionIds: ['cable-row', 'machine-row'],
  },
  {
    id: 'cable-row',
    name: 'Kabelroning',
    family: 'upper-pull-pattern',
    roleClass: 'assistance',
    status: 'review',
    equipment: ['gym'],
    defaultFor: [],
    manualSubstitutionIds: ['chest-supported-row'],
  },
  {
    id: 'tempo-squat',
    name: 'Temposquat',
    family: 'squat-assistance-pattern',
    roleClass: 'assistance',
    status: 'review',
    equipment: ['gym'],
    defaultFor: [],
    manualSubstitutionIds: ['pause-squat'],
  },
  {
    id: 'machine-row',
    name: 'Machine row',
    family: 'upper-pull-pattern',
    roleClass: 'assistance',
    status: 'review',
    equipment: ['gym'],
    defaultFor: [],
    manualSubstitutionIds: ['chest-supported-row'],
  },
]

// Reviewede canonical valg for roller der først bruges i 3- og 4-dages rammer.
EXERCISE_CATALOGUE.push(
  { id: 'split-squat', name: 'Split squat', family: 'lower-assistance-pattern', roleClass: 'assistance', status: 'review', equipment: ['gym'], defaultFor: ['lower-assistance'], manualSubstitutionIds: [] },
  { id: 'overhead-press', name: 'Stående skulderpres', family: 'vertical-press-pattern', roleClass: 'assistance', status: 'review', equipment: ['gym'], defaultFor: ['upper-press-assistance'], manualSubstitutionIds: [] },
  { id: 'dumbbell-incline-press', name: 'Skrå håndvægtspres', family: 'horizontal-press-pattern', roleClass: 'assistance', status: 'review', equipment: ['gym'], defaultFor: ['upper-press-variation'], manualSubstitutionIds: [] },
  { id: 'close-grip-bench-press', name: 'Smal bænkpres', family: 'horizontal-press-pattern', roleClass: 'assistance', status: 'review', equipment: ['gym'], defaultFor: ['bench-variation'], manualSubstitutionIds: [] },
  { id: 'lateral-raise', name: 'Side laterals', family: 'upper-assistance-pattern', roleClass: 'assistance', status: 'review', equipment: ['gym'], defaultFor: ['upper-assistance'], manualSubstitutionIds: [] },
  { id: 'lat-pulldown', name: 'Lat pulldown', family: 'vertical-pull-pattern', roleClass: 'assistance', status: 'review', equipment: ['gym'], defaultFor: ['vertical-pull'], manualSubstitutionIds: [] },
  { id: 'ab-wheel', name: 'Ab wheel', family: 'core-pattern', roleClass: 'assistance', status: 'review', equipment: ['gym'], defaultFor: ['core'], manualSubstitutionIds: [] },
)

// Hjemmetræning er et selvstændigt, deterministisk katalog. Varianter bliver
// oversat til en ærlig bevægelsesnær hjemmeøvelse; vi kalder eksempelvis ikke
// en goblet squat for en low-bar squat. `stylePreference` på den opløste
// bevægelse bevarer stadig atletens valg i beslutningssporet.
EXERCISE_CATALOGUE.push(
  { id: 'home-goblet-squat', name: 'Goblet squat', family: 'squat-pattern', roleClass: 'main', status: 'review', equipment: ['home'], defaultFor: ['squat-pattern'], manualSubstitutionIds: ['home-box-squat'] },
  { id: 'home-box-squat', name: 'Box squat med håndvægt', family: 'squat-pattern', roleClass: 'main', status: 'review', equipment: ['home'], defaultFor: [], manualSubstitutionIds: ['home-goblet-squat'] },
  { id: 'home-dumbbell-bench-press', name: 'Håndvægtsbænkpres', family: 'horizontal-press-pattern', roleClass: 'main', status: 'review', equipment: ['home'], defaultFor: ['bench-pattern'], manualSubstitutionIds: ['home-dumbbell-floor-press-main'] },
  { id: 'home-dumbbell-floor-press-main', name: 'Floor press med håndvægte', family: 'horizontal-press-pattern', roleClass: 'main', status: 'review', equipment: ['home'], defaultFor: [], manualSubstitutionIds: ['home-dumbbell-bench-press'] },
  { id: 'home-dumbbell-deadlift', name: 'Dødløft med håndvægte', family: 'hinge-pattern', roleClass: 'main', status: 'review', equipment: ['home'], defaultFor: ['hinge-pattern'], manualSubstitutionIds: ['home-dumbbell-sumo-deadlift'] },
  { id: 'home-dumbbell-sumo-deadlift', name: 'Sumo-dødløft med håndvægt', family: 'hinge-pattern', roleClass: 'main', status: 'review', equipment: ['home'], defaultFor: [], manualSubstitutionIds: ['home-dumbbell-deadlift'] },
  { id: 'home-dumbbell-rdl', name: 'Rumænsk dødløft med håndvægte', family: 'hinge-assistance-pattern', roleClass: 'assistance', status: 'review', equipment: ['home'], defaultFor: ['hinge-assistance'], manualSubstitutionIds: [] },
  { id: 'home-split-squat', name: 'Split squat', family: 'squat-assistance-pattern', roleClass: 'assistance', status: 'review', equipment: ['home'], defaultFor: ['squat-assistance', 'squat-variation'], manualSubstitutionIds: [] },
  { id: 'home-reverse-lunge', name: 'Baglæns udfald', family: 'lower-assistance-pattern', roleClass: 'assistance', status: 'review', equipment: ['home'], defaultFor: ['lower-assistance'], manualSubstitutionIds: [] },
  { id: 'home-one-arm-row', name: 'Enarmet håndvægtsroning', family: 'upper-pull-pattern', roleClass: 'assistance', status: 'review', equipment: ['home'], defaultFor: ['pull'], manualSubstitutionIds: [] },
  { id: 'home-dumbbell-floor-press', name: 'Floor press med håndvægte', family: 'horizontal-press-pattern', roleClass: 'assistance', status: 'review', equipment: ['home'], defaultFor: ['upper-press-variation'], manualSubstitutionIds: [] },
  { id: 'home-close-grip-push-up', name: 'Smalle armstrækninger', family: 'horizontal-press-pattern', roleClass: 'assistance', status: 'review', equipment: ['home'], defaultFor: ['bench-variation'], manualSubstitutionIds: [] },
  { id: 'home-dumbbell-overhead-press', name: 'Skulderpres med håndvægte', family: 'vertical-press-pattern', roleClass: 'assistance', status: 'review', equipment: ['home'], defaultFor: ['upper-press-assistance'], manualSubstitutionIds: [] },
  { id: 'home-band-pulldown', name: 'Nedtræk med elastik', family: 'vertical-pull-pattern', roleClass: 'assistance', status: 'review', equipment: ['home'], defaultFor: ['vertical-pull'], manualSubstitutionIds: [] },
  { id: 'home-lateral-raise', name: 'Side laterals med håndvægte', family: 'upper-assistance-pattern', roleClass: 'assistance', status: 'review', equipment: ['home'], defaultFor: ['upper-assistance'], manualSubstitutionIds: [] },
  { id: 'home-dead-bug', name: 'Dead bug', family: 'core-pattern', roleClass: 'assistance', status: 'review', equipment: ['home'], defaultFor: ['core'], manualSubstitutionIds: [] },
)

export function findExercise(exerciseId) {
  return EXERCISE_CATALOGUE.find(exercise => exercise.id === exerciseId) || null
}

export function defaultExerciseFor(role, equipment = 'gym') {
  return EXERCISE_CATALOGUE.find(exercise => exercise.status === 'review' && exercise.equipment.includes(equipment) && exercise.defaultFor.includes(role)) || null
}

export function exerciseForRolePreference(role, preference, equipment = 'gym') {
  const allowed = {
    gym: {
      'squat-pattern': { 'high-bar': 'high-bar-squat', 'low-bar': 'low-bar-squat' },
      'hinge-pattern': { conventional: 'conventional-deadlift', sumo: 'sumo-deadlift' },
    },
    home: {
      'squat-pattern': { 'high-bar': 'home-goblet-squat', 'low-bar': 'home-box-squat' },
      'hinge-pattern': { conventional: 'home-dumbbell-deadlift', sumo: 'home-dumbbell-sumo-deadlift' },
    },
  }
  if (!preference || preference === 'not-sure') return defaultExerciseFor(role, equipment)
  const exerciseId = allowed[equipment]?.[role]?.[preference]
  return exerciseId ? findExercise(exerciseId) : null
}
