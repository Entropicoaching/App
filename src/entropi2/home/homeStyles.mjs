import { s } from '../../athleteShared.js'
// Ordre 2035f (Marc 23. nov.: "ui lidt mindre rodet for atleten"): designretning A, valgt 13. nov.:
// serif kun i overskrifter og mindre end før, radius 12, ingen skygge, ét amber kort pr. skærm.
export const homeStyles = {
  page: { ...s.wrap, minHeight: 0, maxWidth: 480, margin: '0 auto', padding: '20px 0', boxSizing: 'border-box', overflowWrap: 'anywhere', fontFamily: "'IBM Plex Sans', Arial, sans-serif" },
  card: { ...s.card, border: '1px solid #414139', borderRadius: 12, marginBottom: 16, padding: 20 },
  eyebrow: { ...s.cardLabel, fontSize: 11, fontFamily: "'IBM Plex Mono', Consolas, monospace", marginBottom: 8 },
  title: { ...s.logo, fontSize: 28, lineHeight: 1.15, margin: '8px 0 20px', fontFamily: "'Playfair Display', Georgia, serif" },
  heading: { ...s.logo, fontSize: 22, lineHeight: 1.2, margin: '4px 0 12px', fontFamily: "'Playfair Display', Georgia, serif" },
  text: { fontSize: 16, lineHeight: 1.5, color: '#b8b4a8', whiteSpace: 'pre-wrap' },
  // Dæmpet linje under et kort (fx ugens pas), uden eget kort.
  muted: { fontSize: 14, lineHeight: 1.4, color: '#b8b4a8', margin: '0 0 16px' },
  primary: { ...s.btnPrimary, fontSize: 15, textTransform: 'none', letterSpacing: 0, minHeight: 52, width: '100%', borderRadius: 8, fontFamily: 'inherit', marginTop: 16 },
  secondary: { ...s.btnGhost, minHeight: 44, width: '100%', fontSize: 16, textTransform: 'none', letterSpacing: 0, color: '#edeae2', borderColor: '#414139', borderRadius: 8, fontFamily: 'inherit', marginTop: 8 },
  // Sekundær vej som tekstlink: ingen kant, så kun hovedhandlingen ligner en knap.
  link: { background: 'transparent', border: 0, padding: 0, minHeight: 44, width: '100%', textAlign: 'left', cursor: 'pointer',
    fontSize: 16, color: '#c8923a', fontFamily: 'inherit', textDecoration: 'underline', textUnderlineOffset: 3 },
  links: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 },
}
