// No schema assumptions or invented defaults. Explicit values reach the strict parsers.
export function sessionPrescription(ex = {}) {
  const note = typeof ex.note === 'string' ? ex.note : ''
  const marked = word => note.match(new RegExp(`(?:^|[\\s;,])(?:${word})\\b\\s*:?\\s*([^;\\n]+)`, 'i'))?.[1]?.trim()
  // Read only the leading token: the remainder may contain the coach's prose.
  const tempoText = marked('tempo')
  const tempo = tempoText?.match(/^([0-9x]\s*-\s*[0-9x]\s*-\s*[0-9x]\s*-\s*[0-9x])(?=\s|$)/i)?.[1] ?? tempoText?.split(/\s/)[0]
  const rest = marked('pause|hvile|rest')
  const duration = rest?.match(/^(\d+:\d{2}|\d+(?:[.,]\d+)?\s*(?:min|sek|sec|s)\b|\d+)(?=\s|$)/i)?.[0]
  return { tempo: ex.tempo ?? tempo, restSeconds: ex.restSeconds ?? (rest ? duration ?? rest : undefined) }
}
