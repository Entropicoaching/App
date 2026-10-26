import { MESSAGE_VIDEO_RANK } from '../coachBriefingRules.js'

// Samme lokale kontaktmønster som nextSetPreview.js, med coach som scope.
function key(coachId, part) {
  return coachId ? `entropi_coach_svar_v1:${encodeURIComponent(coachId)}:${part}` : null
}

function read(coachId, part, fallback, storage) {
  try {
    return JSON.parse((storage ?? globalThis.localStorage)?.getItem(key(coachId, part)) ?? 'null') ?? fallback
  } catch { return fallback }
}

function write(coachId, part, value, storage) {
  try {
    const target = storage ?? globalThis.localStorage
    if (!coachId || !target) return false
    target.setItem(key(coachId, part), JSON.stringify(value))
    return true
  } catch { return false }
}

export function loadCoachSvar(coachId, storage) {
  if (!coachId) return { enabled: false, templates: [], seenNotes: [] }
  const templates = read(coachId, 'templates', [], storage)
  const seenNotes = read(coachId, 'seen', [], storage)
  return {
    enabled: read(coachId, 'enabled', false, storage) === true,
    templates: Array.isArray(templates) ? [...new Set(templates.filter(validTemplate))] : [],
    seenNotes: Array.isArray(seenNotes) ? seenNotes.filter(value => typeof value === 'string') : [],
  }
}

export const saveCoachSvarEnabled = (coachId, enabled, storage) => write(coachId, 'enabled', enabled === true, storage)
export const saveCoachSvarTemplates = (coachId, templates, storage) => write(coachId, 'templates', templates, storage)
export const saveCoachSvarSeenNotes = (coachId, notes, storage) => write(coachId, 'seen', notes, storage)

export function validTemplate(text) {
  return typeof text === 'string' && text.trim().length > 0 && text.length <= 500
}

export function insertCoachTemplate(draft, template) {
  return draft ? `${draft}\n${template}` : template
}

export function coachNoteKey(athleteId, type, id, text) {
  return athleteId && id && typeof text === 'string' && text.trim()
    ? JSON.stringify([athleteId, type, id, text]) : null
}

// Brug allerede indlæste pas- og sætnoter. En rettet note bliver en ny opgave.
export function coachNoteItems(athletes, calendarWeeks, completion, seenNotes) {
  const seen = new Set(seenNotes)
  const items = new Map()
  const add = (athlete, type, id, text, weekNumber) => {
    const noteKey = coachNoteKey(athlete.id, type, id, text)
    if (!noteKey || seen.has(noteKey)) return
    items.set(noteKey, {
      key: `note-${noteKey}`, noteKey, kind: 'note', athlete,
      rank: MESSAGE_VIDEO_RANK, color: '#c8923a', label: 'Note', title: athlete.name,
      detail: `Uge ${weekNumber}: ${text}`,
    })
  }
  for (const athlete of athletes) {
    for (const week of calendarWeeks[athlete.id] || []) {
      for (const voice of week.session_voices || []) add(athlete, 'session', voice.id, voice.comment, week.week_number)
    }
    for (const [weekNumber, week] of Object.entries(completion[athlete.id] || {})) {
      for (const note of week.notes || []) add(athlete, 'set', note.id, note.note, weekNumber)
    }
  }
  return [...items.values()]
}
