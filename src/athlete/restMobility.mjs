import { readHomework, homeworkLibrary } from '../mobilityHomework.mjs'
import { readCoachChoices, coachCatalog } from './coachMobility.mjs'
import { focusPlan, FOCUS_LIFTS } from './mobilityFocus.mjs'
import { WARMUP_BASE } from './mobilityCatalog.mjs'

export const DEFAULT_REST_MOBILITY = false

// Read only. Never infer a focus from the default selection in the mobility UI.
// MOB6 remains local to this athlete and device; its flag still controls reads.
export function restMobilityText({ enabled = DEFAULT_REST_MOBILITY, athleteId, notes,
  homeworkEnabled = false, coachEnabled = false, focus, storage } = {}) {
  if (enabled !== true || typeof athleteId !== 'string' || !athleteId.trim()) return null
  let exercise, source
  if (homeworkEnabled === true) {
    const result = readHomework(athleteId, storage)
    const problem = homeworkLibrary().find(item => item.id === result.value?.problemId)
    exercise = problem?.exercises.find(item => item.id === result.value?.exerciseIds[0])
    if (exercise) source = 'Fra din coachs hjemmeøvelser på denne enhed'
  }
  if (!exercise && focus?.athleteId === athleteId) {
    exercise = focusPlan(focus.lift, focus.need, WARMUP_BASE).exercises[0]
    if (exercise) source = `Dit fokus: ${focus.need.toLowerCase()}`
  }
  if (!exercise && coachEnabled === true) {
    const { choices } = readCoachChoices(true, athleteId, notes, WARMUP_BASE)
    const lift = FOCUS_LIFTS.find(name => choices[name])
    if (lift) {
      const choice = choices[lift]
      exercise = choice.ids.length ? coachCatalog(lift, WARMUP_BASE).find(item => item.id === choice.ids[0])
        : focusPlan(lift, choice.need, WARMUP_BASE).exercises[0]
      if (exercise) source = `Din coachs fokus: ${choice.need.toLowerCase()}`
    }
  }
  return exercise ? `Hvis du har lyst, kan du bruge fem minutter på let mobilitet med ${exercise.name.toLowerCase()}. ${source}. Tag det roligt, og stop hvis det gør ondt. Hvile er også helt fint.` : null
}
