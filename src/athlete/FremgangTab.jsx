// Fremgang-fanen (ordre 284) — "er squatten rent faktisk blevet stærkere
// siden marts", for ÉN øvelse ad gangen: tungeste sæt pr. uge og det
// beregnede énrepetitionsmaksimum. Al regnelogik (herunder hovedløfts-
// familierne til øvelsesvælgeren) bor i ../exerciseProgress.js — denne fil
// er kun visning + hvilken øvelse der er valgt, samme arbejdsdeling som
// VolumenTab.jsx (regning i src/volume/beregn.js).
//
// Data ejes af AthleteView.jsx: fremgangLogs/fremgangLoading (al log-
// historik, lazy-hentet når fanen åbnes — se dens fetchFremgangLogs) og
// allWeeks (hele programmet, allerede hentet ved login til Program-fanen —
// se dens fetchProgram). Øvelsesvælgeren viser navne fra allWeeks, IKKE kun
// fra fremgangLogs: en øvelse man endnu ikke har logget skal stadig kunne
// vælges og vise "Ingen logninger endnu." — listede den kun logs, ville en
// tom øvelse aldrig kunne stå i listen overhovedet.
import { useMemo, useState } from 'react'
import { heaviestSetPerWeek, grupperOevelsesnavne, HOVEDLOEFT_FAMILIER } from '../exerciseProgress.js'
import { s } from '../athleteShared'

const mono = "'IBM Plex Mono', monospace"

function navneFraProgram(allWeeks) {
  const set = new Set()
  for (const week of allWeeks || []) {
    for (const session of week.sessions || []) {
      for (const exercise of session.exercises || []) {
        if (exercise.name) set.add(exercise.name)
      }
    }
  }
  return [...set]
}

function navneFraLogs(logs) {
  const set = new Set()
  for (const log of logs || []) {
    const navn = log.exercises?.name
    if (navn) set.add(navn)
  }
  return set
}

// Familiens "eget" navn (fx "Squat") frem for en variant (fx "Frontsquat"),
// så ét tryk på "Squat" åbner squattens EGEN kurve — ikke bare den første
// variant der tilfældigvis blev logget. Findes det ikke, falder vi tilbage
// til den første variant i gruppen.
function hovednavnForFamilie(familie, navneIFamilie) {
  const eksakt = navneIFamilie.find(n => n.toLowerCase() === familie.label.toLowerCase())
  return eksakt || navneIFamilie[0] || null
}

// "Squat e1RM 117 kg, +7 kg siden uge 36" (ordre 422, I4): tallet atleten
// leder efter står i normal størrelse over grafen, ikke kun som 7 px-etiket
// i grafens hjørne. Ugen er kalenderugen fra ugenoegle ("2026-W36" → 36).
function ugeNr(uge) {
  return Number(String(uge).split('-W')[1]) || uge
}

function fremgangLinje(navn, punkter) {
  if (punkter.length < 2) return null
  const forste = punkter[0], sidste = punkter[punkter.length - 1]
  const diff = sidste.e1rm - forste.e1rm
  const aendring = diff > 0 ? `+${diff} kg` : diff < 0 ? `−${-diff} kg` : 'uændret'
  return `${navn} e1RM ${sidste.e1rm} kg, ${aendring} siden uge ${ugeNr(forste.uge)}`
}

