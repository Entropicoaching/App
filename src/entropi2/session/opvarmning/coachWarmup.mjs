import { mainLiftName } from '../../../exerciseSetView.js'

// Ordre 1704: coachens opvarmning pr. atlet og kategori (warmup_templates, gemt i
// coachens Opvarmning-fane). Ét opslag af atletens egne raekker, kun de brugte felter.
// Samme klient og RLS som den gamle atletvisning; klienten hentes først ved kald.
// Ordre 1881: svaret skelner "ingen skabelon" (failed false) fra "kunne ikke hentes" (failed true),
// så passet kan sige det. Uden athleteId læses intet, og det er ikke en fejl.
export async function readCoachWarmup({ athleteId, client } = {}) {
  if (typeof athleteId !== 'string' || !athleteId.trim()) return { templates: [], failed: false }
  try {
    const database = client ?? (await import('../../../supabase.js')).supabase
    const page = await database.from('warmup_templates').select('exercise_category,steps').eq('athlete_id', athleteId)
    if (page?.error || !Array.isArray(page?.data)) return { templates: [], failed: true }
    return { templates: page.data.filter(row => row && typeof row === 'object'), failed: false }
  } catch { return { templates: [], failed: true } }
}

// Ordre 1704: samme opslag som liste; hver fejl giver ingen skabeloner.
export async function readCoachWarmupTemplates(options) {
  return (await readCoachWarmup(options)).templates
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
