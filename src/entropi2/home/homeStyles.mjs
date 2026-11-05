import { s } from '../../athleteShared.js'
export const homeStyles = {
  page: { ...s.wrap, minHeight: 0, maxWidth: 480, margin: '0 auto', padding: '20px 0', boxSizing: 'border-box', overflowWrap: 'anywhere', fontFamily: "'IBM Plex Sans', Arial, sans-serif" },
  card: { ...s.card, border: '1px solid #414139', borderRadius: 16, marginBottom: 20, padding: 20 },
  eyebrow: { ...s.cardLabel, fontSize: 11, fontFamily: "'IBM Plex Mono', Consolas, monospace" },
  title: { ...s.logo, fontSize: 36, lineHeight: 1.12, margin: '12px 0 24px', fontFamily: "'Playfair Display', Georgia, serif" },
  heading: { ...s.logo, fontSize: 28, lineHeight: 1.2, margin: '8px 0 16px', fontFamily: "'Playfair Display', Georgia, serif" },
  text: { fontSize: 16, lineHeight: 1.5, color: '#b8b4a8', whiteSpace: 'pre-wrap' },
  primary: { ...s.btnPrimary, fontSize: 15, textTransform: 'none', letterSpacing: 0, minHeight: 52, width: '100%', borderRadius: 8, fontFamily: 'inherit', marginTop: 16 },
  secondary: { ...s.btnGhost, minHeight: 44, width: '100%', fontSize: 16, textTransform: 'none', letterSpacing: 0, color: '#edeae2', borderColor: '#414139', borderRadius: 8, fontFamily: 'inherit', marginTop: 8 },
  links: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 },
}
