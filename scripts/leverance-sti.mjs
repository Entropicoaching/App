// ORDRE 205 — prøvekørsler (npm run e2e, maal:telefon, maal:coach-telefon)
// skrev over de committede leverancebilleder i outputs/e2e|maal|maal-coach,
// så en almindelig kørsel efterlod et beskidt træ. Prøverne skriver nu til
// den git-ignorerede outputs/_seneste/ i stedet; leverancemappen opdateres
// kun når kaldet får flaget --opdater-leverance (en ordre der udtrykkeligt
// beder om nye leverancebilleder).
import { cpSync, mkdirSync, rmSync } from 'node:fs'

export function harLeveranceFlag(argv = process.argv) {
  return argv.includes('--opdater-leverance')
}

// Positions-argumenter (fx et label) uden selve flaget, så scripts der
// læser process.argv[2] som label fortsat virker uanset flagets placering.
export function argvUdenLeveranceFlag(argv = process.argv) {
  return argv.filter(a => a !== '--opdater-leverance')
}

// Kopierer prøve-outputtet ind over leverance-facit. Overskriver kun stier
// der findes i kilden; rører ikke andre datoer/labels i målmappen.
export function opdaterLeverance(fraSti, tilSti) {
  mkdirSync(tilSti, { recursive: true })
  rmSync(tilSti, { recursive: true, force: true })
  cpSync(fraSti, tilSti, { recursive: true })
}
