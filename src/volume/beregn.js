// ORDRE 177 (13. sep), commit 2: regnestykket — givet en atlets loggede sæt,
// hvor mange sæt lander de på hver muskelgruppe, pr. uge. Rene funktioner,
// ingen Supabase-kald, ingen UI — se src/dashboard/VolumenKort.jsx for
// hvordan athleteLogs (Dashboard.jsx's egen fetchAthleteLogs-form) omsættes
// til de flade rækker denne fil forventer.
//
// "Kun gennemførte sæt tælles, ikke planlagte" (ordrens egen ordlyd): et
// sæt markeret skipped:true er et sæt atleten aktivt har sprunget over
// (se AthleteView.jsx's korrigerSæt/skip-flow) — det er IKKE et udført sæt,
// og tælles derfor aldrig med her, uanset hvilken øvelse det står på.
//
// Ugenøgle = KALENDERuge (mandag-søndag, ISO 8601-nummereret) for
// logget_dato, IKKE appens programuge (weeks.week_number). Et program kan
// have huller/deload-uger som ikke følger kalenderen — coachens spørgsmål
// ("20 sæt quads ugentlig") handler om hvornår kroppen faktisk blev
// belastet, ikke om programstrukturen. Se docs/VOLUMEN.md.
//
// Kalenderdato læses som `String(loggetDato).slice(0, 10)` — samme
// konvention Dashboard.jsx allerede bruger til at gruppere exercise_logs
// pr. dag (se dens fetchTrainingExport-funktion). Ingen ny tidszone-logik
// opfundet her.

import { slaaOevelseOp } from './muskelkort.js'

function kalenderdato(loggetDato) {
  const s = loggetDato instanceof Date ? loggetDato.toISOString() : String(loggetDato)
  return s.slice(0, 10)
}

/**
 * ISO 8601-ugenøgle ("YYYY-Www") for en kalenderdato. Mandag=ugens første
 * dag, ugen der indeholder årets første torsdag er uge 1 — standard
 * ISO-regel, ingen egen opfindelse.
 *
 * @param {string|Date} loggetDato
 * @returns {string}
 */
export function ugenoegle(loggetDato) {
  const [aar, maaned, dag] = kalenderdato(loggetDato).split('-').map(Number)
  const d = new Date(Date.UTC(aar, maaned - 1, dag))
  const ugedagMandag0 = (d.getUTCDay() + 6) % 7 // 0=mandag..6=søndag
  d.setUTCDate(d.getUTCDate() - ugedagMandag0 + 3) // torsdag i samme uge
  const aarStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const ugeNr = Math.ceil(((d - aarStart) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(ugeNr).padStart(2, '0')}`
}

// Mandagen (UTC-midnat) i den kalenderuge en dato ligger i — bruges kun til
// at gå N uger tilbage, ikke til selve ugenøglen (den er ISO-numrene ovenfor).
function ugeMandag(loggetDato) {
  const [aar, maaned, dag] = kalenderdato(loggetDato).split('-').map(Number)
  const d = new Date(Date.UTC(aar, maaned - 1, dag))
  const ugedagMandag0 = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - ugedagMandag0)
  return d
}

/**
 * De seneste `antalUger` ugenøgler, NYESTE FØRST, endende med ugen der
 * indeholder `referenceDato`.
 */
function seneste_ugenoegler(referenceDato, antalUger) {
  const startMandag = ugeMandag(referenceDato)
  const noegler = []
  for (let i = 0; i < antalUger; i++) {
    const mandag = new Date(startMandag)
    mandag.setUTCDate(mandag.getUTCDate() - 7 * i)
    noegler.push(ugenoegle(mandag))
  }
  return noegler
}

/**
 * Sæt pr. muskelgruppe pr. uge, for de seneste `antalUger` kalenderuger.
 *
 * @param {Array<{ oevelseNavn: string, loggetDato: string|Date, skipped?: boolean }>} saet
 *   Kun gennemførte sæt gives med — skipped:true-rækker filtreres væk her,
 *   så kaldstedet ikke selv skal huske det.
 * @param {{ antalUger?: number, referenceDato?: string|Date, rettelser?: Map }} [options]
 *   `rettelser`: Marcs egne kortlægningsrettelser (src/volume/rettelser.js's
 *   hentRettelser()), givet videre uændret til slaaOevelseOp — se ordre 185
 *   commit 3. Udeladt/tom betyder "kun det indbyggede skøn", som før.
 * @returns {Array<{
 *   uge: string,
 *   grupper: Record<string, { direkte: number, ialt: number }>,
 *   ukendteSaet: number,
 * }>} NYESTE UGE FØRST. Uger uden nogen logs er med, alle tal 0 — en coach
 *   skal kunne se "ingen sæt denne uge", ikke en manglende linje.
 */
export function beregnVolumenPrUge(saet, { antalUger = 6, referenceDato = new Date(), rettelser } = {}) {
  const ugenoegler = seneste_ugenoegler(referenceDato, antalUger)
  const vinduet = new Set(ugenoegler)
  const buckets = new Map(ugenoegler.map(u => [u, { grupper: {}, ukendteSaet: 0 }]))

  for (const raekke of saet) {
    if (raekke.skipped) continue
    const uge = ugenoegle(raekke.loggetDato)
    if (!vinduet.has(uge)) continue // uden for det viste vindue
    const bucket = buckets.get(uge)
    const { kendt, grupper } = slaaOevelseOp(raekke.oevelseNavn, rettelser)
    if (!kendt) {
      bucket.ukendteSaet += 1
      continue
    }
    for (const { gruppe, andel } of grupper) {
      if (!bucket.grupper[gruppe]) bucket.grupper[gruppe] = { direkte: 0, ialt: 0 }
      if (andel === 1) bucket.grupper[gruppe].direkte += 1
      bucket.grupper[gruppe].ialt += andel
    }
  }

  return ugenoegler.map(uge => ({ uge, ...buckets.get(uge) }))
}
