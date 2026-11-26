// 2411: Kost i dag melder, at en gem lige er lykkedes; Hjem venter da på sine læsninger i stedet for et øjeblik at mangle "Klaret: mad".
// Kun i hukommelsen og kun i ét minut; ingen læsning eller skrivning i databasen.
const VINDUE_MS = 60000
let sidste = null
export function markerKostGem(athleteId, day, nu = Date.now()) { sidste = { athleteId, day, nu } }
export function harNyKostGem(athleteId, day, nu = Date.now()) {
  return !!sidste && sidste.athleteId === athleteId && sidste.day === day && nu - sidste.nu < VINDUE_MS
}
