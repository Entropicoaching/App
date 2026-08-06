// Flag der styrer hvad Mitch ser.
//
// CT-033, 5. august 2026: piloten bliver produktet, og det nye bygges ind hos
// ham i stedet for at flytte ham vÃ¦k fra sine data. Metoden er et flag der er
// SLUKKET ved deploy:
//
//   1. byg ind bag flaget â†’ 2. deploy â†’ 3. verificÃ©r at hans flow er uÃ¦ndret
//   â†’ 4. tÃ¦nd fÃ¸rst nÃ¥r Marc selv har set det virke
//
// Egenskaben det giver: der findes aldrig et deploy hvor Mitchs oplevelse
// Ã¦ndrer sig uden at nogen har kigget fÃ¸rst. Det er prÃ¦cis det CT-032
// beskytter, og et slukket flag rÃ¸rer ham ikke.
//
// REGLEN FOR DENNE FIL: et flag her mÃ¥ kun tÃ¦ndes af Marc, og kun efter at
// han har set adfÃ¦rden med egne Ã¸jne. TÃ¦nd det aldrig som en del af en
// anden Ã¦ndring â€” sÃ¥ mister flaget hele sin vÃ¦rdi.

// Forsiden i pilot-skallen. Slukket: pilotens nuvÃ¦rende flow er uÃ¦ndret.
// TÃ¦ndt: en bruger uden aktivt medlemskab mÃ¸der forsiden med de to sÃ¸jler,
// fÃ¸r login-flowet fÃ¸rer videre.
export const PILOT_LANDING = true

// Guiden med spor-valget (gratis/medlem) i pilot-skallen. AfhÃ¦nger af
// PILOT_LANDING â€” forsiden er indgangen til den.
export const PILOT_GUIDE = true

// Prisen i pilot-skallen. Slukket med vilje: Mitch er en rigtig person i en
// GRATIS pilot, og der findes ingen betaling. At vise ham et belÃ¸b â€” ogsÃ¥ med
// forbehold â€” ville stille noget i udsigt der ikke kan kÃ¸bes.
// Marc besluttede det 5. august. TÃ¦ndes nÃ¥r betaling faktisk findes.
export const PILOT_PRICING = false

// Profilsiden i pilot-skallen. Slukket: Mitchs flow er uÃ¦ndret.
// TÃ¦ndt: en fjerde fane "Profil" der VISER hans egne tal â€” niveau, dage, udstyr,
// lÃ¸ftestile og de 1RM'er hele programmet regnes ud fra. Den skriver intet.
//
// Marc savnede den selv 6. august, mens han stod i appen. Uden den kan en bruger
// hverken se eller efterprÃ¸ve de tal alle hans vÃ¦gte kommer af.
export const PILOT_PROFIL = false

// Rigtig opsÃ¦tning for gratis-brugere. Slukket: en gratis-bruger mÃ¸der den
// kosmetiske guide der skriver intet, og en skÃ¦rm der kun kan VISE programmet.
// TÃ¦ndt: han gÃ¥r gennem MemberJourney som alle andre â€” sÃ¦tter selv op, fÃ¥r sit
// eget program og kan logge pas.
//
// Serversiden er pÃ¥ plads (`sub_complete_my_free_setup_v1`, kÃ¸rt 6. august) og
// afviser alt der ikke er free, sÃ¥ en gratis-bruger kan ikke ramme medlemmets
// opsÃ¦tning. Mitch er member og pÃ¥virkes ikke af flaget i nogen af stillingerne.
//
// Det er dette flag der gÃ¸r appen selvkÃ¸rende: sammen med kontooprettelsen er
// det forskellen pÃ¥ at en fremmed kan komme i gang uden at Marc rÃ¸rer noget.
export const PILOT_FREE_SETUP = false

// Alle flag samlet, sÃ¥ en port kan tjekke at intet er tÃ¦ndt ved et uheld.
export const FLAGS = {
  PILOT_LANDING,
  PILOT_GUIDE,
  PILOT_PRICING,
  PILOT_PROFIL,
  PILOT_FREE_SETUP,
}

// Hvilke flag er tÃ¦ndt lige nu. Bruges af verify-pilot-flags-porten.
export function enabledFlags() {
  return Object.entries(FLAGS).filter(([, v]) => v === true).map(([k]) => k)
}
