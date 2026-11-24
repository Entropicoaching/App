// Test-only. Ordre 2093: AthleteView giver Entropi 2-passet sin eksisterende suggestNextWeight
// (med smertestoppet), så passet kan vise appens forslag. Prøver, der låser AthleteView mod en
// fast hash, fjerner præcis denne ene linje.
const LINE = '            suggestNextWeight={suggestNextWeight}'

export function withoutO2093(source) {
  const hunk = LINE + (source.includes(LINE + '\r\n') ? '\r\n' : '\n')
  if (source.split(hunk).length !== 2) throw Error('Exact 2093 AthleteView line not found once')
  return source.replace(hunk, '')
}
