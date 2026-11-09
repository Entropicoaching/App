// Explicit local entry only. Do not mount the data-stage legacy200+Frida120 list.
export async function checkedExtendedCoachFoods(catalog) {
  const [{ FRIDA_FOODS }, { ADDITIONAL_FRIDA_FOODS }, { catalogFoods }] = await Promise.all([
    import('./frida55.mjs'), import('./frida55Extended.mjs'), import('../coach/model.mjs'),
  ])
  if (FRIDA_FOODS.length !== 40 || ADDITIONAL_FRIDA_FOODS.length !== 80
    || !Array.isArray(catalog) || catalog.length !== 120
    || !FRIDA_FOODS.every((food, i) => food === catalog[i])
    || !ADDITIONAL_FRIDA_FOODS.every((food, i) => food === catalog[40 + i]))
    throw TypeError('Forkert Frida-udvalg')
  const ids = new Set()
  for (const food of catalog) {
    if (!/^frida55:[1-9][0-9]*$/.test(food.id) || ids.has(food.id) || food.basisGrams !== 100
      || !['energyKcal', 'proteinG', 'carbohydrateG', 'fatG'].every(key =>
        typeof food.nutrientsPer100g[key] === 'number' && Number.isFinite(food.nutrientsPer100g[key])
        && food.nutrientsPer100g[key] >= 0)
      || !food.source.citation.includes('FoodID=' + food.id.slice(8) + ';'))
      throw TypeError('Ugyldig Frida-reference')
    ids.add(food.id)
  }
  if (!catalogFoods(catalog)) throw TypeError('Ugyldigt coach-katalog')
  return Object.freeze([...catalog])
}

export async function loadExtendedCoachFoods() {
  const [{ FRIDA_FOODS }, { ADDITIONAL_FRIDA_FOODS }] = await Promise.all([
    import('./frida55.mjs'), import('./frida55Extended.mjs'),
  ])
  return checkedExtendedCoachFoods([...FRIDA_FOODS, ...ADDITIONAL_FRIDA_FOODS])
}
