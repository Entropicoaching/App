// Test-only. U2 (ordre 50): AthleteView giver samtalen sine to eksisterende
// setters, så fanens prik følger samtalen. Prøver, der låser AthleteView mod en
// fast hash, fjerner præcis denne ene linje, før de sammenligner.
const LINE = '            setUnreadMsgCount, setSharedVideoAnalyses,'

export function withoutU2(source) {
  const hunk = LINE + (source.includes(LINE + '\r\n') ? '\r\n' : '\n')
  if (source.split(hunk).length !== 2) throw Error('Exact U2 AthleteView line not found once')
  return source.replace(hunk, '')
}
