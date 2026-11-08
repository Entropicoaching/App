// Only search the caller's already loaded choices. Display text and IDs remain
// untouched; folding applies solely to matching names and preparation words.
const fold = text => text.toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '')
  .replace(/æ/g, 'ae').replace(/ø/g, 'o')

export function searchFoods(foods, query, selectedId) {
  const tokens = fold(query).trim().split(/\s+/u).filter(Boolean)
  if (!tokens.length) return { foods, matches: foods.length, searching: false }
  let matches = 0
  const visible = foods.filter(food => {
    const text = fold(`${food.name} ${food.nutrition.preparation}`)
    const match = tokens.every(token => text.includes(token))
    if (match) matches++
    return match || food.id === selectedId
  })
  return { foods: visible, matches, searching: true }
}
