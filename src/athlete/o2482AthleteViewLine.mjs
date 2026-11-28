// Test-only. Ordre 2482m: atletens Mobilitet viser den guidede visning (mobilitetGuide) i stedet for Entropi 2-tekstsiden.
// Prøver, der låser AthleteView mod en fast hash, ruller præcis disse to tilføjede linjer og tre ændrede betingelser tilbage.
const EDITS = [
  ["  const mobilitetGuide = !e2Atlet || (role === 'athlete' && !e2ReadOnly)\n", ''],
  ["{!mobilitetGuide && tab === 'mobilisering' && (", "{e2Atlet && tab === 'mobilisering' && ("],
  ["{mobilitetGuide && compactHomework && tab === 'mobilisering'", "{!e2Atlet && compactHomework && tab === 'mobilisering'"],
  ["{mobilitetGuide && tab === 'mobilisering' && !(compactHomework", "{!e2Atlet && tab === 'mobilisering' && !(compactHomework"],
]
const COMMENT = /  \/\/ Ordre 2482m \(Marc 28\. nov\.\)[^\r\n]*\r?\n/

export function withoutO2482(source) {
  const crlf = source.includes('\r\n')
  let out = source
  for (const [now, before] of EDITS) {
    const from = crlf ? now.replace(/\n/g, '\r\n') : now
    if (out.split(from).length !== 2) throw Error('Exact 2482 AthleteView hunk not found once')
    out = out.replace(from, () => before)
  }
  if (!COMMENT.test(out)) throw Error('Exact 2482 AthleteView comment not found')
  return out.replace(COMMENT, '')
}
