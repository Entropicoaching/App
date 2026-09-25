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
  'dashboard/navigation.js',
  'dashboard/indbakkeHandlinger.js',
  'dashboard/videoReviewHandlinger.js',
  'dashboard/atletHandlinger.js',
  'dashboard/aiRapport.js',
  'dashboard/programHandlinger.js',
  'dashboard/useVideoCoachBro.js',
  'dashboard/BibliotekView.jsx',
  'dashboard/KalenderView.jsx',
  'dashboard/ForsideView.jsx',
  'dashboard/HubTab.jsx',
  'dashboard/OpvarmningTab.jsx',
  'dashboard/OversigtTab.jsx',
  'dashboard/KostTab.jsx',
  'dashboard/LogTab.jsx',
  'dashboard/StaevneTab.jsx',
  'dashboard/NoterTab.jsx',
  'dashboard/BeskederTab.jsx',
  'dashboard/VideoReviewModal.jsx',
  'dashboard/StaevneResultatModal.jsx',
  'dashboard/NyAtletModal.jsx',
  'dashboard/Overlays.jsx',
  'dashboard/Sidebar.jsx',
  'dashboard/MobilNav.jsx',
  'dashboard/ProfilHoved.jsx',
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
