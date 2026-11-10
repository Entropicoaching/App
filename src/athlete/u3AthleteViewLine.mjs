// Test-only. U3 (ordre 64): AthleteView giver Fremgang sin eksisterende
// inboxDatabase-klient, så U3's ugekort og blok for blok kan læse L4. Prøver,
// der låser AthleteView mod en fast hash, fjerner præcis denne ene linje.
const LINE = '            u3Client={inboxDatabase}'

export function withoutU3(source) {
  const hunk = LINE + (source.includes(LINE + '\r\n') ? '\r\n' : '\n')
  if (source.split(hunk).length !== 2) throw Error('Exact U3 AthleteView line not found once')
  return source.replace(hunk, '')
}
