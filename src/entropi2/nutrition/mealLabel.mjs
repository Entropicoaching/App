// Display only: keep the original meal and nutrient payloads unchanged.
export const mealLabel = value => typeof value === 'string' && value.trim()
  ? value.trim() : 'Måltid uden navn'
