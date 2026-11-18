import { mainLiftName } from '../../../exerciseSetView.js'

// Ordre 1704: coachens opvarmning pr. atlet og kategori (warmup_templates, gemt i
// coachens Opvarmning-fane). Ét opslag af atletens egne raekker, kun de brugte felter.
// Samme klient og RLS som den gamle atletvisning; klienten hentes først ved kald.
// Hver fejl giver ingen skabeloner, så passet viser det beregnede forslag som før.
export async function readCoachWarmupTemplates({ athleteId, client } = {}) {
  if (typeof athleteId !== 'string' || !athleteId.trim()) return []
  try {
    const database = client ?? (await import('../../../supabase.js')).supabase
    const page = await database.from('warmup_templates').select('exercise_category,steps').eq('athlete_id', athleteId)
    if (page?.error || !Array.isArray(page?.data)) return []
    return page.data.filter(row => row && typeof row === 'object')
  } catch { return [] }
}

// Samme match som den gamle opvarmning: exercise_category === løftet, sumo hører under Dødløft.
// Kun hovedløftene genkendes; varianter som pause squat får det beregnede forslag.
export function coachWarmupSteps(templates, exerciseName) {
  const lift = mainLiftName(exerciseName)
  const category = lift === 'Sumo dødløft' ? 'Dødløft' : lift
  if (!category || !Array.isArray(templates)) return []
  const steps = templates.find(t => t?.exercise_category === category)?.steps
  return Array.isArray(steps) ? steps.filter(step => typeof step === 'string' && step.trim()).map(step => step.trim()) : []
}
