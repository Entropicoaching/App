// Veje UD af abonnementsappen — ét sted.
//
// 1:1-coaching er et ANDET produkt. Det leveres i Entropi Coach på
// app.entropicoaching.dk, ikke her, og entitlement-modellen har hele tiden
// sagt det ('coaching.personal' → aldrig leveret af denne app). Alligevel
// kunne man vælge "1:1-coaching" som niveau i profilen, som om appen kunne
// give det. Den knap er nu et link i stedet.
//
// To veje, fordi det er to forskellige mennesker:
//   - den der ALLEREDE er atlet og bare skal ind i sin portal
//   - den der vil høre om 1:1 og skal have fat i Marc
//
// Verificeret 5. august 2026 mod entropi-site/coaching.html. Siden HAR en
// ansøgningsformular på #ansoeg — den er den rigtige vej ind, ikke en mail.
// Marcs egen tekst dér: ansøgninger besvares inden for 2-4 hverdage, og han
// er selektiv. Det er en visiteret proces, og en mail uden om den ville
// omgå det han selv har bygget.

export const COACH_APP_URL = 'https://app.entropicoaching.dk'
export const COACHING_INFO_URL = 'https://entropicoaching.dk/coaching.html'
export const COACHING_APPLY_URL = 'https://entropicoaching.dk/coaching.html#ansoeg'
