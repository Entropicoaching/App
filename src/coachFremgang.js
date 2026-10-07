// Ordre 1429: coachens fremgang med SAMME regler som atletens Fremgang (ordre
// 1421): eet navn pr. hovedloeft (exerciseSetView), hoejeste e1RM pr. dag, kun
// fra tunge saet (bestHeavySetPerDay). Hver atlet sammenlignes kun med sig
// selv (aldrig atlet mod atlet). Rene funktioner, ingen React/Supabase.
//
// styrkeLinje() er den ene korte linje oeverst paa atletprofilen: hvad goer
// atleten staerkere nu (svageste hovedloeft, stagnation, smerte-noter). Hvert
// tal kan forklares fra loggen; mangler grundlaget, siger linjen det.
import { exerciseSetView } from './exerciseSetView.js'
import { bestHeavySetPerDay } from './exerciseProgress.js'
import { bodyPartOf, mentionsPain } from './coachBriefingRules.js'

const DAG = 24 * 3600 * 1000
const HOVEDLOEFT = ['Squat', 'Bænkpres', 'Dødløft', 'Sumo dødløft']
const VINDUE_DAGE = 28
const FOER_DAGE = 84
const STAGNATION_UGER = 3
const MIN_PUNKTER = 3
const SMERTE_DAGE = 14
const DELOAD_DAGE = 10
const DELOAD_NAVN = /deload|aflast|taper|stævne|staevne|peak/i

// Samme dagsgraense som dagNoegle i exerciseProgress (lokal tid): UTC-dato gav 7 i stedet for 8 uger mellem 00 og 02 dansk tid.
export const lokalDag = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const dagMs = (dag) => Date.parse(`${dag}T12:00:00Z`)
const rd = (n) => Math.round(n)

function loeftNavn(log) {
  const v = exerciseSetView(log.exercises?.name ?? log.navn)
  return HOVEDLOEFT.includes(v.name) ? v.name : null
}

/**
 * Pr. hovedloeft: dagskurven (hoejeste e1RM pr. dag fra tunge saet) og tallene
 * linjen bygger paa. nu = hoejeste e1RM de seneste 28 dage; foer = hoejeste
 * 28-84 dage tilbage; stagneret = uger siden seneste NYE top (>0,5 % over alt
 * foer). Loeft uden nok tunge dage faar kun punkterne.
 */
export function hovedloeftStatus(logs, today = lokalDag()) {
  const nu = dagMs(today)
  const perLoeft = new Map()
  for (const log of logs || []) {
    const navn = loeftNavn(log)
    if (!navn) continue
    if (!perLoeft.has(navn)) perLoeft.set(navn, [])
    perLoeft.get(navn).push(log)
  }
  const ud = []
  for (const navn of HOVEDLOEFT) {
    if (!perLoeft.has(navn)) continue
    const punkter = bestHeavySetPerDay(perLoeft.get(navn)).filter(p => dagMs(p.dag) <= nu)
    const status = { navn, punkter, nu: null, foer: null, aendring: null, stagneretUger: null, sidsteTop: null }
    const maks = (fra, til) => {
      const v = punkter.filter(p => nu - dagMs(p.dag) >= fra * DAG && nu - dagMs(p.dag) < til * DAG).map(p => p.e1rm)
      return v.length ? Math.max(...v) : null
    }
    status.nu = maks(0, VINDUE_DAGE)
    status.foer = maks(VINDUE_DAGE, FOER_DAGE)
    if (status.nu != null && status.foer != null) status.aendring = Math.round(((status.nu - status.foer) / status.foer) * 1000) / 10
    if (punkter.length >= MIN_PUNKTER) {
      let top = null
      for (const p of punkter) if (!top || p.e1rm > top.e1rm * 1.005) top = p
      status.sidsteTop = top
      status.stagneretUger = Math.floor((nu - dagMs(top.dag)) / (7 * DAG))
    }
    ud.push(status)
  }
  return ud
}

/** Smerte-noter: kun kropsdel og dato, kommentaren citeres aldrig. */
export function smerteNoter(logs, today = lokalDag()) {
  const nu = dagMs(today)
  const set = new Map()
  // Ordre 1545: en smerte skrevet paa et enkelt saet taeller som pas-kommentaren
  // (atleterne skriver ofte kun paa saettet); kilden staar i linjen.
  const tilfoej = (nogle, log, tekst, kilde) => {
    const dag = String(log.logged_at || '').slice(0, 10)
    if (!dag || nu - dagMs(dag) > SMERTE_DAGE * DAG || dagMs(dag) > nu) return
    const key = nogle(dag)
    if (!set.has(key)) set.set(key, { dag, del: bodyPartOf(tekst), loeft: loeftNavn(log), kilde })
  }
  for (const log of logs || []) {
    const sess = log.exercises?.sessions
    if (sess?.athlete_comment && mentionsPain(sess.athlete_comment)) tilfoej(dag => `${sess.id}|${dag}`, log, sess.athlete_comment, 'pas-kommentar')
    if (log.note && mentionsPain(log.note)) tilfoej(dag => `saet|${log.exercise_id ?? log.exercises?.name}|${dag}`, log, log.note, 'sæt-note')
  }
  return [...set.values()].sort((a, b) => b.dag.localeCompare(a.dag))
}

