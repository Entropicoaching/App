// Designtokens for abonnementsprototypen.
//
// Værdierne er KOPIERET fra 1:1-portalens AthleteView.jsx (s-objektet), ikke
// importeret. De to produkter skal kunne udvikle deres udseende hver for sig,
// og prototypen må ikke kunne trække en ændring med sig ind i atletportalen.

export const color = {
  bg: '#141410',
  panel: '#1c1c18',
  text: '#edeae2',
  muted: '#aaa69f',
  dim: '#8b877f',
  accent: '#c8923a',
  accentSoft: 'rgba(200,146,58,0.15)',
  accentBorder: 'rgba(200,146,58,0.35)',
  line: 'rgba(237,234,226,0.07)',
  lineStrong: 'rgba(237,234,226,0.13)',
  good: '#6cba6c',
}

export const font = {
  sans: "'IBM Plex Sans', system-ui, sans-serif",
  mono: "'IBM Plex Mono', ui-monospace, Consolas, monospace",
  display: "'Playfair Display', Georgia, serif",
}

// Mobil først: siden er bygget til en 390px-bred skærm og vokser til en
// centreret kolonne på større skærme.
export const s = {
  wrap: {
    minHeight: '100svh',
    background: color.bg,
    color: color.text,
    fontFamily: font.sans,
    fontWeight: 300,
  },
  topbar: {
    height: '52px',
    borderBottom: `1px solid ${color.line}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 1rem',
    background: color.panel,
    position: 'sticky',
    top: 0,
    zIndex: 50,
  },
  logo: { fontFamily: font.display, fontSize: '1rem', color: color.text },
  page: { maxWidth: '520px', margin: '0 auto', padding: '1.25rem 1rem 6.5rem' },
  h1: {
    fontFamily: font.display,
    fontSize: '1.8rem',
    fontWeight: 400,
    color: color.text,
    lineHeight: 1.15,
    margin: '0 0 0.5rem',
  },
  h2: {
    fontFamily: font.display,
    fontSize: '1.25rem',
    fontWeight: 400,
    color: color.text,
    lineHeight: 1.2,
    margin: 0,
  },
  label: {
    fontFamily: font.mono,
    fontSize: '0.56rem',
    fontWeight: 500,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: color.accent,
  },
  meta: {
    fontFamily: font.mono,
    fontSize: '0.62rem',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: color.muted,
  },
  body: { fontSize: '0.9rem', lineHeight: 1.5, color: color.muted },
}
