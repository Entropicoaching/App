// Entropi programmotor v2 — reviewbare strukturer, ikke tildelinger.
//
// En template er bundet til den valgte træningsramme. `home` og `gym` er
// sidestillede produktvalg; et home-input må derfor aldrig glide over i et
// gym-program via en udstyrstier. Konkrete øvelser og recepter opløses senere
// fra de tilsvarende reviewbiblioteker.

export const TEMPLATE_SCHEMA_VERSION = 3

const GYM_TEMPLATES = [
  {
    id: 'general-strength-2',
    label: '2-dages styrkebase',
    version: 2,
    status: 'review',
    focus: ['general-strength'],
    days: 2,
    equipment: 'gym',
    minEquipment: 'gym',
    levels: ['begynder', 'oevet'],
    week: [
      { id: 'a', label: 'Pas A', roles: ['squat-pattern', 'bench-pattern', 'pull', 'hinge-assistance'] },
      { id: 'b', label: 'Pas B', roles: ['hinge-pattern', 'upper-press-variation', 'pull', 'lower-assistance'] },
    ],
    adaptationPolicy: 'same-exercise-next-exposure-v1',
  },
  {
    id: 'powerlifting-foundation-2',
    label: '2-dages styrkeløftfundament',
    version: 2,
    status: 'review',
    focus: ['powerlifting-foundation'],
    days: 2,
    equipment: 'gym',
    minEquipment: 'gym',
    levels: ['begynder', 'oevet'],
    week: [
      { id: 'a', label: 'Pas A', roles: ['squat-pattern', 'bench-pattern', 'hinge-assistance', 'pull'] },
      { id: 'b', label: 'Pas B', roles: ['hinge-pattern', 'bench-pattern', 'squat-assistance', 'pull'] },
    ],
    adaptationPolicy: 'same-exercise-next-exposure-v1',
  },
  {
    id: 'general-strength-3',
    label: '3-dages styrkebase',
    version: 2,
    status: 'review',
    focus: ['general-strength'],
    days: 3,
    equipment: 'gym',
    minEquipment: 'gym',
    levels: ['begynder', 'oevet'],
    week: [
      { id: 'a', label: 'Pas A', roles: ['squat-pattern', 'bench-pattern', 'pull'] },
      { id: 'b', label: 'Pas B', roles: ['hinge-pattern', 'upper-press-variation', 'lower-assistance', 'pull'] },
      { id: 'c', label: 'Pas C', roles: ['squat-variation', 'bench-variation', 'hinge-assistance', 'pull'] },
    ],
    adaptationPolicy: 'same-exercise-next-exposure-v1',
  },
  {
    id: 'powerlifting-foundation-3',
    label: '3-dages styrkeløftfundament',
    version: 2,
    status: 'review',
    focus: ['powerlifting-foundation'],
    days: 3,
    equipment: 'gym',
    minEquipment: 'gym',
    levels: ['begynder', 'oevet'],
    week: [
      { id: 'a', label: 'Pas A', roles: ['squat-pattern', 'bench-pattern', 'pull'] },
      { id: 'b', label: 'Pas B', roles: ['hinge-pattern', 'bench-pattern', 'lower-assistance', 'pull'] },
      { id: 'c', label: 'Pas C', roles: ['squat-assistance', 'bench-variation', 'hinge-assistance', 'pull'] },
    ],
    adaptationPolicy: 'same-exercise-next-exposure-v1',
  },
  {
    id: 'general-strength-4',
    label: '4-dages styrkebase',
    version: 2,
    status: 'review',
    focus: ['general-strength'],
    days: 4,
    equipment: 'gym',
    minEquipment: 'gym',
    levels: ['begynder', 'oevet'],
    week: [
      { id: 'lower-a', label: 'Underkrop A', roles: ['squat-pattern', 'hinge-assistance', 'lower-assistance', 'core'] },
      { id: 'upper-a', label: 'Overkrop A', roles: ['bench-pattern', 'pull', 'upper-press-assistance', 'vertical-pull'] },
      { id: 'lower-b', label: 'Underkrop B', roles: ['hinge-pattern', 'squat-assistance', 'lower-assistance', 'core'] },
      { id: 'upper-b', label: 'Overkrop B', roles: ['bench-variation', 'pull', 'upper-assistance', 'vertical-pull'] },
    ],
    adaptationPolicy: 'same-exercise-next-exposure-v1',
  },
  {
    id: 'powerlifting-foundation-4',
    label: '4-dages styrkeløftfundament',
    version: 2,
    status: 'review',
    focus: ['powerlifting-foundation'],
    days: 4,
    equipment: 'gym',
    minEquipment: 'gym',
    levels: ['begynder', 'oevet'],
    week: [
      { id: 'lower-a', label: 'Underkrop A', roles: ['squat-pattern', 'hinge-assistance', 'lower-assistance', 'core'] },
      { id: 'upper-a', label: 'Overkrop A', roles: ['bench-pattern', 'pull', 'upper-press-assistance', 'vertical-pull'] },
      { id: 'lower-b', label: 'Underkrop B', roles: ['hinge-pattern', 'squat-assistance', 'lower-assistance', 'core'] },
      { id: 'upper-b', label: 'Overkrop B', roles: ['bench-pattern', 'bench-variation', 'pull', 'vertical-pull'] },
    ],
    adaptationPolicy: 'same-exercise-next-exposure-v1',
  },
]

// Home-programmerne bruger samme tydelige ugearkitektur, men opløses mod et
// separat katalog af hjemmetræningsøvelser. De har egne ids, så et review,
// fingerprint eller en senere programversion aldrig kan forveksle home og gym.
const HOME_TEMPLATES = GYM_TEMPLATES.map(template => ({
  ...template,
  id: `${template.id}-home`,
  label: `${template.label} · hjemmetræning`,
  equipment: 'home',
  minEquipment: 'home',
  levels: ['begynder', 'oevet'],
  week: template.week.map(session => ({ ...session, roles: [...session.roles] })),
}))

export const PROGRAM_TEMPLATES = [...GYM_TEMPLATES, ...HOME_TEMPLATES]

export function findTemplate(templateId) {
  return PROGRAM_TEMPLATES.find(template => template.id === templateId) || null
}
