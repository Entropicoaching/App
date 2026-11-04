// Editorial starting points, not measured restaurant data or a food database.
// Values describe one medium meal; sauces/recipes can vary substantially.
const dishes = [
  { id: 'pizza', label: 'Pizza', portion: 'En hel almindelig pizza', kcal: 1000, protein: 40 },
  { id: 'burger', label: 'Burger med pommes frites', portion: 'En burger og en portion pommes frites', kcal: 1100, protein: 40 },
  { id: 'kebab', label: 'Dürüm med kød', portion: 'En dürüm med kød, grønt og dressing', kcal: 900, protein: 40 },
  { id: 'sushi', label: 'Sushi', portion: 'Ca. 12 blandede stykker uden ekstra tilbehør', kcal: 650, protein: 30 },
  { id: 'pasta', label: 'Pasta med sauce', portion: 'En restauranttallerken med pasta og sauce', kcal: 850, protein: 25 },
  { id: 'curry', label: 'Karryret med ris', portion: 'En tallerken med ris, kød eller tofu og sauce', kcal: 900, protein: 35 },
  { id: 'salad', label: 'Måltidssalat', portion: 'En stor salat med kylling eller bælgfrugter, dressing og brød', kcal: 650, protein: 30 },
  { id: 'sandwich', label: 'Sandwich', portion: 'En fyldt café-sandwich uden ekstra tilbehør', kcal: 700, protein: 30 },
]
export const EATING_OUT_DISHES = Object.freeze(dishes.map(dish => Object.freeze(dish)))
export const EATING_OUT_PORTIONS = Object.freeze([
  Object.freeze({ id: 'small', label: 'Lille', factor: 0.7 }),
  Object.freeze({ id: 'medium', label: 'Mellem', factor: 1 }),
  Object.freeze({ id: 'large', label: 'Stor', factor: 1.4 }),
])
export const ESTIMATE_NOTICE = 'Groft skøn, ikke en måling. Opskrift, olie, dressing og portionsstørrelse kan ændre tallene meget. Det faktiske måltid kan ligge uden for intervallet.'
const round = (value, step) => Math.round(value / step) * step

// Strict IDs: an unknown meal or portion must never become a plausible estimate.
// Fresh output; no date, identity, storage, diary intent or side effects.
export function estimateEatingOut(dishId, portionId) {
  const dish = EATING_OUT_DISHES.find(item => item.id === dishId)
  const portion = EATING_OUT_PORTIONS.find(item => item.id === portionId)
  if (!dish || !portion) return null
  const kcal = dish.kcal * portion.factor
  const protein = dish.protein * portion.factor
  return {
    kind: 'eating-out-estimate', isEstimate: true,
    dishId: dish.id, dish: dish.label, portionId: portion.id, portion: portion.label,
    mediumPortion: dish.portion,
    kcal: round(kcal, 50), protein: round(protein, 5),
    // Deliberately broad illustrative bands, not statistical confidence intervals.
    kcalRange: [round(kcal * 0.7, 50), round(kcal * 1.3, 50)],
    proteinRange: [round(protein * 0.7, 5), round(protein * 1.3, 5)],
    notice: ESTIMATE_NOTICE,
  }
}
