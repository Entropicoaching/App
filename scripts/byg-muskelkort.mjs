#!/usr/bin/env node
// ORDRE 192 (14. sep), commit 1+2: "stå på skuldre" — Marc skal ikke selv
// kortlægge de ~800 mest almindelige styrkeøvelser én ad gangen i browseren
// (se ordre 185's "Ret kortlægning"). free-exercise-db har allerede gjort
// det, med samme primær/sekundær-mønster som src/volume/muskelkort.js
// (se dens egen toptekst, afsnit "STÅ PÅ SKULDRE"). Dette script henter
// kilden ÉN GANG og skriver et statisk resultat — appen henter aldrig noget
// udefra, kun dette script gør, og kun når en udvikler kører det.
//
// KILDE: https://github.com/yuhonas/free-exercise-db (Andrew Jarombek m.fl.),
// licens: The Unlicense (public domain — bekræftet via GitHubs license-API
// mod repoet 14. sep 2026). Hentet mod ét fast commit-SHA (ikke `main`),
// så en gentagen kørsel af scriptet giver samme resultat uden at kilden kan
// ændre sig under fødderne på os.
//
// KØRSEL: `npm run byg:muskelkort` (eller `node scripts/byg-muskelkort.mjs`).
// Skriver src/volume/muskelkort.generet.json. Kræver netadgang — det er
// derfor et script, ikke noget appen selv gør ved kørsel.

import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { MUSKELGRUPPER, normaliserOevelsesnavn } from '../src/volume/muskelkort.js'

const KILDE_COMMIT_SHA = 'a859101d633a01c4a1a920d6a8ce41dabba0705f'
const KILDE_URL = `https://raw.githubusercontent.com/yuhonas/free-exercise-db/${KILDE_COMMIT_SHA}/dist/exercises.json`
const KILDE_REPO = 'https://github.com/yuhonas/free-exercise-db'
const KILDE_LICENS = `The Unlicense (public domain) — ${KILDE_REPO}/blob/${KILDE_COMMIT_SHA}/LICENSE, bekræftet via GitHubs license-API 14. sep 2026`

// Kun øvelser med denne category tælles som styrke — kildens egne andre
// kategorier (stretching, cardio, plyometrics, strongman, powerlifting,
// olympic weightlifting) er ikke "de fleste øvelser en styrkeatlet logger"
// på samme måde, og er bevidst ikke med i denne første version.
const KATEGORI_TILLADT = 'strength'

// Kildens egne udstyrs-strenge, ordret (bemærk 'kettlebells', flertal, som
// kilden staver det) — kun udstyr Marcs atleter rent faktisk bruger.
const UDSTYR_TILLADT = new Set([
  'barbell', 'dumbbell', 'cable', 'machine', 'body only', 'kettlebells', 'bands',
])

// Kildens muskelnavne (venstre side, ordret som i kildens JSON) -> vores
// MUSKELGRUPPER-nøgler. KUN sikre 1:1-oversættelser er med — se
// docs/VOLUMEN.md for hvorfor resten (hamstrings, abdominals, forearms,
// traps, middle back, adductors, abductors, neck) er udeladt i stedet for
// gættet på. 'shoulders' -> anteriorDeltoid er kildens egen grovere
// gruppering (den skelner ikke forreste/midterste/bageste skulder som vi
// gerne ville) — den ærlige grænse er dokumenteret i VOLUMEN.md, ikke gemt.
const MUSKEL_OVERSAETTELSE = {
  quadriceps: 'kneeExtensors',
  glutes: 'hipExtensors',
  'lower back': 'backExtensors',
  calves: 'plantarFlexors',
  chest: 'pectoralisMajor',
  shoulders: 'anteriorDeltoid',
  triceps: 'triceps',
  lats: 'lats',
  biceps: 'biceps',
}

for (const gruppe of Object.values(MUSKEL_OVERSAETTELSE)) {
  if (!(gruppe in MUSKELGRUPPER)) {
    throw new Error(`MUSKEL_OVERSAETTELSE peger på ukendt gruppe "${gruppe}" — ikke i MUSKELGRUPPER`)
  }
}

