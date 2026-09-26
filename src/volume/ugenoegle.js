// ORDRE 387: flyttet uændret fra ./beregn.js (se kommentaren der om
// ugenøgle = kalenderuge, ikke programuge). Egen fil uden imports, så
// atletens forside ikke henter muskelkortet for at kende en ugenøgle.

export function kalenderdato(loggetDato) {
  const s = loggetDato instanceof Date ? loggetDato.toISOString() : String(loggetDato)
  return s.slice(0, 10)
}

/**
 * ISO 8601-ugenøgle ("YYYY-Www") for en kalenderdato. Mandag=ugens første
 * dag, ugen der indeholder årets første torsdag er uge 1 — standard
 * ISO-regel, ingen egen opfindelse.
 *
 * @param {string|Date} loggetDato
 * @returns {string}
 */
export function ugenoegle(loggetDato) {
  const [aar, maaned, dag] = kalenderdato(loggetDato).split('-').map(Number)
  const d = new Date(Date.UTC(aar, maaned - 1, dag))
  const ugedagMandag0 = (d.getUTCDay() + 6) % 7 // 0=mandag..6=søndag
  d.setUTCDate(d.getUTCDate() - ugedagMandag0 + 3) // torsdag i samme uge
  const aarStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const ugeNr = Math.ceil(((d - aarStart) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(ugeNr).padStart(2, '0')}`
}
