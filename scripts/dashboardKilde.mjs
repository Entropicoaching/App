// ORDRE 377 — src/Dashboard.jsx er delt i moduler under src/dashboard/. De
// statiske verify-tjek læste før kun Dashboard.jsx som tekst; nu læser de
// Dashboard.jsx + de moduler den blev delt i (fast liste, i fast rækkefølge —
// IKKE de ældre faner IndbakkeView/AnalyseTab/ProgramTab/VolumenKort, så
// tællende og negative tjek ser præcis den samme kode som før). Importstier i
// modulerne ('../x') skrives som './x', så importtjekkene rammer samme modul
// som før. Samme mønster som scripts/athleteViewKilde.mjs (ordre 373).
// Selve tjekkenes regex'er er uændrede.
import { readFileSync, existsSync } from 'node:fs'

export const DASHBOARD_MODULER = [
  'dashboard/coachVideoHjaelp.js',
  'dashboard/coachKonstanter.js',
  'dashboard/hubSektioner.jsx',
  'dashboard/laesninger.js',
]

export function dashboardKilde() {
  const src = new URL('../src/', import.meta.url)
  const parts = [readFileSync(new URL('Dashboard.jsx', src), 'utf8')]
  for (const rel of DASHBOARD_MODULER) {
    const url = new URL(rel, src)
    if (!existsSync(url)) continue
    parts.push(readFileSync(url, 'utf8').replace(/(from\s+')\.\.\//g, '$1./'))
  }
  return parts.join('\n')
}
