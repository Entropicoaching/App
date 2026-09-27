// ORDRE 456 (A5 i docs/kritik-446): personal_records har dubletter fra før 456
// (samme øvelse, vægt og reps skrevet 2-3 gange, når næste sæt blev logget,
// før registreringen var færdig). Rækkerne slettes ikke; visningen viser hver
// (øvelse, vægt, reps) én gang, med den første registrering. Ren funktion.
const tid = (r) => String(r?.logged_at || r?.created_at || '')

export function unikkeRekorder(rows) {
  const foerste = new Map()
  for (const r of rows || []) {
    const k = `${String(r?.exercise_name || '').trim().toLowerCase()}|${Number(r?.weight)}|${Number(r?.reps)}`
    const cur = foerste.get(k)
    if (!cur || (tid(r) && tid(r) < tid(cur))) foerste.set(k, r)
  }
  const behold = new Set(foerste.values())
  return (rows || []).filter(r => behold.has(r))
}
