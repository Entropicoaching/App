// Opvarmningsformlen. Trukket ud af AthleteView.jsx for at kunne testes.
//
// Reglen der bærer det hele: springene skal blive mindre hele vejen op —
// OGSÅ det sidste spring, ind i arbejdssættet. Den gamle formel fordelte
// opvarmningerne pænt indbyrdes og ignorerede afstanden til arbejdsvægten,
// så en 200 kg dødløfter fik 175 → 185 (10 kg) og derefter 185 → 200 (15 kg).
// Rampen tappede altså ned og bad så om det næststørste spring ind i dagens
// tungeste sæt. Se warmup.test.js, som gør netop det til en målbar egenskab.

/**
 * Stangen vejer altid 20 kg. Bekræftet af Marc 8. august 2026.
 *
 * Den stod som en parameter et øjeblik, fordi kvindestangen normalt vejer 15 —
 * men der trænes ikke med den her. En indstilling uden en eneste bruger er værre
 * end en konstant: den ser ud som om nogen skal tage stilling.
 */
export const BAR = 20

/**
 * Fold navnet til ASCII før sammenligning.
 *
 * Øvelsesdata bruger begge stavemåder: både `Bænkpres` og `Baenkpres`, både
 * `Dødløft` og `Doedloeft`. Formlen kendte kun de danske tegn, så `Baenkpres`,
 * `Doedloeft` og `Slingshot baenkpres - topsaet` blev dømt accessories og fik
 * ÉT opvarmningssæt på 60 %. Målt 8. august 2026: 17 af 127 øvelsesnavne var
 * fejlklassificerede — heriblandt almindelig bænkpres og almindeligt dødløft.
 */
const fold = (s) => String(s ?? '').toLowerCase()
  .replace(/æ/g, 'ae').replace(/ø/g, 'oe').replace(/å/g, 'aa')

