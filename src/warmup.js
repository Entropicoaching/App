// Opvarmningsformlen. Trukket ud af AthleteView.jsx for at kunne testes.
//
// Reglen der bærer det hele: springene skal blive mindre hele vejen op —
// OGSÅ det sidste spring, ind i arbejdssættet. Den gamle formel fordelte
// opvarmningerne pænt indbyrdes og ignorerede afstanden til arbejdsvægten,
// så en 200 kg dødløfter fik 175 → 185 (10 kg) og derefter 185 → 200 (15 kg).
// Rampen tappede altså ned og bad så om det næststørste spring ind i dagens
// tungeste sæt. Se warmup.test.js, som gør netop det til en målbar egenskab.

/** Standardstangen. Kvindestangen vejer 15 — derfor er den et argument, ikke en konstant. */
export const DEFAULT_BAR = 20

export function isMainLift(name) {
  const n = (name || '').toLowerCase()
  // Variationer der trænes som accessory (lettere ramp). Bemærk: 'sumo' er IKKE
  // her — sumo dødløft er et primært konkurrenceløft og skal have fuld
  // opvarmnings-ramp (ellers ender et tungt topsæt med kun ét spring op).
  if (n.includes('romanian') || n.includes('rumæn') || n.includes('rdl') || n.includes('stiff') || n.includes('front squat') || n.includes('hack') || n.includes('goblet')) return false
  if (n.includes('squat') || n.includes('bænk') || n.includes('bench') || n.includes('dødl') || n.includes('deadlift')) return true
  // Barbell overhead press (fx Henriks OHP) er et hovedløft og skal have fuld
  // opvarmnings-ramp. Udeluk accessories der tilfældigvis rammer "overhead"
  // (fx "Overhead triceps extension") og håndvægts-varianter.
  if (n.includes('triceps') || n.includes('extension') || n.includes('raise') || n.includes('fly') || n.includes('db ') || n.includes('dumbbell') || n.includes('håndvægt')) return false
  return n.includes('ohp') || n.includes('overhead') || n.includes('militar') || n.includes('push press') || n.includes('strict pres') || n.includes('split jerk')
}

/**
 * Antal opvarmningssæt mellem stang og arbejdsvægt. Skalerer med hvor langt
 * der er at gå — ikke med arbejdsvægten alene, så en 15 kg stang ikke giver
 * en kortere ramp end en 20 kg stang til samme arbejdsvægt.
 */
function antalSpring(afstand) {
  if (afstand < 30) return 1
  if (afstand < 60) return 2
  if (afstand < 100) return 3
  if (afstand < 160) return 4
  return 5
}

/**
 * Warmup-reps afhænger KUN af hvor tæt vi er på arbejdsvægten (ikke af
 * arbejdssættets reps) — man varmer op med flere reps let og tapper opad.
 */
const repsFor = (p) => (p >= 0.88 ? 1 : p >= 0.78 ? 2 : p >= 0.6 ? 3 : 5)

/**
 * Beregn opvarmningssæt op til `workingWeight`.
 *
 * @param {number} workingWeight  dagens arbejdsvægt
 * @param {number|string} plannedReps  reps i arbejdssættet (kun brugt til hvor tæt sidste opvarmning må lægge sig)
 * @param {string} exName  øvelsens navn — afgør hovedløft mod accessory
 * @param {{barWeight?: number, step?: number}} [options]
 */
export function calcWarmupSets(workingWeight, plannedReps = 1, exName = '', options = {}) {
  const W = Number(workingWeight)
  const bar = Number(options.barWeight ?? DEFAULT_BAR)
  const step = Number(options.step ?? 2.5)
  if (!Number.isFinite(W) || W <= 0) return []

  const parsed = parseInt(plannedReps, 10)
  const n = Number.isFinite(parsed) && parsed > 0 ? parsed : 1

  // Afrunding: fine spring tæt på arbejdsvægten, grovere langt nede.
  const rund = (w) => (w / W >= 0.85 ? Math.round(w / step) * step : Math.round(w / (step * 2)) * (step * 2))

  // ---- accessories: kort ramp, aldrig under stangen ----
  if (!isMainLift(exName)) {
    if (W <= bar) return []
    const nm = (exName || '').toLowerCase()
    const isHighLoad = nm.includes('benpress') || nm.includes('leg press') || nm.includes('benpres')
    const ud = []
    for (const p of isHighLoad ? [0.5, 0.75] : [0.6]) {
      const w = rund(W * p)
      if (w <= bar || w >= W || W - w < 10) continue
      if (ud.length && w - ud[ud.length - 1].weight < 10) continue
      ud.push({ weight: w, reps: p < 0.6 ? 5 : p < 0.75 ? 4 : 3, pct: pctTekst(w, W) })
    }
    return ud
  }

  // ---- hovedløft ----
  // Arbejdsvægt på eller under stangen: der er intet at varme op med.
  if (W <= bar) return []

  const ud = [{ weight: bar, reps: 5, pct: 'Stang' }]

  // Sidste opvarmning må ligge tættere på arbejdsvægten ved singler end ved høje reps.
  const topPct = n <= 2 ? 0.92 : n <= 4 ? 0.88 : 0.85
  const loft = Math.min(W * topPct, W - step)
  if (loft <= bar) return ud

  // Det sidste spring — fra sidste opvarmning ind i arbejdssættet — er
  // udgangspunktet, ikke en rest. Det er givet af loftet: F = W - loft.
  // Derefter fordeles resten af afstanden på spring der aftager LINEÆRT ned
  // til F, så F bliver det mindste spring i hele rampen.
  //
  // Første forsøg gik den anden vej: fordel op til arbejdsvægten og klam så
  // ved loftet. Det gav 250 kg et spring på 2,5 kg efterfulgt af 20 kg ind i
  // arbejdssættet — præcis den fejl formlen skulle af med.
  const F = W - loft                       // sidste spring, det mindste
  const S = loft - bar                     // afstand der skal fordeles på opvarmningerne
  let k = antalSpring(W - bar)             // antal opvarmningssæt over stangen

  // Der skal være plads: k spring der alle er mindst F. Ellers færre spring.
  while (k > 1 && S < k * F) k--
  if (S <= 0) return ud

  // g_i = a - i*d, aftagende, g_(k-1) = F, sum = S.
  // Ved k = 1 er der ingen frihed: det ene spring ER hele afstanden op til
  // loftet. Sætter man det til F, stopper rampen halvvejs og efterlader et
  // stort sidste spring — det var fejlen ved 45 kg x5.
  const d = k > 1 ? (2 * (S - k * F)) / (k * (k - 1)) : 0
  const a = k > 1 ? F + (k - 1) * d : S

  let løbende = bar
  for (let i = 0; i < k; i++) {
    løbende += a - i * d
    const w = rund(Math.min(løbende, loft))
    if (w <= ud[ud.length - 1].weight) continue   // afrunding gav samme eller lavere vægt
    if (w >= W || W - w < step) continue          // for tæt på arbejdsvægten til at være et sæt
    ud.push({ weight: w, reps: repsFor(w / W), pct: pctTekst(w, W) })
  }
  return ud
}

/** Etiketten regnes af den AFRUNDEDE vægt. Ellers står der 75 % på et sæt der er 75,9 %. */
function pctTekst(w, W) {
  return `${Math.round((w / W) * 100)}%`
}
