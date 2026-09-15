#!/usr/bin/env node
// ORDRE 218, commit 2: sammenligner IKKE punktværdier (det gør
// sammenlign.mjs) men BÅNDBREDDER — medianen af `usikkerhed`-feltet, mit
// eget ensemble mod Drishtis eget, felt for felt. Ordrens eget krav:
// "afvigelser over en faktor 2 forklares".

import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const APP_ROOT = join(HERE, '..', '..')
const MIN_PATH = join(APP_ROOT, 'outputs', 'pose-proeve', 'marc-doedloeft-270-bane.json')
const DRISHTI_PATH = 'C:\\Users\\Entropi\\Desktop\\entropi-loeftmodel\\outputs\\videomaal\\marc-doedloeft-270-bane.json'
const OUT_PATH = join(APP_ROOT, 'outputs', 'pose-proeve', 'marc-doedloeft-270-usikkerhed-sammenligning.json')

const FELTER = ['ankelGrader', 'knaeGrader', 'hofteGrader', 'torsoGrader', 'xFodlaengder', 'yFodlaengder']

function median(vals) {
  const s = [...vals].sort((a, b) => a - b)
  const n = s.length
  if (!n) return null
  const mid = Math.floor(n / 2)
  return n % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

function main() {
  const mine = JSON.parse(readFileSync(MIN_PATH, 'utf-8'))
  const drishti = JSON.parse(readFileSync(DRISHTI_PATH, 'utf-8'))

  const rows = []
  for (const felt of FELTER) {
    const mineVals = mine.map(m => m.usikkerhed?.[felt]).filter(v => v != null)
    const drishtiVals = drishti.map(m => m.usikkerhed?.[felt]).filter(v => v != null)
    const medMine = median(mineVals)
    const medDrishti = median(drishtiVals)
    const ratio = medMine != null && medDrishti ? medMine / medDrishti : null
    const overFaktor2 = ratio != null && (ratio > 2 || ratio < 0.5)
    rows.push({
      felt, n_mine: mineVals.length, n_drishti: drishtiVals.length,
      median_mine: medMine == null ? null : round(medMine, felt.endsWith('Grader') ? 2 : 4),
      median_drishti: medDrishti == null ? null : round(medDrishti, felt.endsWith('Grader') ? 2 : 4),
      ratio: ratio == null ? null : round(ratio, 2),
      over_faktor_2: overFaktor2,
    })
  }

  writeFileSync(OUT_PATH, JSON.stringify(rows, null, 2) + '\n', 'utf-8')

  console.log(`\n| Felt | Median mit bånd | Median Drishtis bånd | Forhold (mit/hendes) | Over faktor 2 |`)
  console.log(`|---|---|---|---|---|`)
  for (const r of rows) {
    console.log(`| ${r.felt} | ${r.median_mine} | ${r.median_drishti} | ${r.ratio} | ${r.over_faktor_2 ? 'JA' : 'nej'} |`)
  }
  console.log(`\nSkrev ${OUT_PATH}`)
}

function round(v, d) { return Math.round(v * 10 ** d) / 10 ** d }

main()