export function isMainLift(name) {
  const n = fold(name)
  // Variationer der trænes som accessory (lettere ramp). Bemærk: 'sumo' er IKKE
  // her — sumo dødløft er et primært konkurrenceløft og skal have fuld
  // opvarmnings-ramp (ellers ender et tungt topsæt med kun ét spring op).
  // Redskabet afgør FØRST. "Prone Y raise /liggende på bænk)" indeholder "bænk"
  // og blev derfor et hovedløft med fuld stang-ramp. Et navn der beskriver hvor
  // man ligger, er ikke et navn på løftet.
  if (n.includes('triceps') || n.includes('extension') || n.includes('raise') || n.includes('fly') || n.includes('db ') || n.includes('dumbbell') || n.includes('haandvaegt')) return false
  if (n.includes('romanian') || n.includes('rumaen') || n.includes('rdl') || n.includes('stiff') || n.includes('front squat') || n.includes('hack') || n.includes('goblet')) return false
  if (n.includes('squat') || n.includes('baenk') || n.includes('bench') || n.includes('doedl') || n.includes('deadlift')) return true
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
 */
export function calcWarmupSets(workingWeight, plannedReps = 1, exName = '') {
  const W = Number(workingWeight)
  const bar = BAR
  const step = 2.5
  if (!Number.isFinite(W) || W <= 0) return []

  const parsed = parseInt(plannedReps, 10)
  const n = Number.isFinite(parsed) && parsed > 0 ? parsed : 1

  // Afrunding: fine spring tæt på arbejdsvægten, grovere langt nede.
  const rund = (w) => (w / W >= 0.85 ? Math.round(w / step) * step : Math.round(w / (step * 2)) * (step * 2))

  // ---- accessories: kort ramp, aldrig under stangen ----
  if (!isMainLift(exName)) {
    if (W <= bar) return []
    const nm = String(exName ?? '').toLowerCase()
    const isHighLoad = nm.includes('benpress') || nm.includes('leg press') || nm.includes('benpres')
    const ud = []
    for (const p of isHighLoad ? [0.5, 0.75] : [0.6]) {
      const w = rund(W * p)
      if (w <= bar || w >= W || W - w < 10) continue
      if (ud.length && w - ud[ud.length - 1].weight < 10) continue
      ud.push({ weight: w, reps: p < 0.6 ? 5 : p < 0.75 ? 4 : 3, pct: pctTekst(w, W) })
    }
    // Samme regel som hovedløft: springet ind i arbejdssættet må ikke være det
    // største. To faste procenter kan lande skævt — 47,5 kg benpres gav
    // 25 → 35 → [47,5], altså 10 og derefter 12,5. Løft sidste sæt op på
    // gitteret så det passer; kan det ikke, er sættet ikke værd at have.
    while (ud.length >= 2) {
      const sidste = ud[ud.length - 1]
      const forrige = ud[ud.length - 2].weight
      if (W - sidste.weight <= sidste.weight - forrige) break
      const mål = Math.ceil((W + forrige) / 2 / step) * step
      if (mål < W && mål > forrige) { sidste.weight = mål; sidste.pct = pctTekst(mål, W); break }
      ud.pop()
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

  // ALT regnes i hele enheder af `step` (2,5 kg). Det er ikke en detalje:
  // fordelingen garanterer aftagende spring, men afrunding BAGEFTER kan bryde
  // garantien igen. Målt på 26.140 kombinationer gjorde den det i 4.400 af dem
  // — fx 182,5 kg: spring 25 → 12,5 → 15, hvor det sidste spring voksede.
  // Regnes der i hele enheder, lander vægtene på gitteret af sig selv, og der
  // er intet at runde bagefter.
  const bu = Math.round(bar / step)
  const lu = Math.floor(loft / step)              // sidste opvarmning, i enheder
  const S = lu - bu                                // afstand der skal fordeles
  if (S <= 0) return ud

  // Mindste tilladte spring: det sidste, fra sidste opvarmning ind i arbejdssættet.
  const F = Math.max(1, Math.ceil(W / step - lu))
  let k = antalSpring(W - bar)                     // antal opvarmningssæt over stangen
  while (k > 1 && S < k * F) k--                   // der skal være plads til k spring på mindst F
  if (S < F) return ud

  // Reelle spring: g_i = a - i*d, aftagende, g_(k-1) = F, sum = S.
  // Ved k = 1 er der ingen frihed: det ene spring ER hele afstanden.
  const d = k > 1 ? (2 * (S - k * F)) / (k * (k - 1)) : 0
  const a = k > 1 ? F + (k - 1) * d : S

  // Heltalsgør uden at miste hverken sum eller rækkefølge: rund ned, og fordel
  // resten fra de STØRSTE spring og nedad. Så forbliver rækken aftagende.
  // + 1e-9: uden den giver Math.floor(6.0000000000000004 - 0) = 6, men
  // Math.floor(5.999999999999999) = 5 for det sidste spring, der skulle være
  // præcis F. Ét enkelt tabt trin dér vendte spring-rækkefølgen om — det var
  // 348 af de 1.244 resterende brud.
  const g = Array.from({ length: k }, (_, i) => Math.floor(a - i * d + 1e-9))
  let rest = S - g.reduce((x, y) => x + y, 0)
  for (let i = 0; rest > 0; i = (i + 1) % k, rest--) g[i] += 1

  let u = bu
  for (let i = 0; i < k; i++) {
    u += g[i]
    const w = u * step
    if (w <= ud[ud.length - 1].weight || w >= W) continue
    ud.push({ weight: w, reps: repsFor(w / W), pct: pctTekst(w, W) })
  }
  return ud
}

/** Etiketten regnes af den AFRUNDEDE vægt. Ellers står der 75 % på et sæt der er 75,9 %. */
function pctTekst(w, W) {
  return `${Math.round((w / W) * 100)}%`
}
