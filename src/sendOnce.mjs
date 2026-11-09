// U2: én afsendelse ad gangen pr. nøgle. Et dobbelttryk eller to Enter i samme
// øjeblik giver ikke to rækker, heller ikke når React-state endnu ikke er
// opdateret mellem trykkene. Nøglen frigives, når skrivningen er afgjort.
const active = new Set()

export async function sendOnce(key, write) {
  if (active.has(key)) return false
  active.add(key)
  try { return await write() } finally { active.delete(key) }
}
