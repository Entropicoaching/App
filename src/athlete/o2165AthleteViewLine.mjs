// Test-only. Ordre 2165: AthleteView giver VideoCoach-broen vejen til Beskeder (kvitteringens knap
// "Se i Beskeder"). Prøver, der låser AthleteView mod en fast hash, fjerner præcis denne ene linje.
const LINE = "    onOpenMessages: () => setTab('beskeder'),"

export function withoutO2165(source) {
  const hunk = LINE + (source.includes(LINE + '\r\n') ? '\r\n' : '\n')
  if (source.split(hunk).length !== 2) throw Error('Exact 2165 AthleteView line not found once')
  return source.replace(hunk, '')
}
