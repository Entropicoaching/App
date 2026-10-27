export const COACH_TEMPLATE_MESSAGES_ENABLED = false
const keyFor = coachId => {
  if (typeof coachId !== 'string' || !coachId.trim()) throw Error('Coach mangler.')
  return `entropi_coach_message_templates_v1:${encodeURIComponent(coachId)}`
}
const valid = t => t && typeof t.name === 'string' && t.name.trim() && t.name.length <= 100 &&
  typeof t.text === 'string' && t.text.trim() && t.text.length <= 10000
export function readCoachTemplates(storage, coachId) {
  const raw = storage.getItem(keyFor(coachId))
  if (raw === null) return []
  const rows = JSON.parse(raw)
  if (!Array.isArray(rows) || rows.length > 50 || !rows.every(valid)) throw Error('Ugyldige skabeloner.')
  return rows.map(t => ({ name: t.name, text: t.text }))
}
export function saveCoachTemplates(storage, coachId, rows) {
  if (!Array.isArray(rows) || rows.length > 50 || !rows.every(valid)) throw Error('Kontroller navn og tekst. Højst 50 skabeloner.')
  storage.setItem(keyFor(coachId), JSON.stringify(rows.map(t => ({ name: t.name.trim(), text: t.text }))))
}
export function fillCoachTemplate(text, athleteName) {
  return text.replace(/\{atlet\}/g, () => String(athleteName))
}
// Only the explicit Send handler calls this function. No reads or writes on creation.
export function createCoachTemplateSender({ enabled = false, database, getScope, onSent = () => {} }) {
  let pending = false
  return async ({ coachId, athleteId, text }) => {
    if (enabled !== true) throw Error('Funktionen er slået fra.')
    const scope = getScope()
    if (scope?.enabled !== true || !coachId || scope?.coachId !== coachId || !scope.athletes?.some(a => a.id === athleteId)) throw Error('Modtageren er ikke længere i din atletliste.')
    if (typeof text !== 'string' || !text.trim() || text.length > 10000) throw Error('Skriv en besked på højst 10000 tegn.')
    if (pending) return false
    pending = true
    try {
      const { error } = await database.from('messages').insert({ athlete_id: athleteId, sender_role: 'coach', content: text.trim(), category: 'besked' })
      if (error) throw error
      // A refresh failure must not invite a duplicate send of a persisted message.
      try { await onSent(athleteId) } catch { /* The sent message is already saved. */ }
      return true
    } finally { pending = false }
  }
}
