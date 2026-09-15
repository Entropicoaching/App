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
 * Lægger én programuges sessioner→øvelser oven i en { grupper, ukendteSaet }-
 * bucket — den fælles kerne bag både beregnPlanlagtDenneUge og
 * beregnPlanlagtPrUge (ordre 210 commit 1), så de to ikke kan divergere i
 * hvordan et planlagt sæt tælles.
 */
function laegPlanlagtUgeOveni(bucket, uge_, rettelser) {
  for (const sess of uge_.sessions || []) {
    for (const ex of sess.exercises || []) {
      const antalSaet = Number(ex.sets) || 0
      if (antalSaet <= 0) continue
      const { kendt, grupper: exGrupper } = slaaOevelseOp(ex.name, rettelser)
      if (!kendt) {
        bucket.ukendteSaet += antalSaet
        continue
      }
      for (const { gruppe, andel } of exGrupper) {
        if (!bucket.grupper[gruppe]) bucket.grupper[gruppe] = { direkte: 0, ialt: 0 }
        if (andel === 1) bucket.grupper[gruppe].direkte += antalSaet
        bucket.grupper[gruppe].ialt += antalSaet * andel
      }
    }
  }
}

/**
 * Lægger gennemførte sæt (samme facon som beregn.js's `saet`-param) oven i
 * en { grupper, ukendteSaet }-bucket. `skipped`-sæt tælles aldrig med,
 * samme regel som beregn.js.
 */
function laegGennemfoertRaekkeOveni(bucket, raekke, rettelser) {
  if (raekke.skipped) return
  const { kendt, grupper } = slaaOevelseOp(raekke.oevelseNavn, rettelser)
  if (!kendt) {
    bucket.ukendteSaet += 1
    return
  }
  for (const { gruppe, andel } of grupper) {
    if (!bucket.grupper[gruppe]) bucket.grupper[gruppe] = { direkte: 0, ialt: 0 }
    if (andel === 1) bucket.grupper[gruppe].direkte += 1
    bucket.grupper[gruppe].ialt += andel
  }
}

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
  const bucket = { grupper: {}, ukendteSaet: 0 }
  let ugePlaceret = false

  for (const uge_ of weeks || []) {
    if (!uge_.start_date || ugenoegle(uge_.start_date) !== uge) continue
    ugePlaceret = true
    laegPlanlagtUgeOveni(bucket, uge_, rettelser)
  }

  return { uge, grupper: bucket.grupper, ukendteSaet: bucket.ukendteSaet, ugePlaceret }
}

/**
 * ORDRE 210 (15. sep), commit 1: `beregnPlanlagtDenneUge` generaliseret til
 * et helt vindue af daterede programuger, ikke kun "denne uge" — "hele
 * forløbet", nu hvor ordre 204 gør daterede uger til normalen. Planlagt
 * (fra `weeks`→sessions→exercises, som ovenfor) og gennemført (fra `logs`,
 * samme facon som beregn.js's `saet`-param) side om side, PR. KALENDERUGE.
 *
 * Vinduet er "de kalenderuger der har mindst én dateret programuge" — ikke
 * et fast antal uger tilbage (som beregn.js's 6/8), fordi "hele forløbet"
 * kan være kortere eller længere end noget fast tal, og fordi et program
 * med huller (deload, pause) ikke skal have opdigtede nul-uger imellem.
 * Flere programuger i samme kalenderuge (fx en uge flyttet) summeres i
 * samme bucket, ligesom beregnPlanlagtDenneUge allerede gør. Uger UDEN
 * start_date er ikke med i vinduet overhovedet — talt i `ugerUdenDato`
 * i stedet, så UI'et kan sige "N uger mangler en dato" uden at kortet lyver
 * om hvor stort forløbet egentlig er.
 *
 * Gennemførte sæt fra en kalenderuge der IKKE har nogen dateret programuge
 * tælles ikke med her — der er intet at sammenligne dem MOD (se
 * docs/VOLUMEN.md).
 *
 * @param {Array<{ start_date?: string|null, sessions?: Array<{ exercises?: Array<{ name: string, sets: number|string }> }> }>} weeks
 * @param {Array<{ oevelseNavn: string, loggetDato: string|Date, skipped?: boolean }>} logs
 * @param {{ rettelser?: Map }} [options]
 * @returns {{
 *   uger: Array<{
 *     uge: string,
 *     planlagt: { grupper: Record<string, { direkte: number, ialt: number }>, ukendteSaet: number },
 *     gennemfoert: { grupper: Record<string, { direkte: number, ialt: number }>, ukendteSaet: number },
 *   }>,
 *   ugerUdenDato: number,
 * }} `uger` ÆLDSTE FØRST (kronologisk — til forskel fra beregn.js's
 *   nyeste-først, fordi "hele forløbet" læses naturligt som en tidslinje).
 */
export function beregnPlanlagtPrUge(weeks, logs, { rettelser } = {}) {
  const buckets = new Map() // ugenoegle -> { planlagt, gennemfoert }
  let ugerUdenDato = 0

  for (const uge_ of weeks || []) {
    if (!uge_.start_date) { ugerUdenDato += 1; continue }
    const noegle = ugenoegle(uge_.start_date)
    if (!buckets.has(noegle)) {
      buckets.set(noegle, {
        planlagt: { grupper: {}, ukendteSaet: 0 },
        gennemfoert: { grupper: {}, ukendteSaet: 0 },
      })
    }
    laegPlanlagtUgeOveni(buckets.get(noegle).planlagt, uge_, rettelser)
  }

  for (const raekke of logs || []) {
    const noegle = ugenoegle(raekke.loggetDato)
    const bucket = buckets.get(noegle)
    if (!bucket) continue // ingen dateret programuge denne kalenderuge — intet at sammenligne mod
    laegGennemfoertRaekkeOveni(bucket.gennemfoert, raekke, rettelser)
  }

  const uger = [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([uge, { planlagt, gennemfoert }]) => ({ uge, planlagt, gennemfoert }))

  return { uger, ugerUdenDato }
}
