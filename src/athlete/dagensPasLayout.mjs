// APP-OV4: rene layout-hjælpere til Dagens pas (træningsloggen). Ingen React,
// ingen DOM, ingen storage, så de kan prøves med node --test. Kortets logik
// (logning, autofyld, ret-sæt, fortryd, pause) bor uændret i DagensPasCard.jsx;
// her ligger kun det, layoutet A/B og "Næste øvelse"-knappen skal regne ud.

// To retninger for loggen, så Marc kan vælge. A: tal i fuld bredde under
// hinanden. B: kg og reps som to fliser side om side. Alt andet er fælles.
export const LOG_VARIANTER = ['A', 'B']
export const logVariant = v => (v === 'B' ? 'B' : 'A')

// Appens egne farver og skrifter (samme værdier som athleteShared.js `s`).
export const T = {
  accent: '#c8923a',
  accentSvag: 'rgba(200,146,58,0.10)',
  accentKant: 'rgba(200,146,58,0.45)',
  tekst: '#edeae2',
  daempet: '#a8a498',
  stille: '#7a7770',
  svag: '#4a4844',
  flade: '#141410',
  kort: '#1c1c18',
  linje: 'rgba(237,234,226,0.07)',
  kant: 'rgba(237,234,226,0.13)',
  sans: "'IBM Plex Sans', sans-serif",
  mono: "'IBM Plex Mono', monospace",
  serif: "'Playfair Display', serif",
}

// APP-PERF1: kortet bruger kun forskydning og gruppens samlede antal saet.
// Brug samme grupper som naesteOevelse, uden at bygge alle visningsraekker.
export function dagensPasRaekke(groups, exerciseId) {
  for (const group of groups || []) {
    const row = group.rows.find(row => row.ex.id === exerciseId)
    if (row) return { offset: row.offset, totalSets: group.totalSets }
  }
  return undefined
}

// ORDRE 330 · blok 2 (main): én linje om øvelsen EFTER den aktuelle, og hvor
// mange der kommer efter den igen. Samme regler som main (68f43741), flyttet ud
// som ren funktion. `groups` er exerciseViewGroups(session.exercises).
export function naesteOevelse(groups, exerciseId) {
  const list = groups || []
  const idx = list.findIndex(group => group.rows.some(row => row.ex.id === exerciseId))
  if (idx < 0) return null
  const next = list[idx + 1] || null
  if (!next) return null
  return {
    name: next.name,
    totalSets: next.totalSets,
    reps: next.rows.length === 1 ? next.rows[0].ex.reps || null : null,
    laterCount: Math.max(0, list.length - idx - 2),
  }
}

// Teksten efter navnet, ordret som main: " · 4 sæt × 5" og " (+1)".
export function naesteOevelseDetalje(n) {
  if (!n) return ''
  return [n.totalSets && ` · ${n.totalSets} sæt`, n.reps && ` × ${n.reps}`].filter(Boolean).join('') +
    (n.laterCount > 0 ? ` (+${n.laterCount})` : '')
}

// R1-APP-OV4 (F2): hele linjen som på main ("Næste øvelse: Bænkpres · 4 sæt × 5 (+1)").
// Den synlige knap og dens tilgængelige navn bruger begge denne tekst. Et
// aria-label erstatter knappens synlige tekst for skærmlæsere, så navnet skal
// selv bære øvelse, sæt, reps og (+n); overblikkets procent kommer bagefter.
export function naesteOevelseTekst(n) {
  return n ? `Næste øvelse: ${n.name}${naesteOevelseDetalje(n)}` : 'Sidste øvelse i passet'
}

export function naesteKnapNavn(n, percent) {
  return `${naesteOevelseTekst(n)}. Hele passet, ${percent} % afsluttet`
}

// Sætstregerne øverst i kortet: klarede, det aktuelle og resten. `offset` er
// rækkens forskydning, når en øvelse er delt i top + backoff (exerciseViewRows).
export function saetStreger({ offset = 0, setNumber, total }) {
  const aktuelt = offset + setNumber
  const n = Math.max(0, Number(total) || 0)
  return Array.from({ length: n }, (_, i) => (i + 1 < aktuelt ? 'klaret' : i + 1 === aktuelt ? 'aktuelt' : 'senere'))
}

// Talfeltets bredde i tegn, så "142.5" og "3" begge står roligt og centreret.
export const talBredde = v => `${Math.max(2, String(v ?? '').length + 0.5)}ch`

