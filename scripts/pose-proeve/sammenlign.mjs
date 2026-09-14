#!/usr/bin/env node
// ORDRE 188, commit 2: samme klip, to målinger, én tabel. Sammenligner
// commit 1's output (browser, PoseLandmarker) punkt for punkt med Drishtis
// facit (Python, MediaPipe, entropi-loeftmodel-wt2/outputs/videomaal/
// marc-doedloeft-270-bane.json, inkl. dens `usikkerhed`-felt).
//
// "Firefelts-tabellen fra Bhishak 124" (docs/videocoach/RAPPORT-124.md) er
// skabelonen ordren peger på: én række pr. ting der sammenlignes, med
// kvantitative kolonner der SKILLER forskellen fra målemetoden — her: median
// og maks absolut forskel, og hvor mange af de 28 punkter der ligger inden
// for Drishtis eget usikkerhedsbånd (= "det er ikke en uenighed, det er
// støj begge målinger allerede har").
//
// BEVIDST IKKE sammenlignet på lige fod: `stang`-feltet (xFodlaengder/
// yFodlaengder). Denne prøve bruger håndledstilnærmelsen (bane.py's
// ORIGINALE metode), men Drishtis NUVÆRENDE facit-fil bruger siden
// tools/videomaal/stoej.py's automatiske Hough-cirkel-pladeaflæsning i
// stedet — en bevidst forbedring Drishti lavede EFTER bane.py, som ordre 188
// ikke bad om at genskabe (kun bane.py er "stå på skuldre"-kilden, se
// matematik.mjs's egen kommentar). Tabellen viser tallene for `stang` alligevel
// (ordren beder om alle seks felter), men "Hvad ændret" i rapporten forklarer
// HVORFOR en stor stang-forskel her IKKE er en pose-model-uenighed — det er
// to forskellige målemetoder for samme fysiske stang.

import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const APP_ROOT = join(HERE, '..', '..')
const MIN_PATH = join(APP_ROOT, 'outputs', 'pose-proeve', 'marc-doedloeft-270-bane.json')
const DRISHTI_PATH = 'C:\\Users\\Entropi\\Desktop\\entropi-loeftmodel-wt2\\outputs\\videomaal\\marc-doedloeft-270-bane.json'
const OUT_PATH = join(APP_ROOT, 'outputs', 'pose-proeve', 'marc-doedloeft-270-sammenligning.json')

const FELTER = [
  { key: 'ankelGrader', gruppe: 'vinkler', enhed: '°', decimaler: 2 },
  { key: 'knaeGrader', gruppe: 'vinkler', enhed: '°', decimaler: 2 },
  { key: 'hofteGrader', gruppe: 'vinkler', enhed: '°', decimaler: 2 },
  { key: 'torsoGrader', gruppe: 'vinkler', enhed: '°', decimaler: 2 },
  { key: 'xFodlaengder', gruppe: 'stang', enhed: 'fl', decimaler: 4 },
  { key: 'yFodlaengder', gruppe: 'stang', enhed: 'fl', decimaler: 4 },
]

function median(sortedVals) {
  const n = sortedVals.length
  const mid = Math.floor(n / 2)
  return n % 2 === 1 ? sortedVals[mid] : (sortedVals[mid - 1] + sortedVals[mid]) / 2
}

function main() {
  const mine = JSON.parse(readFileSync(MIN_PATH, 'utf-8'))
  const drishti = JSON.parse(readFileSync(DRISHTI_PATH, 'utf-8'))
  const byIndex = new Map(drishti.map(m => [m.billedeIndex, m]))

  const rows = []
  for (const felt of FELTER) {
    const punkter = []
    for (const m of mine) {
      const d = byIndex.get(m.billedeIndex)
      if (!d) continue
      const mv = m[felt.gruppe]?.[felt.key]
      const dv = d[felt.gruppe]?.[felt.key]
      if (mv == null || dv == null) continue
      const diff = Math.abs(mv - dv)
      const baand = d.usikkerhed?.[felt.key] ?? null
      punkter.push({ billedeIndex: m.billedeIndex, egen: mv, drishti: dv, diff, usikkerhedsbaand: baand, indenForBaand: baand == null ? null : diff <= baand })
    }
    const diffsSorted = punkter.map(p => p.diff).sort((a, b) => a - b)
    const maxDiff = diffsSorted.length ? diffsSorted[diffsSorted.length - 1] : null
    const maxPunkt = punkter.find(p => p.diff === maxDiff)
    const medPunkter = punkter.filter(p => p.usikkerhedsbaand != null)
    const indenForAntal = medPunkter.filter(p => p.indenForBaand).length
    rows.push({
      felt: felt.key,
      enhed: felt.enhed,
      n: punkter.length,
      medianAbsForskel: diffsSorted.length ? round(median(diffsSorted), felt.decimaler) : null,
      maksAbsForskel: maxDiff == null ? null : round(maxDiff, felt.decimaler),
      maksVedBilledeIndex: maxPunkt?.billedeIndex ?? null,
      indenForUsikkerhedsbaand: `${indenForAntal}/${medPunkter.length}`,
      punkter,
    })
  }

  writeFileSync(OUT_PATH, JSON.stringify(rows, null, 2) + '\n', 'utf-8')

  console.log(`\n| Felt | Median abs. forskel | Maks abs. forskel (billede) | Inden for usikkerhedsbånd |`)
  console.log(`|---|---|---|---|`)
  for (const r of rows) {
    console.log(`| ${r.felt} | ${r.medianAbsForskel}${r.enhed} | ${r.maksAbsForskel}${r.enhed} (billede ${r.maksVedBilledeIndex}) | ${r.indenForUsikkerhedsbaand} |`)
  }
  console.log(`\nSkrev ${OUT_PATH}`)
}

function round(v, d) { return Math.round(v * 10 ** d) / 10 ** d }

main()
