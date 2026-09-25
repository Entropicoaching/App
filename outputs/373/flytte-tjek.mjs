// ORDRE 373 — bevis for "kun flytning": hver linje der er forsvundet fra
// src/AthleteView.jsx siden main, skal findes UÆNDRET (samme tekst, samme
// indrykning) i et af de nye moduler under src/athlete/ — talt som multimængde,
// så en linje der fandtes to gange også skal findes to gange. Tomme linjer og
// import-linjer tælles ikke (importerne skrives om pr. modul med '../').
// Kørsel: node outputs/373/flytte-tjek.mjs [base-ref, standard main]
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), '..', '..')
const base = process.argv[2] || 'main'
const MODULER = ['videoCoachBro.js', 'ugeHjaelp.js', 'WeekCalendar.jsx', 'DagensPasCard.jsx', 'RestPauseFooter.jsx',
  'ForsideGrafer.jsx', 'lokaleFoedevarer.js', 'NavItems.jsx', 'HjemTab.jsx', 'OnboardingGuide.jsx', 'Ramme.jsx',
  'beskederOgVaegt.jsx', 'kostHandlinger.js', 'laesninger.js', 'saetSkrivning.js', 'useVideoCoachBro.js']

// Fjerner hele import-sætninger (også dem over flere linjer).
const lines = txt => {
  const out = []
  let inImport = false
  for (const l of txt.split(/\r?\n/)) {
    if (!inImport && /^import /.test(l)) inImport = true
    if (inImport) { if (/ from '[^']+'\s*$|^import '[^']+'\s*$/.test(l)) inImport = false; continue }
    out.push(l)
  }
  return out
}
const relevant = l => l.trim() !== ''
const count = arr => arr.reduce((m, l) => m.set(l, (m.get(l) || 0) + 1), new Map())

const before = count(lines(execSync(`git show ${base}:src/AthleteView.jsx`, { cwd: ROOT, encoding: 'utf8' })).filter(relevant))
const after = count(lines(readFileSync(join(ROOT, 'src', 'AthleteView.jsx'), 'utf8')).filter(relevant))
const pool = new Map()
for (const m of MODULER) {
  let txt
  try { txt = readFileSync(join(ROOT, 'src', 'athlete', m), 'utf8') } catch { continue }
  for (const [l, n] of count(lines(txt))) pool.set(l, (pool.get(l) || 0) + n)
}
const missing = []
let moved = 0
for (const [l, n] of before) {
  const gone = n - (after.get(l) || 0)
  if (gone <= 0) continue
  const found = Math.min(gone, pool.get(l) || 0)
  moved += found
  if (found < gone) missing.push({ linje: l.trim().slice(0, 120), mangler: gone - found })
}
const res = { base, flyttedeLinjer: moved, ikkeGenfundet: missing.length, eksempler: missing.slice(0, 40) }
writeFileSync(join(ROOT, 'outputs', '373', 'flytte-tjek.json'), JSON.stringify(res, null, 2) + '\n')
console.log(`${moved} linjer flyttet uændret; ${missing.length} forsvundne linjer ikke genfundet i modulerne`)
for (const m of missing.slice(0, 40)) console.log('  -', m.mangler, '×', m.linje)