// ORDRE 192, commit 2: Marc skriver dansk. De ~120 mest almindelige
// styrkeøvelser, dansk navn/alias til venstre -> kildens engelske navn
// PRÆCIS som kilden staver det, til højre. Én linje pr. øvelse, læsbar uden
// at skulle spore kode — det er selve tabellen, resten af scriptet er kun
// opslag og validering. Stavevarianter (æøå, "topsæt"-suffikser) behøver
// IKKE et alias hver — normaliserOevelsesnavn() tåler dem allerede (se
// exerciseNames.js). Et alias der ikke findes i kilden fjernes automatisk
// (talt i _meta.antalDanskAliasUgyldig), aldrig gættet på.
const DANSK_ALIAS = {
  // --- Bænkpres / bryst ------------------------------------------------
  'Håndvægt bænkpres': 'Dumbbell Bench Press',
  'Håndvægt bænkpres neutralt greb': 'Dumbbell Bench Press with Neutral Grip',
  'Håndvægt skråbænk': 'Incline Dumbbell Press',
  'Håndvægt faldbænk': 'Decline Dumbbell Bench Press',
  'Smith machine bænkpres': 'Smith Machine Bench Press',
  'Smith machine skråbænk': 'Smith Machine Incline Bench Press',
  'Smith machine faldbænk': 'Smith Machine Decline Press',
  'Bredt greb bænkpres': 'Wide-Grip Barbell Bench Press',
  'Faldbænk': 'Decline Barbell Bench Press',
  'Skråbænk stang': 'Barbell Incline Bench Press - Medium Grip',
  'Kabel flyes': 'Cable Crossover',
  'Skråbænk kabel flyes': 'Incline Cable Flye',
  'Håndvægt flyes': 'Dumbbell Flyes',
  'Skråbænk flyes': 'Incline Dumbbell Flyes',
  'Dips på bænk': 'Bench Dips',
  'Maskine bænkpres': 'Machine Bench Press',
  'Et-arms håndvægt bænkpres': 'One Arm Dumbbell Bench Press',
  'Kabel bænkpres': 'Cable Chest Press',
  'Armstrækninger': 'Pushups',
  'Armstrækninger med hævede fødder': 'Push-Ups With Feet Elevated',
  'Et-arms gulvpres': 'One Arm Floor Press',
  'Smalt greb håndvægt bænkpres': 'Close-Grip Dumbbell Press',

  // --- Skulder -----------------------------------------------------------
  'Håndvægt skulderpres': 'Dumbbell Shoulder Press',
  'Siddende håndvægt skulderpres': 'Seated Dumbbell Press',
  'Stående håndvægt skulderpres': 'Standing Dumbbell Press',
  'Arnold press': 'Arnold Dumbbell Press',
  'Siddende military press': 'Seated Barbell Military Press',
  'Stående military press': 'Standing Military Press',
  'Maskine skulderpres': 'Machine Shoulder (Military) Press',
  'Smith machine skulderpres': 'Smith Machine Overhead Shoulder Press',
  'Forreste hævning': 'Front Dumbbell Raise',
  'Forreste kabel hævning': 'Front Cable Raise',
  'Sidehævning': 'Side Lateral Raise',
  'Siddende kabel sidehævning': 'Cable Seated Lateral Raise',
  'Siddende sidehævning': 'Seated Side Lateral Raise',
  'Omvendte flyes': 'Reverse Flyes',
  'Kabel bagerste skulderflyes': 'Cable Rear Delt Fly',
  'Ansigtstræk': 'Face Pull',
  'Opretstående roning med stang': 'Upright Barbell Row',
  'Opretstående kaberoning': 'Upright Cable Row',

  // --- Ryg / træk ----------------------------------------------------------
  'Ensidig håndvægt roning': 'One-Arm Dumbbell Row',
  'Stangroning overhåndsgreb': 'Bent Over Barbell Row',
  'Siddende kaberoning': 'Seated Cable Rows',
  'Bredt greb nedtræk': 'Wide-Grip Lat Pulldown',
  'Smalt greb nedtræk': 'Close-Grip Front Lat Pulldown',
  'Et-arms nedtræk': 'One Arm Lat Pulldown',
  'Lige-arms nedtræk': 'Straight-Arm Pulldown',
  'Håndvægt pullover': 'Bent-Arm Dumbbell Pullover',
  'Ryghyperextensions': 'Reverse Hyperextension',
  'Skråbænk roning': 'Incline Bench Pull',
  'Liggende T-bar roning': 'Lying T-Bar Row',
  'T-bar roning': 'T-Bar Row with Handle',
  'Smith machine roning': 'Smith Machine Bent Over Row',
  'Glute-ham raise': 'Natural Glute Ham Raise',

  // --- Biceps --------------------------------------------------------------
  'Bicepscurl med stang': 'Barbell Curl',
  'Håndvægt bicepscurl': 'Dumbbell Bicep Curl',
  'Preachercurl': 'Preacher Curl',
  'Koncentrationscurl': 'Concentration Curls',
  'Siddende håndvægt curl': 'Seated Dumbbell Curl',
  'Skråbænk håndvægt curl': 'Incline Dumbbell Curl',
  'Kabel hammercurl med reb': 'Cable Hammer Curls - Rope Attachment',
  'Stående kabel bicepscurl': 'Standing Biceps Cable Curl',
  'Omvendt bicepscurl med stang': 'Reverse Barbell Curl',
  'Smalt greb EZ-stang curl': 'Close-Grip EZ Bar Curl',
  'Zottman curl': 'Zottman Curl',
  'Skråbænk hammercurl': 'Incline Hammer Curls',
  'Stående omvendt håndvægt curl': 'Standing Dumbbell Reverse Curl',
  'Drag curl': 'Drag Curl',
  'Preacher hammercurl med håndvægt': 'Preacher Hammer Dumbbell Curl',
  'Overhead kabel curl': 'Overhead Cable Curl',
  'Liggende bicepscurl på skråbænk': 'Barbell Curls Lying Against An Incline',

  // --- Triceps ---------------------------------------------------------------
  'Triceps pushdown med reb': 'Triceps Pushdown - Rope Attachment',
  'Triceps pushdown med V-stang': 'Triceps Pushdown - V-Bar Attachment',
  'Overhead triceps extension med kabel og reb': 'Cable Rope Overhead Triceps Extension',
  'Stående overhead triceps extension med stang': 'Standing Overhead Barbell Triceps Extension',
  'Et-arms håndvægt triceps extension': 'Dumbbell One-Arm Triceps Extension',
  'Siddende triceps pres': 'Seated Triceps Press',
  'Omvendt greb triceps pushdown': 'Reverse Grip Triceps Pushdown',
  'Maskine triceps extension': 'Machine Triceps Extension',
  'JM press': 'JM Press',
  'Tate press': 'Tate Press',
  'Faldbænk EZ-stang triceps extension': 'Decline EZ Bar Triceps Extension',
  'Knælende kabel triceps extension': 'Kneeling Cable Triceps Extension',
  'Lav kabel triceps extension': 'Low Cable Triceps Extension',

  // --- Dødløft / hofte ---------------------------------------------------
  'Stivbenet dødløft': 'Stiff-Legged Barbell Deadlift',
  'Stivbenet dødløft med håndvægte': 'Stiff-Legged Dumbbell Deadlift',
  'Kabel dødløft': 'Cable Deadlifts',
  'Et-bens glute bridge': 'Single Leg Glute Bridge',
  'Glute bridge': 'Butt Lift (Bridge)',
  'Glute kickback': 'Glute Kickback',
  'Hofteekstension med elastik': 'Hip Extension with Bands',

  // --- Squat / ben -----------------------------------------------------------
  'Fuld squat med stang': 'Barbell Full Squat',
  'Hacksquat med stang': 'Barbell Hack Squat',
  'Hackpres': 'Hack Squat',
  'Håndvægt squat': 'Dumbbell Squat',
  'Kropsvægt squat': 'Bodyweight Squat',
  'Smith machine squat': 'Smith Machine Squat',
  'Udfald med stang': 'Barbell Lunge',
  'Udfald med håndvægte': 'Dumbbell Lunges',
  'Gående udfald med stang': 'Barbell Walking Lunge',
  'Step-ups med stang': 'Barbell Step Ups',
  'Step-ups med håndvægte': 'Dumbbell Step Ups',
  'Split squat med håndvægte': 'Split Squat with Dumbbells',
  'Smith machine et-bens split squat': 'Smith Single-Leg Split Squat',
  'Squat med smal stance': 'Narrow Stance Squats',
  'Squat med bred stance': 'Wide Stance Barbell Squat',
  'Vægtet jump squat': 'Weighted Jump Squat',
  'Jump squat': 'Freehand Jump Squat',
  'Benpres med smal fodplacering': 'Narrow Stance Leg Press',
  'Smith machine benpres': 'Smith Machine Leg Press',
  'Et-bens benstrækker': 'Single-Leg Leg Extension',
  'Stående lægrejsning': 'Standing Calf Raises',
  'Siddende lægrejsning': 'Seated Calf Raise',
  'Stående lægrejsning med stang': 'Standing Barbell Calf Raise',
  'Stående lægrejsning med håndvægte': 'Standing Dumbbell Calf Raise',
  'Smith machine lægrejsning': 'Smith Machine Calf Raise',
  'Lægpres i benpresmaskine': 'Calf Press On The Leg Press Machine',

  // --- Kettlebell / olympisk ------------------------------------------------
  'Kettlebell swings et-arms': 'One-Arm Kettlebell Swings',
  'Kettlebell thruster': 'Kettlebell Thruster',
  'Kettlebell sumo high pull': 'Kettlebell Sumo High Pull',
  'Kettlebell roning to-arms': 'Two-Arm Kettlebell Row',
  'Turkish get-up': 'Kettlebell Turkish Get-Up (Squat style)',
  'Kettlebell pistol squat': 'Kettlebell Pistol Squat',
  'Power clean': 'Power Clean',
  'Clean and press': 'Clean and Press',
  'Ryk-pull': 'Snatch Pull',
}

