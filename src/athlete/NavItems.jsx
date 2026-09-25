// Bundnavigationens faner (noegle, etiket, SVG-ikon) — flyttet uaendret ud af
// AthleteView.jsx (ordre 373).

const NAV_ITEMS = [
  {
    key: 'hjem',
    label: 'Hjem',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9.5L12 2l9 7.5V21H15v-7H9v7H3V9.5z" />
      </svg>
    ),
  },
  {
    key: 'program',
    label: 'Program',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
        <line x1="6" y1="12" x2="18" y2="12" />
        <rect x="3" y="8.5" width="3" height="7" rx="1" />
        <rect x="18" y="8.5" width="3" height="7" rx="1" />
        <line x1="1" y1="10" x2="1" y2="14" />
        <line x1="23" y1="10" x2="23" y2="14" />
      </svg>
    ),
  },
  {
    key: 'volumen',
    label: 'Volumen',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <line x1="4" y1="21" x2="20" y2="21" />
        <rect x="5.5" y="13" width="3" height="8" />
        <rect x="10.5" y="8" width="3" height="13" />
        <rect x="15.5" y="4" width="3" height="17" />
      </svg>
    ),
  },
  {
    key: 'fremgang',
    label: 'Fremgang',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 17 9 11 13 15 21 5" />
        <polyline points="15 5 21 5 21 11" />
      </svg>
    ),
  },
  {
    key: 'kost',
    label: 'Kost',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
        <path d="M3 2v5a3 3 0 0 0 6 0V2" />
        <line x1="6" y1="7" x2="6" y2="22" />
        <line x1="21" y1="2" x2="21" y2="22" />
        <path d="M17 2a4 4 0 0 1 4 4" />
      </svg>
    ),
  },
  {
    key: 'mobilisering',
    label: 'Mobilitet',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12a9 9 0 1 1-3-6.7" />
        <polyline points="21 3 21 9 15 9" />
      </svg>
    ),
  },
  {
    key: 'beskeder',
    label: 'Beskeder',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    key: 'stævnedag',
    label: 'Stævne',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    ),
  },
]

export { NAV_ITEMS }
