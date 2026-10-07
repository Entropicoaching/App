// ORDRE 1580 (D3): hvilke atleter er set igennem og kraever ikke noget.
// En tom "Kraever dit blik" siger ikke, om atleten er gennemgaaet eller bare
// ikke tjekket. Her er en atlet kun rolig, naar ALLE tre holder:
//   1. ingen aaben ting i koeen (signal, besked eller video),
//   2. mindst et pas logget i den aktuelle uge,
//   3. ingen vurdering under 3 (1-5) i ugen.
// 4. ORDRE 1588: ingen sprungne sæt og ingen sæt med færre reps end planlagt
//    (inkl. fejlede sæt med 0 reps). Det er de RPE-uafhængige tegn.
// RPE indgaar ikke. Ikke-startede og tavse atleter er aldrig rolige.
//   atleter:   [{ id, name }]
//   aabneIds:  atlet-id'er med mindst en aaben ting i koeen
//   ugeStatus: Map atlet-id -> { pasLogget, saetUnderPlan, sprungneSaet, stemme: { laveste } | null }
export function roligeAtleter({ atleter = [], aabneIds = [], ugeStatus = new Map() }) {
  const aabne = new Set(aabneIds)
  return atleter.filter(atlet => {
    if (aabne.has(atlet.id)) return false
    const status = ugeStatus.get(atlet.id)
    if (!status || !(status.pasLogget > 0)) return false
    if (status.saetUnderPlan > 0 || status.sprungneSaet > 0) return false
    const laveste = status.stemme?.laveste
    return laveste == null || laveste >= 3
  })
}

const fornavn = navn => String(navn || '').trim().split(/\s+/)[0] || ''

// Linjen under koeen. Maks tre navne, resten som tal.
export function roligLinje(rolige, antalAtleter) {
  if (!rolige.length) return null
  const navne = rolige.map(a => fornavn(a.name)).filter(Boolean)
  const vist = navne.slice(0, 3).join(', ')
  const rest = navne.length - 3
  return `Set igennem, intet kræver dig: ${vist}${rest > 0 ? ` og ${rest} til` : ''} (${rolige.length} af ${antalAtleter})`
}