// Linjegraf over ugentligt bedste e1RM — samme visuelle sprog som
// AthleteView.jsx's E1RMChart/ReadinessSparkline (én linje, ingen akser med
// tal ud over start/slut), men for ÉN øvelse og med vægt×reps synlig pr.
// punkt (ordrens "tungeste sæt pr. uge", ikke kun det udregnede tal).
// Ordre 422: etiketterne står inden for grafen (sidste punkts tal til
// venstre for punktet, første punkts til højre) og er store nok til at læse
// i 390 px; før stod de uden for højre kant med 7–8 px og blev skåret af.
function FremgangGraf({ punkter }) {
  if (punkter.length < 2) return null
  const W = 400, H = 190, PL = 10, PR = 10, PT = 34, PB = 26
  const vals = punkter.map(p => p.e1rm)
  const minV = Math.min(...vals), maxV = Math.max(...vals)
  const range = (maxV - minV) || 1
  const x = i => PL + (i / (punkter.length - 1)) * (W - PL - PR)
  const y = v => PT + (1 - (v - minV) / range) * (H - PT - PB)
  const pts = punkter.map((p, i) => `${x(i).toFixed(1)},${y(p.e1rm).toFixed(1)}`).join(' ')
  const forste = punkter[0]
  const sidste = punkter[punkter.length - 1]
  // Etiketten står over punktet, når der er plads, ellers under — altid
  // inden for [0, H - PB].
  // Første punkts tal står højere over punktet, så en stigende linje ikke
  // løber gennem teksten.
  const etiketY = (v, over) => (y(v) - over >= 16 ? y(v) - over : y(v) + 22)
  const ly = etiketY(sidste.e1rm, 12)
  const fy = etiketY(forste.e1rm, 26)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <line x1={PL} y1={H - PB} x2={W - PR} y2={H - PB} stroke="rgba(237,234,226,0.08)" strokeWidth="1" />
      <polyline points={pts} fill="none" stroke="#c8923a" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {punkter.map((p, i) => (
        <circle key={p.uge} cx={x(i)} cy={y(p.e1rm)} r={i === punkter.length - 1 ? 4.5 : 2.5}
          fill={i === punkter.length - 1 ? '#edeae2' : '#c8923a'} />
      ))}
      <text x={x(0)} y={fy} textAnchor="start" fontSize="14" fill="#7a7770" fontFamily={mono}>
        {forste.e1rm} kg
      </text>
      <text x={x(punkter.length - 1)} y={ly} textAnchor="end" fill="#edeae2" fontFamily={mono}>
        <tspan fontSize="15">{sidste.e1rm} kg</tspan>
        <tspan fontSize="12" fill="#7a7770"> {sidste.weight}×{sidste.reps}</tspan>
      </text>
      <text x={PL} y={H - 6} textAnchor="start" fontSize="13" fill="#7a7770" fontFamily={mono}>uge {ugeNr(forste.uge)}</text>
      <text x={W - PR} y={H - 6} textAnchor="end" fontSize="13" fill="#7a7770" fontFamily={mono}>uge {ugeNr(sidste.uge)}</text>
    </svg>
  )
}

