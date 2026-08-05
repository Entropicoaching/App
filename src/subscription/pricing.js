// Prisen — ét sted.
//
// VIGTIGT: beløbet stammer fra Marcs tegning 4. august 2026 (status/APP-FLOW.md
// i Control Tower). Det er TEGNET, ikke besluttet. Derfor flaget herunder:
// forsiden skal kunne vise prisen uden at påstå at den er endelig, og der skal
// være ét sted at rette den dagen den bliver det.
//
// Der er ingen betaling i appen. Ingen udbyder, ingen afhængighed i
// package.json, ingen købsknap. Prisen er indtil videre kun information.

export const PRICE = {
  amount: 100,
  currency: 'kr.',
  period: 'md.',
}

// Sæt til true når Marc har bekræftet beløbet. Så forsvinder forbeholdet fra
// forsiden — og kun da.
export const PRICE_CONFIRMED = false

export function priceLabel() {
  return `${PRICE.amount} ${PRICE.currency}/${PRICE.period}`
}

// Betaling findes ikke endnu. Så længe den er false må ingen skærm vise en
// købsknap — den ville føre til ingenting.
export const CHECKOUT_AVAILABLE = false
