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

function formatTal(v) {
  return Number.isInteger(v) ? String(v) : v.toFixed(1).replace('.', ',')
}

/** "2026-W37" -> "U37" — samme forkortelse som VolumenKort.jsx/VolumenGraf.jsx. */
function ugeKort(ugenoegle_) {
  return ugenoegle_.replace(/^\d{4}-W/, 'U')
}

/** Planlagt minus gennemført, summeret over `grupper`, aldrig under 0 pr. gruppe. */
function samletGabIUge(uge, grupper) {
  let gab = 0
  for (const g of grupper) {
    const planlagtIalt = uge.planlagt.grupper[g]?.ialt || 0
    const gennemfoertIalt = uge.gennemfoert.grupper[g]?.ialt || 0
    gab += Math.max(0, planlagtIalt - gennemfoertIalt)
  }
  return gab
}

/**
 * ORDRE 210 (15. sep), commit 3: op til tre sætninger "i coach-sprog",
 * regnet direkte af beregnPlanlagtPrUge's `uger` — ordrens egen grænse:
 * "ingen anbefaling, kun tal". Returnerer FÆRRE end tre sætninger hvis en
 * af dem ikke ville sige noget (fx under to uger at sammenligne en tendens
 * over, eller ingen gruppe der nogensinde lå under planen).
 *
 * @param {Array<{ uge: string, planlagt: { grupper: Record<string, { ialt: number }> }, gennemfoert: { grupper: Record<string, { ialt: number }> } }>} uger
 *   Kronologisk (ældste først) — samme facon som beregnPlanlagtPrUge's `uger`.
 * @param {string[]} grupper Muskelgruppe-nøgler at se på (samme datasæt som grafens rækker).
 * @param {Record<string, string>} muskelgrupper MUSKELGRUPPER-kortet (nøgle → dansk label).
 * @returns {string[]}
 */
export function opsummerGab(uger, grupper, muskelgrupper) {
  if (!uger.length || !grupper.length) return []
  const saetninger = []

  // 1) Gruppen der i flest uger lå under planen. Uafgjort brydes af
  // grupper-listens egen rækkefølge (første fundne vinder) — deterministisk,
  // ikke en faglig prioritering.
  let bedsteGruppe = null
  let bedsteAntal = 0
  for (const g of grupper) {
    const antal = uger.filter(u => (u.gennemfoert.grupper[g]?.ialt || 0) < (u.planlagt.grupper[g]?.ialt || 0)).length
    if (antal > bedsteAntal) { bedsteAntal = antal; bedsteGruppe = g }
  }
  if (bedsteGruppe) {
    saetninger.push(`${muskelgrupper[bedsteGruppe]} lå under planen ${bedsteAntal} af ${uger.length} uger.`)
  }

  // 2) Ugen med det største samlede gab (summeret over de viste grupper).
  let stoersteUge = null
  let stoersteGab = 0
  for (const u of uger) {
    const gab = samletGabIUge(u, grupper)
    if (gab > stoersteGab) { stoersteGab = gab; stoersteUge = u.uge }
  }
  if (stoersteUge) {
    saetninger.push(`Størst gab i uge ${ugeKort(stoersteUge)}: ${formatTal(stoersteGab)} sæt under planen.`)
  }

  // 3) Vokser eller falder gabet hen over vinduet? Første halvdel mod anden
  // halvdel af de viste uger (midterste uge udelades ved ulige antal, for
  // ikke at lade den tælle i begge — "start" og "nu" skal være entydige).
  if (uger.length >= 2) {
    const midte = Math.floor(uger.length / 2)
    const foerste = uger.slice(0, midte)
    const anden = uger.slice(uger.length - midte)
    const gnsFoerste = foerste.reduce((sum, u) => sum + samletGabIUge(u, grupper), 0) / foerste.length
    const gnsAnden = anden.reduce((sum, u) => sum + samletGabIUge(u, grupper), 0) / anden.length
    const retning = gnsAnden > gnsFoerste ? 'vokser' : gnsAnden < gnsFoerste ? 'falder' : null
    if (retning) {
      saetninger.push(`Gabet ${retning} over vinduet: ${formatTal(gnsFoerste)} sæt/uge i starten, ${formatTal(gnsAnden)} sæt/uge nu.`)
    }
  }

  return saetninger.slice(0, 3)
}
