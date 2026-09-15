// Delt mellem AthleteView.jsx og dens lazy-loadede underfaner (src/athlete/).
// Udskilt i ordre 232 · commit 2/3, samme begrundelse som dashboardShared.js
// (ordre 130): underfanerne skal kunne importere disse rene stilarter/
// hjælpefunktioner UDEN at trække resten af AthleteView.jsx (og dermed hele
// atlet-monolitten) ind i deres egen chunk. Ren udflytning — ingen
// logikændring. `CountdownRing` bor i sin egen fil
// (src/athlete/CountdownRing.jsx), da react-refresh kun tillader komponent-
// eksporter i en JSX-fil.

export function today() {
  return new Date().toISOString().slice(0, 10)
}

// Forskyd en yyyy-mm-dd-streng med et antal dage (UTC, så det matcher today()).
export function shiftDate(str, days) {
  const d = new Date(str + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// Pæn dansk etiket for en kost-dato relativt til i dag.
export function dateLabel(str) {
  if (str === today()) return 'I dag'
  if (str === shiftDate(today(), -1)) return 'I går'
  const d = new Date(str + 'T12:00:00Z')
  return d.toLocaleDateString('da-DK', { weekday: 'short', day: 'numeric', month: 'short' })
}

// Alternative portionsenheder for udvalgte fødevarer (ud over gram).
// grams = gennemsnitlig vægt af én enhed. Gør logging hurtigere — fx "2 stk" i
// stedet for at skulle gætte gram. Nøgle = fødevarens navn i LOCAL_FOODS.
const PORTION_UNITS = {
  'Æg helt': [{ label: 'stk', grams: 60 }],
  'Æggehvide': [{ label: 'stk', grams: 33 }],
  'Æggeblomme': [{ label: 'stk', grams: 17 }],
  'Kyllingebryst': [{ label: 'stk', grams: 150 }],
  'Banan': [{ label: 'stk', grams: 120 }],
  'Æble': [{ label: 'stk', grams: 180 }],
  'Appelsin': [{ label: 'stk', grams: 150 }],
  'Pære': [{ label: 'stk', grams: 170 }],
  'Rugbrød': [{ label: 'skive', grams: 35 }],
  'Knækbrød': [{ label: 'stk', grams: 10 }],
  'Gulerod': [{ label: 'stk', grams: 70 }],
  'Tomat': [{ label: 'stk', grams: 90 }],
  'Proteinbar': [{ label: 'stk', grams: 60 }],
  'Havregryn': [{ label: 'dl', grams: 35 }],
}

// Returnerer tilgængelige enheder for en fødevare. Gram er altid først (standard).
// Indbyggede fødevarer slår op i PORTION_UNITS; egne fødevarer kan have én
// brugerdefineret enhed via unit_label/unit_grams.
export function unitsForFood(food) {
  const units = [{ label: 'g', grams: 1 }]
  if (!food) return units
  if (food.isCustom && food.unit_label && food.unit_grams > 0) {
    units.push({ label: food.unit_label, grams: Number(food.unit_grams) })
  } else if (PORTION_UNITS[food.name]) {
    units.push(...PORTION_UNITS[food.name])
  }
  return units
}

export const s = {
  wrap: { minHeight: '100vh', background: '#141410', color: '#edeae2', fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 300 },
  topbar: { height: '52px', borderBottom: '1px solid rgba(237,234,226,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1.5rem', background: '#1c1c18', position: 'sticky', top: 0, zIndex: 50 },
  logo: { fontFamily: "'Playfair Display', serif", fontSize: '1rem', color: '#edeae2' },
  page: { maxWidth: '680px', margin: '0 auto', padding: '1.5rem 1rem 6rem' },
  card: { background: '#1c1c18', border: '1px solid rgba(237,234,226,0.07)', padding: '1.25rem', marginBottom: '1.5rem' },
  cardLabel: { fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#c8923a', marginBottom: '0.75rem' },
  fieldLabel: { fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.54rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7a7770', marginBottom: '0.3rem' },
  fieldInput: { width: '100%', background: '#141410', border: '1px solid rgba(237,234,226,0.13)', color: '#edeae2', fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '0.88rem', fontWeight: 300, padding: '0.55rem 0.75rem', outline: 'none' },
  btnPrimary: { background: '#c8923a', color: '#141410', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', border: 'none', padding: '0.5rem 1rem', cursor: 'pointer' },
  btnGhost: { background: 'transparent', color: '#7a7770', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', border: '1px solid rgba(237,234,226,0.13)', padding: '0.5rem 1rem', cursor: 'pointer' },
}