// Fælles stilarter. Kun præsentation; ingen af dem bærer logik.
export function logStil(variant) {
  const v = logVariant(variant)
  const trin = {
    background: 'transparent', color: T.tekst, border: 'none', cursor: 'pointer',
    fontFamily: T.sans, fontSize: '1.6rem', fontWeight: 300, lineHeight: 1,
    minWidth: '56px', minHeight: '64px', boxSizing: 'border-box', padding: 0, flexShrink: 0,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  }
  const tal = {
    background: 'transparent', border: 'none', outline: 'none', color: T.tekst,
    fontFamily: T.sans, fontWeight: 500, fontVariantNumeric: 'tabular-nums',
    textAlign: 'center', padding: 0, minHeight: '44px', boxSizing: 'border-box',
  }
  return {
    variant: v,
    kortHoved: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.6rem' },
    saetTael: { fontFamily: T.mono, fontSize: '0.6rem', letterSpacing: '0.08em', color: T.daempet, whiteSpace: 'nowrap' },
    saetPille: { fontFamily: T.sans, fontSize: '0.78rem', fontWeight: 500, color: T.accent, background: T.accentSvag, border: `1px solid ${T.accentKant}`, borderRadius: '999px', padding: '0.2rem 0.7rem', whiteSpace: 'nowrap', flexShrink: 0 },
    streger: { display: 'flex', gap: '4px', marginBottom: '1rem' },
    streg: status => ({ flex: 1, height: '4px', borderRadius: '2px', background: status === 'klaret' ? T.accent : status === 'aktuelt' ? 'rgba(200,146,58,0.55)' : 'rgba(237,234,226,0.10)' }),
    navn: { fontFamily: T.serif, fontSize: v === 'B' ? '2rem' : '1.85rem', fontWeight: 400, color: T.tekst, lineHeight: 1.1, margin: 0, textAlign: 'left', overflowWrap: 'anywhere' },
    navnRaekke: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.35rem' },
    ordination: { fontFamily: T.mono, fontSize: '0.7rem', color: T.accent, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.85rem', textAlign: 'left' },
    // "Sidste gang" og "Anbefalet" i én rolig strimmel.
    info: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: T.linje, border: `1px solid ${T.linje}`, marginBottom: '0.85rem' },
    infoEn: { display: 'grid', gridTemplateColumns: '1fr', gap: '1px', background: T.linje, border: `1px solid ${T.linje}`, marginBottom: '0.85rem' },
    infoCelle: { background: T.kort, padding: '0.5rem 0.65rem', textAlign: 'left', minWidth: 0 },
    infoEtiket: { fontFamily: T.mono, fontSize: '0.52rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: T.stille, marginBottom: '0.15rem' },
    infoVaerdi: { fontFamily: T.sans, fontSize: '0.92rem', fontWeight: 500, color: T.tekst, fontVariantNumeric: 'tabular-nums' },
    infoVaerdiAccent: { fontFamily: T.sans, fontSize: '0.92rem', fontWeight: 500, color: T.accent, fontVariantNumeric: 'tabular-nums' },
    infoTekst: { fontFamily: T.mono, fontSize: '0.62rem', lineHeight: 1.45, color: T.stille },
    klaret: { display: 'flex', alignItems: 'center', gap: '0.25rem', marginBottom: '0.75rem', fontFamily: T.mono, fontSize: '0.64rem', color: T.daempet, textAlign: 'left' },
    klaretMaerke: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '18px', height: '18px', borderRadius: '50%', background: T.accentSvag, color: T.accent, fontSize: '0.6rem', marginRight: '0.4rem', flexShrink: 0 },
    tekstKnap: { background: 'none', border: 'none', color: T.stille, cursor: 'pointer', fontFamily: T.mono, fontSize: '0.58rem', letterSpacing: '0.04em', padding: '0 0.25rem', minWidth: '44px', minHeight: '44px', boxSizing: 'border-box', flexShrink: 0 },
    // A: hver værdi i sin egen række i fuld bredde.
    stepper: { display: 'flex', alignItems: 'stretch', background: T.flade, border: `1px solid ${T.kant}`, minHeight: '64px' },
    stepperMidte: { flex: 1, minWidth: 0, display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '0.35rem', borderLeft: `1px solid ${T.linje}`, borderRight: `1px solid ${T.linje}`, padding: '0.35rem 0' },
    stepperStak: { display: 'flex', flexDirection: 'column', gap: '0.5rem' },
    // B: to fliser side om side.
    fliser: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' },
    flise: { background: T.flade, border: `1px solid ${T.kant}`, display: 'flex', flexDirection: 'column', minWidth: 0 },
    fliseTop: { padding: '0.6rem 0.5rem 0.2rem', display: 'flex', flexDirection: 'column', alignItems: 'center' },
    fliseKnapper: { display: 'grid', gridTemplateColumns: '1fr 1fr', borderTop: `1px solid ${T.linje}` },
    trin,
    trinFlise: { ...trin, minWidth: 0, width: '100%', minHeight: '52px', fontSize: '1.4rem' },
    trinFliseHoejre: { ...trin, minWidth: 0, width: '100%', minHeight: '52px', fontSize: '1.4rem', borderLeft: `1px solid ${T.linje}` },
    tal: { ...tal, fontSize: v === 'B' ? '2.6rem' : '2.2rem', lineHeight: 1.1 },
    enhed: { fontFamily: T.sans, fontSize: '0.8rem', color: T.stille },
    fliseEtiket: { fontFamily: T.mono, fontSize: '0.52rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: T.stille },
    statiskReps: { fontFamily: T.sans, fontSize: v === 'B' ? '1.6rem' : '1.4rem', fontWeight: 500, color: T.accent, whiteSpace: 'nowrap' },
    ekstraRaekke: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' },
    ekstraKnap: aktiv => ({ fontFamily: T.mono, fontSize: '0.62rem', letterSpacing: '0.06em', color: aktiv ? T.accent : T.daempet, background: aktiv ? T.accentSvag : 'transparent', border: `1px solid ${aktiv ? T.accentKant : T.kant}`, minHeight: '48px', boxSizing: 'border-box', padding: '0 0.5rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }),
    handlinger: v === 'B'
      ? { display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.75rem' }
      : { display: 'flex', gap: '0.5rem', marginTop: '0.75rem' },
    godkendt: { flex: 1, minHeight: v === 'B' ? '64px' : '60px', boxSizing: 'border-box', fontSize: '0.85rem', letterSpacing: '0.14em', borderRadius: '2px' },
    springOver: v === 'B'
      ? { minHeight: '44px', boxSizing: 'border-box', fontSize: '0.58rem', border: 'none', color: T.stille }
      : { minHeight: '60px', boxSizing: 'border-box', fontSize: '0.58rem', padding: '0.5rem 0.75rem' },
    naesteSaet: { fontFamily: T.mono, fontSize: '0.6rem', color: T.daempet, letterSpacing: '0.02em', textAlign: 'left' },
  }
}
