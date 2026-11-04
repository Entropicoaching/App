// Only successful food logs update this athlete's local gram defaults.
export function createPortionMemory(storage, athleteId) {
  const key = 'entropi2:nutrition:portions:v1:' + encodeURIComponent(athleteId)
  let amounts = new Map(), error = ''
  const valid = n => typeof n === 'number' && Number.isFinite(n) && n > 0 && n <= 100000
  try {
    const raw = storage?.getItem(key)
    if (raw != null) {
      const entries = JSON.parse(raw)
      if (!Array.isArray(entries) || entries.length > 200 || entries.some(entry =>
        !Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== 'string' || entry[0].length > 1000 || !valid(entry[1]))) throw Error()
      amounts = new Map(entries)
    }
  } catch { error = 'Sidste mængder kunne ikke læses. Standard er 100 g.' }
  // Include origin and unit definition so a changed/custom food cannot inherit another food's amount.
  const foodKey = food => JSON.stringify([food.id ?? null, food.name, food.isCustom === true, food.unit_label ?? null, food.unit_grams ?? null])
  return {
    get(food) { return amounts.get(foodKey(food)) ?? 100 },
    error() { return error },
    remember(food, grams) {
      if (!valid(grams)) return
      const next = new Map(amounts), identity = foodKey(food)
      if (identity.length > 1000) return
      next.delete(identity); next.set(identity, grams)
      if (next.size > 200) next.delete(next.keys().next().value)
      amounts = next
      try {
        if (!storage) throw Error()
        storage.setItem(key, JSON.stringify([...next])); error = ''
      } catch { error = 'Måltidet er gemt, men mængden kunne ikke huskes på denne enhed.' }
    },
  }
}