export default function FremgangTab({ fremgangLogs, fremgangLoading, allWeeks }) {
  const alleNavne = useMemo(() => navneFraProgram(allWeeks), [allWeeks])
  const navneMedLogs = useMemo(() => navneFraLogs(fremgangLogs), [fremgangLogs])
  const grupper = useMemo(() => grupperOevelsesnavne(alleNavne), [alleNavne])
  const andreSorteret = useMemo(() => [...grupper.andre].sort((a, b) => a.localeCompare(b, 'da')), [grupper.andre])

  // Standardvalget skal helst vise en RIGTIG kurve med det samme — foretræk
  // derfor en øvelse med logs (start med hovedløftene, samme rækkefølge som
  // knapperne), og falder kun tilbage til en ulogget øvelse hvis intet er
  // logget endnu overhovedet.
  const foersteValg = useMemo(() => {
    for (const familie of HOVEDLOEFT_FAMILIER) {
      const navneIFamilie = grupper[familie.key]
      if (navneIFamilie.length === 0) continue
      const medLogs = navneIFamilie.find(n => navneMedLogs.has(n))
      if (medLogs) return medLogs
    }
    const andenMedLogs = andreSorteret.find(n => navneMedLogs.has(n))
    if (andenMedLogs) return andenMedLogs
    for (const familie of HOVEDLOEFT_FAMILIER) {
      const navn = hovednavnForFamilie(familie, grupper[familie.key])
      if (navn) return navn
    }
    return andreSorteret[0] || null
  }, [grupper, andreSorteret, navneMedLogs])

  const [valgtOevelse, setValgtOevelse] = useState(foersteValg)
  // Første valg afhænger af data der ankommer asynkront (fremgangLogs hentes
  // først når fanen åbnes) — sæt det, når det skifter fra "intet" til "noget",
  // uden at overskrive et bevidst valg atleten allerede har foretaget.
  const oevelse = valgtOevelse && alleNavne.includes(valgtOevelse) ? valgtOevelse : foersteValg

  const punkter = useMemo(() => {
    if (!oevelse) return []
    const logsForOevelse = (fremgangLogs || []).filter(l => l.exercises?.name === oevelse)
    return heaviestSetPerWeek(logsForOevelse)
  }, [fremgangLogs, oevelse])

  return (
    <>
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ fontFamily: mono, fontSize: '0.56rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#4a4844', marginBottom: '0.5rem' }}>Fremgang</div>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.8rem', fontWeight: 400, color: '#edeae2', lineHeight: 1.1 }}>Bliver du stærkere?</h1>
      </div>

      <div style={s.card}>
        {fremgangLoading ? (
          <div style={{ fontSize: '0.8rem', color: '#4a4844', fontStyle: 'italic' }}>Henter…</div>
        ) : alleNavne.length === 0 ? (
          <div style={{ fontSize: '0.8rem', color: '#4a4844', fontStyle: 'italic' }}>Ingen logninger endnu.</div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.85rem', flexWrap: 'wrap' }}>
              {HOVEDLOEFT_FAMILIER.map(familie => {
                const navnEnFamilie = grupper[familie.key]
                if (navnEnFamilie.length === 0) return null
                const hovednavn = hovednavnForFamilie(familie, navnEnFamilie)
                const aktiv = navnEnFamilie.includes(oevelse)
                return (
                  <button key={familie.key} onClick={() => setValgtOevelse(hovednavn)} style={aktiv ? s.btnPrimary : s.btnGhost}>
                    {familie.label}
                  </button>
                )
              })}
            </div>

            {HOVEDLOEFT_FAMILIER.map(familie => {
              const navneIFamilie = grupper[familie.key]
              if (navneIFamilie.length < 2 || !navneIFamilie.includes(oevelse)) return null
              return (
                <div key={familie.key} style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.85rem', flexWrap: 'wrap' }}>
                  {navneIFamilie.map(navn => (
                    <button key={navn} onClick={() => setValgtOevelse(navn)}
                      style={{
                        ...s.btnGhost, padding: '0.3rem 0.6rem', fontSize: '0.54rem',
                        color: navn === oevelse ? '#c8923a' : '#7a7770',
                        borderColor: navn === oevelse ? 'rgba(200,146,58,0.45)' : 'rgba(237,234,226,0.13)',
                      }}
                    >{navn}</button>
                  ))}
                </div>
              )
            })}

            {andreSorteret.length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                <div style={s.fieldLabel}>Andre øvelser</div>
                <select value={andreSorteret.includes(oevelse) ? oevelse : ''} onChange={e => e.target.value && setValgtOevelse(e.target.value)} style={s.fieldInput}>
                  <option value="" disabled>Vælg øvelse…</option>
                  {andreSorteret.map(navn => <option key={navn} value={navn}>{navn}</option>)}
                </select>
              </div>
            )}

            <div style={{ borderTop: '1px solid rgba(237,234,226,0.07)', paddingTop: '1rem' }}>
              <div style={{ fontSize: '0.72rem', color: '#c8b98a', marginBottom: '0.6rem' }}>{oevelse}</div>
              {punkter.length === 0 ? (
                <div style={{ fontSize: '0.8rem', color: '#4a4844', fontStyle: 'italic' }}>Ingen logninger endnu.</div>
              ) : punkter.length === 1 ? (
                <div style={{ fontSize: '0.8rem', color: '#7a7770' }}>
                  {punkter[0].weight} kg × {punkter[0].reps} (e1RM {punkter[0].e1rm} kg) — for få uger endnu til en kurve.
                </div>
              ) : (
                <>
                  <div data-fremgang-linje style={{ fontSize: '0.95rem', color: '#edeae2', marginBottom: '0.7rem', lineHeight: 1.35 }}>
                    {fremgangLinje(oevelse, punkter)}
                  </div>
                  <FremgangGraf punkter={punkter} />
                  <div style={{ fontSize: '0.56rem', color: '#4a4844', marginTop: '0.85rem', lineHeight: 1.5 }}>
                    Tungeste gennemførte sæt pr. uge, og det beregnede énrepetitionsmaksimum (Epley).
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </>
  )
}
