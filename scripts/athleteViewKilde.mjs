// ORDRE 373 — src/AthleteView.jsx er delt i moduler under src/athlete/. De
// statiske verify-tjek læste før kun AthleteView.jsx som tekst; nu læser de
// AthleteView.jsx + de moduler den blev delt i (fast liste, i fast
// rækkefølge — IKKE de ældre faner, så tællende og negative tjek ser præcis
// den samme kode som før). Importstier i modulerne ('../x') skrives som
// './x', så importtjekkene (fx `from './athleteWriteGuard'`) rammer samme
// modul som før. Selve tjekkenes regex'er er uændrede.
import { readFileSync, existsSync } from 'node:fs'

export const ATHLETEVIEW_MODULER = [
  'athlete/videoCoachBro.js',
  'athlete/ugeHjaelp.js',
  'athlete/WeekCalendar.jsx',
  'athlete/DagensPasCard.jsx',
  'athlete/RestPauseFooter.jsx',
  'athlete/ForsideGrafer.jsx',
  'athlete/lokaleFoedevarer.js',
  'athlete/NavItems.jsx',
  'athlete/useVideoCoachBro.js',
  'athlete/laesninger.js',
  'athlete/saetSkrivning.js',
  'athlete/beskederOgVaegt.jsx',
  'athlete/kostHandlinger.js',
  'athlete/OnboardingGuide.jsx',
  'athlete/Ramme.jsx',
  'athlete/HjemTab.jsx',
]

export function athleteViewKilde() {
  const src = new URL('../src/', import.meta.url)
  const parts = [readFileSync(new URL('AthleteView.jsx', src), 'utf8')]
  for (const rel of ATHLETEVIEW_MODULER) {
    const url = new URL(rel, src)
    if (!existsSync(url)) continue
    parts.push(readFileSync(url, 'utf8').replace(/(from\s+')\.\.\//g, '$1./'))
  }
  return parts.join('\n')
}
