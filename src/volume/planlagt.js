// ORDRE 185 (14. sep), commit 1: planlagte sæt pr. muskelgruppe for DENNE
// uge — talt fra PROGRAMMET (weeks→sessions→exercises.sets), ikke fra
// loggen. Samme vægtning (PRIMÆR/MEDVIRKENDE) og samme kortlægning
// (muskelkort.js) som de gennemførte sæt i beregn.js, så de to tal er
// sammenlignelige side om side.
//
// Hvorfor kun DENNE uge, ikke et vindue som beregn.js's seks uger: en
// programuge (weeks.week_number) er ikke det samme som en kalenderuge — et
// program kan have huller/deload-uger der ikke følger kalenderen (se
// beregn.js's egen note). Den ENESTE måde en programuge kan placeres i et
// kalendervindue er via weeks.start_date (sat af coachen i kalender-
// tidslinjen, se Dashboard.jsx's setBlockStartDate) — mange uger har den
// ikke sat. At bygge et helt 6-ugers "planlagt"-vindue oven på et felt der
// ofte er tomt ville give huller der ligner fejl. "Denne uge" alene er
// stadig det spørgsmål ordren beder om svar på ("planlagt mod gennemført"),
// og fejler ærligt til 0 når ugen ikke kan findes — se docs/VOLUMEN.md.
//
// Ingen Supabase-kald, ingen UI — Dashboard.jsx's egen `weeks`-state
// (fetchWeeks' `weeks(*, sessions(*, exercises(*)))`-form) er allerede i
// nøjagtig den nestede facon denne fil forventer.

import { slaaOevelseOp } from './muskelkort.js'
import { ugenoegle } from './beregn.js'

/**
 * Planlagte sæt pr. muskelgruppe for den kalenderuge `referenceDato` ligger
 * i — kun for programuger der har en `start_date` i den uge.
 *
 * @param {Array<{ start_date?: string|null, sessions?: Array<{ exercises?: Array<{ name: string, sets: number|string }> }> }>} weeks
 * @param {{ referenceDato?: string|Date, rettelser?: Map }} [options]
 *   `rettelser`: se beregn.js's beregnVolumenPrUge — samme param, givet
 *   uændret videre til slaaOevelseOp (ordre 185 commit 3).
 * @returns {{
 *   uge: string,
 *   grupper: Record<string, { direkte: number, ialt: number }>,
 *   ukendteSaet: number,
 *   ugePlaceret: boolean,
 * }} `ugePlaceret: false` betyder ingen programuge havde en start_date der
 *   rammer denne kalenderuge — "0 planlagt" er da IKKE det samme som "et
 *   tomt program", se docs/VOLUMEN.md.
 */
export function beregnPlanlagtDenneUge(weeks, { referenceDato = new Date(), rettelser } = {}) {
  const uge = ugenoegle(referenceDato)
  const grupper = {}
  let ukendteSaet = 0
  let ugePlaceret = false

  for (const uge_ of weeks || []) {
    if (!uge_.start_date || ugenoegle(uge_.start_date) !== uge) continue
    ugePlaceret = true
    for (const sess of uge_.sessions || []) {
      for (const ex of sess.exercises || []) {
        const antalSaet = Number(ex.sets) || 0
        if (antalSaet <= 0) continue
        const { kendt, grupper: exGrupper } = slaaOevelseOp(ex.name, rettelser)
        if (!kendt) {
          ukendteSaet += antalSaet
          continue
        }
        for (const { gruppe, andel } of exGrupper) {
          if (!grupper[gruppe]) grupper[gruppe] = { direkte: 0, ialt: 0 }
          if (andel === 1) grupper[gruppe].direkte += antalSaet
          grupper[gruppe].ialt += antalSaet * andel
        }
      }
    }
  }

  return { uge, grupper, ukendteSaet, ugePlaceret }
}
