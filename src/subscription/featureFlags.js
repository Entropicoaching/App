// Flag der styrer hvad Mitch ser.
//
// CT-033, 5. august 2026: piloten bliver produktet, og det nye bygges ind hos
// ham i stedet for at flytte ham væk fra sine data. Metoden er et flag der er
// SLUKKET ved deploy:
//
//   1. byg ind bag flaget → 2. deploy → 3. verificér at hans flow er uændret
//   → 4. tænd først når Marc selv har set det virke
//
// Egenskaben det giver: der findes aldrig et deploy hvor Mitchs oplevelse
// ændrer sig uden at nogen har kigget først. Det er præcis det CT-032
// beskytter, og et slukket flag rører ham ikke.
//
// REGLEN FOR DENNE FIL: et flag her må kun tændes af Marc, og kun efter at
// han har set adfærden med egne øjne. Tænd det aldrig som en del af en
// anden ændring — så mister flaget hele sin værdi.

// Forsiden i pilot-skallen. Slukket: pilotens nuværende flow er uændret.
// Tændt: en bruger uden aktivt medlemskab møder forsiden med de to søjler,
// før login-flowet fører videre.
export const PILOT_LANDING = true

// Guiden med spor-valget (gratis/medlem) i pilot-skallen. Afhænger af
// PILOT_LANDING — forsiden er indgangen til den.
export const PILOT_GUIDE = true

// Prisen i pilot-skallen. Slukket med vilje: Mitch er en rigtig person i en
// GRATIS pilot, og der findes ingen betaling. At vise ham et beløb — også med
// forbehold — ville stille noget i udsigt der ikke kan købes.
// Marc besluttede det 5. august. Tændes når betaling faktisk findes.
export const PILOT_PRICING = false

// Alle flag samlet, så en port kan tjekke at intet er tændt ved et uheld.
export const FLAGS = {
  PILOT_LANDING,
  PILOT_GUIDE,
  PILOT_PRICING,
}

// Hvilke flag er tændt lige nu. Bruges af verify-pilot-flags-porten.
export function enabledFlags() {
  return Object.entries(FLAGS).filter(([, v]) => v === true).map(([k]) => k)
}
