/**
 * Kanonisk opslag af øvelsesnavne.
 *
 * BAGGRUND (1. september 2026)
 * Fra 3/8 til 30/8 blev nye øvelser oprettet uden æøå ("Baenkpres", "Doedloeft").
 * Årsagen var at udkastfilerne på disken fik ødelagt æøå ved skrivning, og en
 * session løste det ved at stave navnene om. Databasen fejlede aldrig — kun filerne.
 * Navnene er nu ryddet op i alle afsluttede uger, men koden skal være robust,
 * så en enkelt stavemåde aldrig igen kan koste data i graferne.
 *
 * `warmup.js` har haft sin egen fold() siden 8/8. Det her er den samme idé,
 * gjort fælles og udvidet med suffiks-håndtering.
 *
 * MÅLT FØR OPRYDNINGEN: 197 logs fra 17/8 og frem faldt ud af de kategori-
 * filtrerede grafer, fordi `nameToCat` slår op i exercise_library (rent æøå)
 * med et råt toLowerCase(). "Squat" ramte, fordi ordet ikke har danske tegn —
 * bænk og dødløft gjorde ikke.
 */

/** Fold til sammenligning: småt + æøå → ae/oe/aa. Aldrig til visning. */
export const foldNavn = (s) =>
  String(s ?? '').toLowerCase().replace(/æ/g, 'ae').replace(/ø/g, 'oe').replace(/å/g, 'aa')

/**
 * Fjern de suffikser vi selv sætter på i programlægningen, ét lag ad gangen.
 * "Bænkpres - topsæt" og "Bænkpres (comp)" er den samme øvelse i grafen,
 * men to forskellige rækker i historikken — og det skal de blive ved med at være.
 */
// Bindestregen er valgfri: basen har baade "Baenkpres - backoff" og
// "Doedloeft back-off". Suffikset skal staa SIDST og vaere et helt ord.
const SUFFIKS = /(?:\s*-\s*|\s+)(?:tops(?:æ|ae)t|back-?off|volumen|teknik-singler|prim(?:æ|ae)r|sek(?:und(?:æ|ae)r)?|comp)\s*$|\s*\((?:comp|\d+\.\s*eksp\.?)\)\s*$/i

export function grundnavn(name) {
  let s = String(name ?? '').trim()
  for (let i = 0; i < 4 && SUFFIKS.test(s); i++) {
    const kortere = s.replace(SUFFIKS, '').trim()
    // Skael aldrig navnet helt vaek - saa var "suffikset" hele oevelsen.
    if (!kortere) break
    s = kortere
  }
  return s
}

/**
 * Byg kategori-opslaget fra exercise_library.
 * Returnerer et almindeligt objekt (som før), men nøglerne er FOLDEDE.
 * Slå derfor altid op med kategoriFor() — ikke med et råt toLowerCase().
 */
export function byggKategoriOpslag(exerciseLibrary) {
  const map = {}
  // Default-parameter daekker kun undefined. Biblioteket kan vaere null mens
  // det hentes, og et opslag maa aldrig kaste midt i en graf-rendering.
  if (!Array.isArray(exerciseLibrary)) return map
  for (const ex of exerciseLibrary) {
    if (!ex?.name || !ex?.category) continue
    map[foldNavn(ex.name)] = ex.category
    const g = foldNavn(grundnavn(ex.name))
    if (!(g in map)) map[g] = ex.category
  }
  return map
}

/**
 * Slå kategori op på et øvelsesnavn. Prøver i rækkefølge:
 *   fuldt navn → navn uden suffiks, begge foldet.
 * Returnerer null hvis intet match — aldrig et gæt.
 */
export function kategoriFor(name, nameToCat) {
  if (!name || !nameToCat) return null
  return nameToCat[foldNavn(name)] ?? nameToCat[foldNavn(grundnavn(name))] ?? null
}

/** Er navnet et af de tre konkurrenceløft? Stavemåde-uafhængig. */
export function erHovedloeft(name) {
  const n = foldNavn(name)
  return n.includes('squat') || n.includes('baenk') || n.includes('bench') ||
         n.includes('doedl') || n.includes('deadlift')
}
