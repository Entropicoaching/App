// Betaling — Stripe. Marc besluttede udbyderen 5. august 2026.
//
// BEVIDST DEN SIMPLESTE INTEGRATION: et Stripe Payment Link, ikke SDK'et.
//
// Hvorfor det er det rigtige valg her, ikke bare det nemme:
//   - Ingen ny afhængighed i package.json. Intet at holde opdateret.
//   - Ingen API-nøgle i klienten. Der er intet hemmeligt i en Payment Link,
//     og det er derfor umuligt at lække en nøgle fra frontend.
//   - Stripe hoster selve betalingssiden. Vi håndterer aldrig kortdata, og
//     PCI-ansvaret bliver hos dem.
//
// Prisen er lav og produktet ét abonnement. Havde vi haft flere planer,
// kuponer eller prøveperioder, ville SDK'et betale sig — det gør det ikke her.
//
// HVAD MARC SKAL GØRE (kan ikke gøres af en agent):
//   1. Opret produktet i Stripe: Entropi Adaptiv, 100 kr./md., abonnement.
//   2. Lav et Payment Link på det produkt.
//   3. Indsæt linket i CHECKOUT_URL herunder.
//   4. Opret en webhook der sætter entitlement server-side ved betaling.
//
// PUNKT 4 ER DET AFGØRENDE. Uden det kan man betale uden at få adgang — eller
// værre, sætte sit eget niveau uden at betale. Entitlement må ALDRIG sættes
// fra klienten når der er penge involveret. Demoskifteren i Profil er netop
// en demoskifter, og den skal væk samme dag betalingen går live.

// Tomt indtil Marc har oprettet linket. En tom streng er bevidst: en forkert
// URL ville sende en betalende kunde et forkert sted hen.
export const CHECKOUT_URL = ''

// Findes der en betaling at sende folk til? Bemærk at den kræver BEGGE dele:
// et link OG at webhooken er på plads. Et link uden webhook tager imod penge
// uden at give adgang.
export const WEBHOOK_READY = false

export function checkoutReady() {
  return Boolean(CHECKOUT_URL) && WEBHOOK_READY
}

// Hvad der mangler, i klartekst. Bruges af porten, så tilstanden ikke skal
// udledes af to booleans.
export function checkoutStatus() {
  if (!CHECKOUT_URL && !WEBHOOK_READY) return 'Intet Payment Link og ingen webhook.'
  if (!CHECKOUT_URL) return 'Webhook er klar, men Payment Link mangler.'
  if (!WEBHOOK_READY) return 'Payment Link findes, men webhooken mangler — betaling ville ikke give adgang.'
  return 'Klar.'
}
