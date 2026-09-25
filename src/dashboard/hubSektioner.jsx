// ORDRE 377: flyttet uændret fra src/Dashboard.jsx (linje 180-193 før
// opdelingen, se docs/DASHBOARD-KORT.md).

// Sektioner vist som kort på atlet-hubben (coach-landingsside). Rækkefølgen
// matcher fane-bar'en; ikonet er en kompakt 24×24 stroke-SVG.
const ic = (d) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{d}</svg>
const HUB_SECTIONS = [
  { key: 'oversigt', label: 'Oversigt', desc: 'Maks, kropsvægt & status', icon: ic(<><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></>) },
  { key: 'kost', label: 'Kost & mål', desc: 'Kcal- og proteinmål', icon: ic(<><path d="M3 2v7a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V2" /><line x1="5" y1="11" x2="5" y2="22" /><path d="M17 2c-1.5 1-2 3-2 5v6h4V2" /><line x1="17" y1="13" x2="17" y2="22" /></>) },
  { key: 'program', label: 'Program', desc: 'Ugeplan & sessioner', icon: ic(<><line x1="6" y1="12" x2="18" y2="12" /><rect x="2.5" y="9" width="3.5" height="6" rx="1" /><rect x="18" y="9" width="3.5" height="6" rx="1" /></>) },
  { key: 'log', label: 'Log', desc: 'Træningslog & historik', icon: ic(<><path d="M4 4h16v16H4z" /><line x1="8" y1="9" x2="16" y2="9" /><line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="12" y2="17" /></>) },
  { key: 'analyse', label: 'Analyse', desc: 'Grafer & belastning', icon: ic(<><line x1="3" y1="21" x2="21" y2="21" /><polyline points="4 15 9 10 13 14 20 6" /></>) },
  { key: 'opvarmning', label: 'Opvarmning', desc: 'Mobilitet & rutiner', icon: ic(<><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></>) },
  { key: 'stævne', label: 'Stævne', desc: 'Plan, historik & rekorder', icon: ic(<><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></>) },
  { key: 'noter', label: 'Noter', desc: 'Coach-noter', icon: ic(<><path d="M4 3h12l4 4v14H4z" /><polyline points="16 3 16 7 20 7" /><line x1="8" y1="12" x2="16" y2="12" /><line x1="8" y1="16" x2="13" y2="16" /></>) },
  { key: 'beskeder', label: 'Beskeder', desc: 'Chat med atleten', icon: ic(<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />) },
]

export { HUB_SECTIONS }
