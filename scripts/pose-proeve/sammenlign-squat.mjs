#!/usr/bin/env node
// ORDRE 218, commit 4: samme tabel-idé som sammenlign.mjs, for
// frontsquattens felter (fire vinkler + hofte.hoejdeFodlaengder, intet
// stang-felt — se matematik.mjs's beregnKontraktPunktSquat()).

import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const APP_ROOT = join(HERE, '..', '..')
const MIN_PATH = join(APP_ROOT, 'outputs', 'pose-proeve', 'marc-frontsquat-0838-bane.json')
const DRISHTI_PATH = 'C:\\Users\\Entropi\\Desktop\\entropi-loeftmodel\\outputs\\videomaal\\marc-frontsquat-0838-bane.json'
const OUT_PATH = join(APP_ROOT, 'outputs', 'pose-proeve', 'marc-frontsquat-0838-sammenligning.json')

const FELTER = [
  { key: 'ankelGrader', gruppe: 'vinkler', enhed: '°', decimaler: 2 },
  { key: 'knaeGrader', gruppe: 'vinkler', enhed: '°', decimaler: 2 },
  { key: 'hofteGrader', gruppe: 'vinkler', enhed: '°', decimaler: 2 },
  { key: 'torsoGrader', gruppe: 'vinkler', enhed: '°', decimaler: 2 },
  { key: 'hoejdeFodlaengder', gruppe: 'hofte', enhed: 'fl', decimaler: 4 },
]

function median(sortedVals) {
  const n = sortedVals.length
  const mid = Math.floor(n / 2)
  return n % 2 === 1 ? sortedVals[mid] : (sortedVals[mid - 1] + sortedVals[mid]) / 2
}
function round(v, d) { return Math.round(v * 10 ** d) / 10 ** d }

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

main()
