// Faste programmer. Rene data — ingen generering, ingen tilpasning i drift.
//
// Princip: programmet er fast og gennemskueligt. Brugeren skal kunne læse hele
// sit forløb på forhånd, og appen laver ingen automatiske træningspåstande.

export const LEVELS = [
  { id: 'begynder', label: 'Nybegynder', note: 'Under cirka 6 måneders struktureret styrketræning' },
  { id: 'oevet', label: 'Øvet', note: 'Cirka 6+ måneder med struktureret styrketræning' },
]

// Udstyr er et trin, ikke en liste: hvert trin indeholder det forrige.
export const EQUIPMENT = [
  { id: 'bodyweight', label: 'Kropsvægt og elastik', tier: 0 },
  { id: 'dumbbells', label: 'Håndvægte derhjemme', tier: 1 },
  { id: 'gym', label: 'Fuldt træningscenter', tier: 2 },
]

export const DAY_OPTIONS = [2, 3, 4]

export function equipmentTier(equipmentId) {
  const found = EQUIPMENT.find(e => e.id === equipmentId)
  return found ? found.tier : 0
}

export const PROGRAMS = [
  {
    id: 'start-2',
    name: 'Fuldkrop 2',
    tagline: 'To ugentlige fuldkropspas',
    days: 2,
    levels: ['begynder', 'oevet'],
    minEquipment: 0,
    summary: 'Grundprogrammet. To pas om ugen, fire øvelser pr. pas, ingen udstyrskrav.',
    progression: 'Rammer du toppen af repintervallet i alle sæt, lægger du 2,5 kg på næste gang — eller tager én rep mere ved kropsvægt. Ellers gentager du.',
    sessions: [
      {
        id: 'a',
        name: 'Fuldkrop A',
        exercises: [
          { id: 'knaeboej', name: 'Knæbøj', sets: 3, reps: '8–12', rest: 90 },
          { id: 'armstraek', name: 'Armstrækninger', sets: 3, reps: '5–10', rest: 90, note: 'På skrå mod en bænk hvis gulvet er for tungt.' },
          { id: 'hofteloeft', name: 'Hofteløft', sets: 3, reps: '10–15', rest: 60 },
          { id: 'elastik-roning', name: 'Roning med elastik', sets: 3, reps: '10–15', rest: 60 },
        ],
      },
      {
        id: 'b',
        name: 'Fuldkrop B',
        exercises: [
          { id: 'udfald', name: 'Udfald', sets: 3, reps: '8–12', rest: 90, note: 'Reps pr. ben.' },
          { id: 'baenkdip', name: 'Dip mod bænk', sets: 3, reps: '6–12', rest: 90 },
          { id: 'etbens-rdl', name: 'Rumænsk hoftebøj, ét ben', sets: 3, reps: '8–12', rest: 60 },
          { id: 'elastik-nedtraek', name: 'Nedtræk med elastik', sets: 3, reps: '10–15', rest: 60 },
        ],
      },
    ],
  },
  {
    id: 'fuldkrop-3',
    name: 'Fuldkrop 3',
    tagline: 'Tre fuldkropspas med håndvægte',
    days: 3,
    levels: ['begynder', 'oevet'],
    minEquipment: 1,
    summary: 'Tre pas om ugen med håndvægte. Samme grundbevægelser hver uge, så vægten kan følges over tid.',
    progression: 'Klarer du alle sæt i toppen af repintervallet, lægger du 2 kg på pr. håndvægt næste gang. Ellers gentager du vægten.',
    sessions: [
      {
        id: 'a',
        name: 'Fuldkrop A',
        exercises: [
          { id: 'gobletsquat', name: 'Gobletsquat', sets: 3, reps: '8–10', rest: 120 },
          { id: 'hv-baenkpres', name: 'Håndvægtsbænkpres', sets: 3, reps: '8–10', rest: 120 },
          { id: 'enarms-roning', name: 'Enarmet roning', sets: 3, reps: '10–12', rest: 90, note: 'Reps pr. arm.' },
          { id: 'hv-rdl', name: 'Rumænsk dødløft med håndvægte', sets: 3, reps: '10–12', rest: 90 },
        ],
      },
      {
        id: 'b',
        name: 'Fuldkrop B',
        exercises: [
          { id: 'bulgarsk-split', name: 'Bulgarsk splitsquat', sets: 3, reps: '8–10', rest: 120, note: 'Reps pr. ben.' },
          { id: 'skulderpres', name: 'Skulderpres', sets: 3, reps: '8–10', rest: 120 },
          { id: 'hv-nedtraek', name: 'Nedtræk eller kropshævning', sets: 3, reps: '6–10', rest: 90 },
          { id: 'hofteloeft-vaegt', name: 'Hofteløft med vægt', sets: 3, reps: '10–15', rest: 60 },
        ],
      },
      {
        id: 'c',
        name: 'Fuldkrop C',
        exercises: [
          { id: 'hv-dodloft', name: 'Dødløft med håndvægte', sets: 3, reps: '6–8', rest: 120 },
          { id: 'skraa-hv-pres', name: 'Skråbænkpres med håndvægte', sets: 3, reps: '10–12', rest: 90 },
          { id: 'hv-roning', name: 'Håndvægtsroning', sets: 3, reps: '10–12', rest: 90 },
          { id: 'gaaende-udfald', name: 'Gående udfald', sets: 3, reps: '10–12', rest: 60, note: 'Reps pr. ben.' },
        ],
      },
    ],
  },
  {
    id: 'okuk-4',
    name: 'Overkrop / underkrop 4',
    tagline: 'Fire pas i træningscenter',
    days: 4,
    levels: ['oevet'],
    minEquipment: 2,
    summary: 'Klassisk overkrop/underkrop-split med stang. Fire pas om ugen, tunge basisløft først.',
    progression: 'Basisløftene kører fast rep-mål. Rammer du alle sæt, lægger du 2,5 kg på overkrop og 5 kg på underkrop næste uge. Misser du to uger i træk, går du 10 % ned og bygger op igen.',
    sessions: [
      {
        id: 'uk-a',
        name: 'Underkrop A',
        exercises: [
          { id: 'squat', name: 'Squat', sets: 4, reps: '5', rest: 180 },
          { id: 'rdl', name: 'Rumænsk dødløft', sets: 3, reps: '8', rest: 120 },
          { id: 'benpres', name: 'Benpres', sets: 3, reps: '10–12', rest: 90 },
          { id: 'laegpres', name: 'Lægpres', sets: 3, reps: '12–15', rest: 60 },
        ],
      },
      {
        id: 'ok-a',
        name: 'Overkrop A',
        exercises: [
          { id: 'baenkpres', name: 'Bænkpres', sets: 4, reps: '5', rest: 180 },
          { id: 'stangroning', name: 'Stangroning', sets: 4, reps: '6–8', rest: 120 },
          { id: 'militaerpres', name: 'Militærpres', sets: 3, reps: '8–10', rest: 90 },
          { id: 'nedtraek', name: 'Lat nedtræk', sets: 3, reps: '10–12', rest: 90 },
        ],
      },
      {
        id: 'uk-b',
        name: 'Underkrop B',
        exercises: [
          { id: 'dodloft', name: 'Dødløft', sets: 4, reps: '4', rest: 180 },
          { id: 'frontboej', name: 'Frontbøj', sets: 3, reps: '6–8', rest: 120 },
          { id: 'hv-udfald', name: 'Udfald med håndvægte', sets: 3, reps: '10', rest: 90, note: 'Reps pr. ben.' },
          { id: 'benboej-maskine', name: 'Benbøj i maskine', sets: 3, reps: '10–12', rest: 60 },
        ],
      },
      {
        id: 'ok-b',
        name: 'Overkrop B',
        exercises: [
          { id: 'skraabaenk', name: 'Skråbænkpres', sets: 4, reps: '6–8', rest: 150 },
          { id: 'kropshaevning', name: 'Kropshævning', sets: 4, reps: '6–8', rest: 120 },
          { id: 'hv-skulderpres', name: 'Håndvægtsskulderpres', sets: 3, reps: '10–12', rest: 90 },
          { id: 'kabelroning', name: 'Kabelroning', sets: 3, reps: '12', rest: 60 },
        ],
      },
    ],
  },
]

export const STARTER_PROGRAM_ID = 'start-2'

let remotePrograms = []

export function setRemotePrograms(programs) {
  remotePrograms = Array.isArray(programs) ? programs.filter(Boolean) : []
}

export function getProgram(programId) {
  return remotePrograms.find(p => p.id === programId)
    || PROGRAMS.find(p => p.id === programId)
    || null
}

export function getSession(programId, sessionId) {
  const program = getProgram(programId)
  if (!program) return null
  return program.sessions.find(s => s.id === sessionId) || null
}

export function findExercise(programId, exerciseId) {
  const program = getProgram(programId)
  if (!program) return null
  for (const session of program.sessions) {
    const found = session.exercises.find(e => e.id === exerciseId)
    if (found) return found
  }
  return null
}