/**
 * Planlagt let uge (deload, taper, peak, staevne) set paa ugens/blokkens navn i
 * de seneste logs. Der er ingen "ingen ny top" at sige i en uge, hvor der med
 * vilje ikke loeftes tungt; deload og blokskifte designes med Marc (hans dom).
 */
export function planlagtLetUge(logs, today = lokalDag()) {
  const nu = dagMs(today)
  return (logs || []).some(log => {
    const navn = log.exercises?.sessions?.weeks?.block_name
    const dag = String(log.logged_at || '').slice(0, 10)
    return navn && DELOAD_NAVN.test(navn) && dag && nu - dagMs(dag) <= DELOAD_DAGE * DAG && dagMs(dag) <= nu
  })
}

const MAANEDER = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
const dagTekst = (dag) => `${Number(dag.slice(8, 10))}. ${MAANEDER[Number(dag.slice(5, 7)) - 1]}`

/**
 * { dele: [{ type, tekst }], tekst } eller null naar der hverken er tunge saet
 * eller smerte at sige noget om. Raekkefoelge: smerte, stagnation, svageste.
 */
export function styrkeLinje(logs, today = lokalDag()) {
  const dele = []
  const smerte = smerteNoter(logs, today)
  if (smerte.length) {
    const s = smerte[0]
    dele.push({ type: 'smerte', tekst: `Smerte: ${s.del ? `${s.del} nævnt` : 'nævnt'} i ${s.kilde} ${dagTekst(s.dag)}${s.loeft ? ` (${s.loeft.toLowerCase()})` : ''}. Ingen stigning, før du har talt med atleten` })
  }
  const status = hovedloeftStatus(logs, today)
  const letUge = planlagtLetUge(logs, today)
  const stagneret = letUge ? null : status.filter(s => s.stagneretUger != null && s.stagneretUger >= STAGNATION_UGER)
    .sort((a, b) => b.stagneretUger - a.stagneretUger)[0]
  if (stagneret) {
    dele.push({ type: 'stagnation', tekst: `${stagneret.navn}: ingen ny top i ${stagneret.stagneretUger} uger (e1RM ${rd(stagneret.sidsteTop.e1rm)} kg, ${dagTekst(stagneret.sidsteTop.dag)})` })
  }
  const maalbare = status.filter(s => s.aendring != null && s !== stagneret)
  const svageste = [...maalbare].sort((a, b) => a.aendring - b.aendring)[0]
  if (svageste && svageste.aendring < 2 && !letUge) {
    const t = svageste.aendring
    dele.push({ type: 'svageste', tekst: `Svageste hovedløft: ${svageste.navn} (e1RM ${svageste.foer} → ${svageste.nu} kg, ${t > 0 ? '+' : ''}${String(t).replace('.', ',')} % mod 1-3 mdr. før)` })
  }
  if (letUge && !dele.some(d => d.type === 'smerte')) {
    dele.push({ type: 'let-uge', tekst: 'Planlagt let uge (deload/taper/peak): ingen stagnation- eller svageste-løft-vurdering nu' })
  }
  if (!dele.length) {
    const nok = status.some(s => s.aendring != null)
    const tal = status.filter(s => s.aendring != null).map(s => `${s.navn} ${s.aendring > 0 ? '+' : ''}${String(s.aendring).replace('.', ',')} %`).join(', ')
    dele.push({ type: 'ok', tekst: nok ? `Alle hovedløft stiger eller holder (e1RM mod 1-3 mdr. før: ${tal}); ingen smerte-noter` : 'Endnu ikke nok tunge sæt til en styrketendens (kræver tunge sæt både seneste 4 uger og 1-3 mdr. før)' })
  }
  return { dele, tekst: dele.map(d => d.tekst).join(' · ') }
}

/** Naar "Aktuel opgave" allerede er smerte-signalet, gentages kun reglen (ikke kropsdel og dato en gang til). */
export function styrkeSmerteRegel(tekst) {
  const i = String(tekst).indexOf('. Ingen stigning')
  return i >= 0 ? tekst.slice(i + 2) : tekst
}
