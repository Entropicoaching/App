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
  }

  const ud = { _meta: meta, oevelser }

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
