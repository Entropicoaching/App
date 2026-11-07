// Navigation of the existing catalogue only. Return ORIGINAL indices for logFood.
const searchText = text => String(text ?? '').normalize('NFC').toLocaleLowerCase('da-DK').trim()

// Include origin, portion definition and nutrients: changed/ambiguous entries
// require an explicit choice rather than inheriting an unfinished portion.
export const foodIdentity = food => JSON.stringify([food.id ?? null, food.name, food.isCustom === true,
  food.unit_label ?? null, food.unit_grams ?? null,
  food.kcal100, food.protein100, food.carb100, food.fat100])

export function foodChoices(foods, query, selected) {
  const needle = searchText(query), matches = [], identities = []
  foods.forEach((food, index) => {
    if (searchText(food.name).includes(needle)) matches.push(index)
    if (foodIdentity(food) === selected) identities.push(index)
  })
  const selectedIndex = identities.length === 1 ? identities[0] : -1
  const pinned = selectedIndex >= 0 && !matches.includes(selectedIndex)
  return { matches, selectedIndex, pinned, indices: pinned ? [selectedIndex, ...matches] : matches }
}
