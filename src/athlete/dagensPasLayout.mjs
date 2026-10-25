// APP-OV4: rene layout-hjælpere til Dagens pas (træningsloggen). Ingen React,
// ingen DOM, ingen storage, så de kan prøves med node --test. Kortets logik
// (logning, autofyld, ret-sæt, fortryd, pause) bor uændret i DagensPasCard.jsx;
// her ligger kun det, layoutet og "Næste øvelse"-knappen skal regne ud.

// APP-OV7: den valgte B-præsentation med kg og reps side om side.

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
export function logStil() {
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
    variant: 'B',
    kortHoved: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.6rem' },
    saetPille: { fontFamily: T.sans, fontSize: '0.78rem', fontWeight: 500, color: T.accent, background: T.accentSvag, border: `1px solid ${T.accentKant}`, borderRadius: '999px', padding: '0.2rem 0.7rem', whiteSpace: 'nowrap', flexShrink: 0 },
    navn: { fontFamily: T.serif, fontSize: '2rem', fontWeight: 400, color: T.tekst, lineHeight: 1.1, margin: 0, textAlign: 'left', overflowWrap: 'anywhere' },
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
    // B: to fliser side om side.
    fliser: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' },
    flise: { background: T.flade, border: `1px solid ${T.kant}`, display: 'flex', flexDirection: 'column', minWidth: 0 },
    fliseTop: { padding: '0.6rem 0.5rem 0.2rem', display: 'flex', flexDirection: 'column', alignItems: 'center' },
    fliseKnapper: { display: 'grid', gridTemplateColumns: '1fr 1fr', borderTop: `1px solid ${T.linje}` },
    trin,
    trinFlise: { ...trin, minWidth: 0, width: '100%', minHeight: '52px', fontSize: '1.4rem' },
    trinFliseHoejre: { ...trin, minWidth: 0, width: '100%', minHeight: '52px', fontSize: '1.4rem', borderLeft: `1px solid ${T.linje}` },
    tal: { ...tal, fontSize: '2.6rem', lineHeight: 1.1 },
    enhed: { fontFamily: T.sans, fontSize: '0.8rem', color: T.stille },
    fliseEtiket: { fontFamily: T.mono, fontSize: '0.52rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: T.stille },
    statiskReps: { fontFamily: T.sans, fontSize: '1.6rem', fontWeight: 500, color: T.accent, whiteSpace: 'nowrap' },
    ekstraRaekke: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' },
    ekstraKnap: aktiv => ({ fontFamily: T.mono, fontSize: '0.62rem', letterSpacing: '0.06em', color: aktiv ? T.accent : T.daempet, background: aktiv ? T.accentSvag : 'transparent', border: `1px solid ${aktiv ? T.accentKant : T.kant}`, minHeight: '48px', boxSizing: 'border-box', padding: '0 0.5rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }),
    handlinger: { display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.75rem' },
    godkendt: { flex: 1, minHeight: '64px', boxSizing: 'border-box', fontSize: '0.85rem', letterSpacing: '0.14em', borderRadius: '2px' },
    springOver: { minHeight: '44px', boxSizing: 'border-box', fontSize: '0.58rem', border: 'none', color: T.stille },
    naesteSaet: { fontFamily: T.mono, fontSize: '0.6rem', color: T.daempet, letterSpacing: '0.02em', textAlign: 'left' },
  }
}

// APP-OV6: bunden og bundarket bruger kun retning B.

// Ringens tal: helt tal fra 0 til 100, også ved skæve input.
export function bundProcent(percent) {
  const p = Math.round(Number(percent))
  return Number.isFinite(p) ? Math.min(100, Math.max(0, p)) : 0
}

// "4 sæt × 5", "3 sæt × 8-10" eller "4 sæt" (top + backoff har ingen fælles reps).
export function saetGangeReps(totalSets, reps) {
  return [totalSets && `${totalSets} sæt`, reps && `× ${reps}`].filter(Boolean).join(' ')
}

// Felterne i bundens kort. Hvert synligt stykke tekst er en del af
// naesteKnapNavn(n, percent), så knappens navn rummer alt, der står på den.
export function naesteKort(n, model) {
  return {
    etiket: n ? 'Næste øvelse' : '',
    navn: n ? n.name : 'Sidste øvelse i passet',
    ordination: n ? saetGangeReps(n.totalSets, n.reps) : '',
    efter: n && n.laterCount > 0 ? `(+${n.laterCount})` : '',
    streger: n ? saetStreger({ setNumber: 0, total: n.totalSets }) : [],
    procent: bundProcent(model?.percent),
    handling: 'Hele passet',
  }
}

// Bundarkets linje under navnet: samme felter og format som loggens
// ordination ("4 sæt · × 5 reps · RPE 8").
export function ordinationTekst(ex) {
  if (!ex) return ''
  return [ex.sets && `${ex.sets} sæt`, ex.reps && `× ${ex.reps}${/^[\d\s\-\u2013]+$/.test(String(ex.reps)) ? ' reps' : ''}`, ex.intensity && ex.intensity].filter(Boolean).join(' · ')
}

// Bundens stilarter (loggens farver og skrifter). Kun præsentation.
export function bundStil(percent) {
  const p = bundProcent(percent)
  const ring = 76
  const hul = 62
  const flise = { background: T.flade, border: `1px solid ${T.kant}`, borderRadius: '2px', boxSizing: 'border-box', minWidth: 0 }
  return {
    variant: 'B',
    ring: { width: `${ring}px`, height: `${ring}px`, flexShrink: 0, borderRadius: '50%', display: 'grid', placeItems: 'center', background: `conic-gradient(${T.accent} ${p}%, rgba(237,234,226,0.10) 0)` },
    ringHul: { width: `${hul}px`, height: `${hul}px`, borderRadius: '50%', background: T.flade, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1px', color: T.tekst },
    ringTal: { fontFamily: T.sans, fontSize: '1.4rem', fontWeight: 500, lineHeight: 1, fontVariantNumeric: 'tabular-nums' },
    ringEnhed: { fontFamily: T.sans, fontSize: '0.7rem', lineHeight: 1, color: T.daempet, alignSelf: 'flex-end', marginBottom: '0.3rem' },
    oevelse: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.2rem', textAlign: 'left' },
    etiket: { fontFamily: T.mono, fontSize: '0.52rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: T.stille },
    navn: { fontFamily: T.serif, fontSize: '1.3rem', fontWeight: 400, lineHeight: 1.15, color: T.tekst, overflowWrap: 'anywhere' },
    ordinationRaekke: { display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '0.4rem' },
    ordination: { fontFamily: T.mono, fontSize: '0.66rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: T.accent },
    efter: { fontFamily: T.sans, fontSize: '0.75rem', color: T.stille },
    handling: { fontFamily: T.sans, fontSize: '0.8rem', fontWeight: 500, color: T.accent, flexShrink: 0 },
    // B: to fliser side om side, som loggens kg/reps.
    fliser: { display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', gap: '0.5rem', width: '100%' },
    ringFlise: { ...flise, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.45rem', padding: '0.7rem 0.75rem', minHeight: '128px' },
    oevelseFlise: { ...flise, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '0.5rem', padding: '0.7rem 0.8rem', minHeight: '128px' },
    streger: { display: 'flex', gap: '4px' },
    streg: { flex: 1, height: '4px', borderRadius: '2px', background: 'rgba(237,234,226,0.10)' },
  }
}

// R2-APP-OV5: bundarkets ene næste sæt, eksplicit ud fra modellen
// (pasOverblik). Det første planlagte sæt i den første aktuelle øvelse; ellers
// null. Højst ét sæt i hele passet, uanset rækkefølgen af statusser.
export function naesteSaet(model) {
  const row = (model?.rows || []).find(r => r.current)
  const set = (row?.sets || []).find(s => s.status === 'Planlagt')
  return set ? { index: row.index, number: set.number } : null
}
