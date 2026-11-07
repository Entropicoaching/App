import { antalOrd } from '../../antalOrd.mjs'

const number = value => new Intl.NumberFormat('da-DK', { maximumSignificantDigits: 12 }).format(value)

export function shoppingIncompleteWarning(shopping) {
  const count = shopping.missingMeals.length + shopping.unavailableCount
  return count > 0
    ? `Listen er ufuldstændig: ${count} ${antalOrd(count, 'måltid', 'måltider')} mangler ingredienser eller skabelon.`
    : ''
}

// Format only the current view's computed facts. Never export identities,
// sources, diary/history, or derive quantities, units or ingredient metadata.
export function formatShoppingSnapshot({ week, shopping, error, readFailed }) {
  const lines = [`Ugens indkøbsliste · ugen fra ${week}`]
  if (error) lines.push(error)
  if (readFailed || shopping.error) lines.push('Listen er ufuldstændig og kan ikke vises som en komplet indkøbsliste.')
  if (shopping.error) lines.push(shopping.error)
  else {
    const warning = shoppingIncompleteWarning(shopping)
    if (warning) lines.push(warning)
    for (const item of shopping.items) {
      lines.push(`${item.name}: ${number(item.quantity)} ${item.unit} (samlet behov). `
        + `Tilberedning: ${item.preparation ?? 'ukendt'}. `
        + `Bekræftet beholdning: ${item.confirmedStock === null ? 'ikke angivet' : `${number(item.confirmedStock)} ${item.unit}`}. `
        + `Nettokøb: ${number(item.netPurchase)} ${item.unit}.`)
    }
  }
  return lines.join('\n')
}
