import { FOCUS_LIFTS, FOCUS_NEEDS } from './mobilityFocus.mjs'

export const DEFAULT_COACH_MOBILITY = false
const start = '\n[HARA-MOBILITY-V1]\n'
const end = '\n[/HARA-MOBILITY-V1]'
const validId = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 200
export function coachCatalog(lift, library = {}) {
  const keys = lift === 'Dødløft' ? ['Dødløft — Konventionel', 'Dødløft — Sumo'] : [lift]
  if (!FOCUS_LIFTS.includes(lift)) return []
  return keys.flatMap(key => Array.isArray(library?.[key]) ? library[key] : [])
    .flatMap(slot => Array.isArray(slot?.options) ? slot.options : [])
    .filter((ex, i, all) => validId(ex?.id) && typeof ex.name === 'string' && all.findIndex(other => other?.id === ex.id) === i)
}
export function validCoachChoices(choices, library) {
  return choices && typeof choices === 'object' && !Array.isArray(choices) &&
    Object.keys(choices).length <= 3 && Object.entries(choices).every(([lift, choice]) =>
      FOCUS_LIFTS.includes(lift) && choice && FOCUS_NEEDS[lift].includes(choice.need) &&
      Array.isArray(choice.ids) && choice.ids.length <= 3 && new Set(choice.ids).size === choice.ids.length &&
      choice.ids.every(id => typeof id === 'string' && coachCatalog(lift, library).some(ex => ex.id === id)))
}
function splitNotes(notes) {
  if (notes != null && typeof notes !== 'string') throw Error('Ugyldigt notefelt.')
  const text = notes ?? ''
  const a = text.indexOf(start), b = text.indexOf(end)
  if (a === -1 && b === -1) return { text, data: null }
  if (a < 0 || b < a || text.indexOf(start, a + start.length) !== -1 || text.indexOf(end, b + end.length) !== -1) throw Error('Ugyldigt mobilitetsvalg i notefeltet.')
  return { text: text.slice(0, a) + text.slice(b + end.length), data: JSON.parse(text.slice(a + start.length, b)) }
}
export function readCoachChoices(enabled, athleteId, notes, library) {
  if (enabled !== true) return { choices: {}, error: null }
  try {
    if (!validId(athleteId)) throw Error('Atlet mangler.')
    const { data } = splitNotes(notes)
    if (data === null) return { choices: {}, error: null }
    if (data.version !== 1 || data.athleteId !== athleteId || !validCoachChoices(data.choices, library)) throw Error('Ugyldigt mobilitetsvalg.')
    return { choices: data.choices, error: null }
  } catch { return { choices: {}, error: 'Coachens mobilitetsvalg kunne ikke læses.' } }
}
export function coachNotes(athleteId, notes, choices, library) {
  if (!validId(athleteId) || !validCoachChoices(choices, library)) throw Error('Vælg gyldigt fokus og højst tre biblioteksøvelser pr. løft.')
  const existing = readCoachChoices(true, athleteId, notes, library)
  if (existing.error) throw Error(existing.error)
  const { text } = splitNotes(notes)
  return Object.keys(choices).length ? text + start + JSON.stringify({ version: 1, athleteId, choices }) + end : text
}
// Existing athletes.notes text transport. Compare the old field to avoid overwriting a concurrent edit.
// No local storage, no new table, column or remote dependency.
export async function saveCoachChoices({ enabled, client, coachId, athlete, choices, library, noteText }) {
  if (enabled !== true) return { error: 'Mobilitetsvalg er slået fra.' }
  try {
    if (!validId(coachId) || !validId(athlete?.id) || athlete.coach_id !== coachId) throw Error('Atleten tilhører ikke denne coach.')
    if (readCoachChoices(true, athlete.id, athlete.notes, library).error) throw Error('notes')
    if (noteText !== undefined && (typeof noteText !== 'string' || noteText.includes('[HARA-MOBILITY-V1]') || noteText.includes('[/HARA-MOBILITY-V1]'))) throw Error('notes')
    const notes = coachNotes(athlete.id, noteText === undefined ? athlete.notes : noteText, choices, library)
    let query = client.from('athletes').update({ notes }).eq('id', athlete.id).eq('coach_id', coachId)
    query = athlete.notes == null ? query.is('notes', null) : query.eq('notes', athlete.notes)
    const { data, error } = await query.select('*').single()
    if (error || !data || data.id !== athlete.id || data.coach_id !== coachId || data.notes !== notes) throw Error('save')
    return { athlete: data, error: null }
  } catch { return { error: 'Valget blev ikke gemt. Genindlæs profilen og prøv igen.' } }
}

export function visibleCoachNotes(notes) {
  try { return splitNotes(notes).text } catch { return '' }
}
export async function saveCoachNoteText(args) {
  const result = readCoachChoices(args.enabled, args.athlete?.id, args.athlete?.notes, args.library)
  if (result.error) return { error: result.error }
  return saveCoachChoices({ ...args, choices: result.choices })
}
