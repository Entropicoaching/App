// Only athletes.notes is used. No local storage, messages or athlete-facing path.
export const COACH_NOTES_ENABLED = false
export function coachNotesFlag(search = '') {
  return new URLSearchParams(search).get('coachNotes') === '1'
}

const header = /^\[Coach-note (\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z)\]$/
const validDate = value => {
  const time = Date.parse(value)
  return Number.isFinite(time) && new Date(time).toISOString() === value
}

// Old free text has no reliable timestamp. Never invent one from profile dates.
// New blocks indent every body line, so a heading inside a note stays plain text.
export function coachNoteRows(raw = '', query = '') {
  const lines = String(raw ?? '').replace(/\r\n/g, '\n').split('\n')
  const rows = [], legacy = []
  for (let i = 0; i < lines.length;) {
    const match = lines[i].match(header)
    if (match && validDate(match[1]) && lines[i + 1]?.startsWith('  ')) {
      const body = [], index = i++
      while (i < lines.length && lines[i].startsWith('  ')) body.push(lines[i++].slice(2))
      rows.push({ id: `note-${index}`, date: match[1], text: body.join('\n') })
    } else legacy.push(lines[i++])
  }
  if (legacy.join('\n').trim()) rows.push({ id: 'legacy', date: null, text: legacy.join('\n').trim() })
  const term = String(query).trim().toLocaleLowerCase('da-DK')
  return rows.sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .filter(row => `${row.text}\n${row.date || 'Dato ukendt'}`.toLocaleLowerCase('da-DK').includes(term))
}

export function appendCoachNote(raw, text, now = new Date()) {
  const body = String(text ?? '').trim()
  if (!body) throw new Error('Skriv en note først.')
  if (body.length > 10000) throw new Error('Noten må højst være 10.000 tegn.')
  const stamp = now.toISOString()
  return `${raw || ''}${raw ? '\n\n' : ''}[Coach-note ${stamp}]\n${body.replace(/\r\n/g, '\n').split('\n').map(line => `  ${line}`).join('\n')}`
}

// Same athletes update/select transport as saveEdit. Compare the loaded notes to
// prevent silently replacing a note added by another tab or coach in the meantime.
export function createCoachNoteSaver({ enabled = false, athlete, coachId, client, onSaved, now = () => new Date() }) {
  let pending = false
  return async text => {
    if (enabled !== true || !athlete?.id || !coachId || pending) return false
    const notes = appendCoachNote(athlete.notes, text, now())
    pending = true
    try {
      let request = client.from('athletes').update({ notes }).eq('id', athlete.id).eq('coach_id', coachId)
      request = athlete.notes == null ? request.is('notes', null) : request.eq('notes', athlete.notes)
      const { data, error } = await request.select().single()
      if (error || !data || data.id !== athlete.id) throw new Error('Noten blev ikke gemt. Genindlæs profilen og prøv igen.')
      onSaved(data)
      return true
    } finally { pending = false }
  }
}