function byggGrupperForOevelse(exercise) {
  const grupper = []
  const set = new Set()
  for (const m of exercise.primaryMuscles ?? []) {
    const gruppe = MUSKEL_OVERSAETTELSE[m]
    if (!gruppe) continue
    if (set.has(gruppe)) continue
    set.add(gruppe)
    grupper.push({ gruppe, andel: 1 })
  }
  for (const m of exercise.secondaryMuscles ?? []) {
    const gruppe = MUSKEL_OVERSAETTELSE[m]
    if (!gruppe) continue
    if (set.has(gruppe)) continue
    set.add(gruppe)
    grupper.push({ gruppe, andel: 0.5 })
  }
  return grupper
}

async function main() {
  const res = await fetch(KILDE_URL)
  if (!res.ok) throw new Error(`Kunne ikke hente kilden: HTTP ${res.status}`)
  /** @type {Array<{name:string, category:string, equipment:string|null, primaryMuscles:string[], secondaryMuscles:string[]}>} */
  const kilde = await res.json()

  const oevelser = {}
  const udeladteMuskler = {}
  let udeladtKategori = 0
  let udeladtUdstyr = 0
  let udeladtIngenGruppe = 0
  let kollision = 0

  for (const ex of kilde) {
    if (ex.category !== KATEGORI_TILLADT) { udeladtKategori++; continue }
    if (!UDSTYR_TILLADT.has(ex.equipment)) { udeladtUdstyr++; continue }

    for (const m of [...(ex.primaryMuscles ?? []), ...(ex.secondaryMuscles ?? [])]) {
      if (!(m in MUSKEL_OVERSAETTELSE)) udeladteMuskler[m] = (udeladteMuskler[m] ?? 0) + 1
    }

    const grupper = byggGrupperForOevelse(ex)
    if (grupper.length === 0) { udeladtIngenGruppe++; continue }

    const noegle = normaliserOevelsesnavn(ex.name)
    if (oevelser[noegle]) { kollision++; continue } // beholder den første, gætter ikke på hvilken der er "rigtigst"
    // Ingen engelskNavn gemt her — nøglen er allerede det normaliserede navn,
    // og et ekstra visningsnavn pr. post er ~13 KB af bundle-vækst for et felt
    // intet kaldested læser (se 60 KB-grænsen i ordren, commit 4).
    oevelser[noegle] = grupper
  }

  // ORDRE 192, commit 2: dansk alias -> engelsk navn -> samme post som
  // kildeøvelsen. Et alias hvis mål ikke overlevede filtreringen ovenfor
  // (forkert stavet, eller udelukket af udstyr/kategori/manglende gruppe)
  // droppes her og TÆLLES — det er den samme disciplin som resten af
  // scriptet: udelad frem for at gætte.
  const danskAlias = {}
  const ugyldigeAliaser = []
  for (const [alias, engelskNavn] of Object.entries(DANSK_ALIAS)) {
    const maalNoegle = normaliserOevelsesnavn(engelskNavn)
    if (!oevelser[maalNoegle]) { ugyldigeAliaser.push(alias); continue }
    const aliasNoegle = normaliserOevelsesnavn(alias)
    danskAlias[aliasNoegle] = maalNoegle
  }
  if (ugyldigeAliaser.length > 0) {
    console.warn(`Ugyldige aliaser (mål findes ikke i den filtrerede kilde): ${ugyldigeAliaser.join(', ')}`)
  }

  const meta = {
    kilde: KILDE_REPO,
    kildeCommit: KILDE_COMMIT_SHA,
    hentetDato: new Date().toISOString().slice(0, 10),
    licens: KILDE_LICENS,
    antalIKilde: kilde.length,
    antalMedtaget: Object.keys(oevelser).length,
    antalUdeladtKategori: udeladtKategori,
    antalUdeladtUdstyr: udeladtUdstyr,
    antalUdeladtIngenGruppe: udeladtIngenGruppe,
    antalKollision: kollision,
    udeladteMuskler,
    antalDanskAlias: Object.keys(danskAlias).length,
    antalDanskAliasUgyldig: ugyldigeAliaser.length,
  }

  const ud = { _meta: meta, oevelser, danskAlias }

  const her = path.dirname(fileURLToPath(import.meta.url))
  const maal = path.join(her, '..', 'src', 'volume', 'muskelkort.generet.json')
  const json = JSON.stringify(ud)
  await writeFile(maal, json, 'utf8')

  console.log(`Skrev ${maal}`)
  console.log(`Bytes: ${Buffer.byteLength(json)} (${(Buffer.byteLength(json) / 1024).toFixed(1)} KB)`)
  console.log(JSON.stringify(meta, null, 2))
}

main().catch(err => {
  console.error(err)
  process.exitCode = 1
})
