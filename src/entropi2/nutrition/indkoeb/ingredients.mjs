// Local explicit ingredient contract. Only documented g/kg mass is converted.
// Preparation and provenance are supplied facts; no title/macro/catalog guessing.
export const ingredientText = value => typeof value === 'string'
  ? value.normalize('NFC').replace(/\p{Cc}/gu, ' ').trim().replace(/\s+/g, ' ') : ''
export function quantityNumber(raw) {
  return typeof raw === 'number' ? raw
    : typeof raw === 'string' && /^\d+(?:[.,]\d+)?$/.test(raw.trim()) ? Number(raw.trim().replace(',', '.')) : NaN
}
export function readIngredients(value) {
  if (value == null) return undefined // Legacy templates remain valid, incomplete.
  if (!Array.isArray(value) || value.length > 100) throw new TypeError('Højst 100 ingredienser')
  return value.map(row => {
    const name = ingredientText(row?.name), unit = ingredientText(row?.unit).toLocaleLowerCase('da-DK')
    const quantity = quantityNumber(row?.quantity)
    if (!name || name.length > 200 || !unit || unit.length > 40 || !Number.isFinite(quantity) || quantity <= 0) {
      throw new TypeError('Ingredienser kræver navn, positiv mængde og enhed')
    }
    const item = { name, quantity, unit }
    for (const field of ['foodId', 'preparation']) {
      if (row[field] == null) continue
      const text = ingredientText(row[field])
      if (!text || text.length > 1000) throw new TypeError('Ugyldig ingrediensidentitet eller tilberedning')
      item[field] = text
    }
    if (row.source != null) {
      if (typeof row.source === 'string') {
        const source = ingredientText(row.source)
        if (!source || source.length > 2000) throw new TypeError('Ugyldig kilde')
        item.source = source
      } else {
        const citation = ingredientText(row.source?.citation), verification = ingredientText(row.source?.verification)
        if (!citation || !verification || citation.length > 2000 || verification.length > 1000) throw new TypeError('Kilde kræver citation og status')
        item.source = { citation, verification }
      }
    }
    return item
  })
}
export function massIngredient(item) {
  const quantity = item.quantity * (item.unit === 'kg' ? 1000 : 1)
  if (!Number.isFinite(quantity)) throw new TypeError('Mængden er for stor')
  return { ...item, quantity, unit: item.unit === 'kg' ? 'g' : item.unit }
}
export function ingredientKey(item) {
  return JSON.stringify([item.foodId ?? null,
    item.foodId ? null : ingredientText(item.name).toLocaleLowerCase('da-DK'),
    item.source ?? null, item.preparation ?? null, item.unit])
}
