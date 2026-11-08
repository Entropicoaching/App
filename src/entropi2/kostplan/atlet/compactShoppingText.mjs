import { formatApprovedShopping, grossLabel, maxShoppingText, shoppingNumber } from './approvedShoppingModel.mjs'

// A separate, explicit export of already confirmed gross evidence. Never use
// purchase markers, convert preparation/units, or truncate the full export.
export function formatCompactShopping(result) {
  formatApprovedShopping(result) // Retain the existing evidence/text bound.
  if (!result.dates?.length || !result.items.length) throw new TypeError('Tom indkøbsliste')
  const label = item => JSON.stringify([item.names.join(' / '), item.preparation])
  const counts = new Map()
  for (const item of result.items) counts.set(label(item), (counts.get(label(item)) ?? 0) + 1)
  const text = ['Kort indkøbsliste',
    `Valgte datoer: ${result.dates.map(date => `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`).join(', ')}`,
    grossLabel,
    ...result.items.map((item, index) => {
      // Even identical names/preparations/food IDs from different evidence
      // remain ordered separate rows. Row numbers distinguish that last case.
      const identity = counts.get(label(item)) > 1 ? ` [fødevare-id: ${item.foodId}; række ${index + 1}]` : ''
      return `${item.names.join(' / ')}${identity}: ${shoppingNumber(item.grams)} g. Tilberedning: ${item.preparation}.`
    })].join('\n')
  if (text.length > maxShoppingText) throw new TypeError('Indkøbsliste overstiger tekstgrænsen')
  return text
}
