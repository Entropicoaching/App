import { exerciseSetView } from '../exerciseSetView'
// Fremgang-fanen (ordre 284) — "er squatten rent faktisk blevet stærkere
// siden marts", for ÉN øvelse ad gangen: bedste e1RM-sæt pr. uge og det
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
import { bestHeavySetPerDay, erTungtSaet, grupperOevelsesnavne, hovedloeftFamilie, HOVEDLOEFT_FAMILIER } from '../exerciseProgress.js'
import { s } from '../athleteShared'
import { rekordListe, tidligereSaet, ugensSaet, grupperRekorder } from './rekorder'

const mono = "'IBM Plex Mono', monospace"

function navneFraProgram(allWeeks) {
  const set = new Set()
  for (const week of allWeeks || []) {
    for (const session of week.sessions || []) {
      for (const exercise of session.exercises || []) {
        if (exercise.name) set.add(exerciseSetView(exercise.name).name)
      }
    }
  }
  return [...set]
}

function navneFraLogs(logs) {
  const set = new Set()
  for (const log of logs || []) {
    const navn = log.exercises?.name
    if (navn) set.add(exerciseSetView(navn).name)
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
// i grafens hjørne. Ordre 1421: datoen er første tunge træningsdag i kurven.

function fremgangLinje(navn, punkter) {
  if (punkter.length < 2) return null
  const forste = punkter[0], sidste = punkter[punkter.length - 1]
  const diff = sidste.e1rm - forste.e1rm
  const aendring = diff > 0 ? `+${diff} kg` : diff < 0 ? `−${-diff} kg` : 'uændret'
  return `${navn} e1RM ${sidste.e1rm} kg, ${aendring} siden ${kortDato(forste.dag)}`
}

// Linjegraf over ugentligt bedste e1RM — samme visuelle sprog som
// AthleteView.jsx's E1RMChart/ReadinessSparkline (én linje, ingen akser med
// tal ud over start/slut), men for ÉN øvelse og med vægt×reps synlig pr.
// punkt (ordrens "bedste e1RM-sæt pr. uge", ikke kun det udregnede tal).
// Ordre 422: etiketterne står inden for grafen (sidste punkts tal til
// venstre for punktet, første punkts til højre) og er store nok til at læse
// i 390 px; før stod de uden for højre kant med 7–8 px og blev skåret af.
function FremgangGraf({ punkter, valgt, onVaelg }) {
  if (punkter.length < 2) return null
  const W = 400, H = 190, PL = 10, PR = 10, PT = 34, PB = 26
  const vals = punkter.map(p => p.e1rm)
  const minV = Math.min(...vals), maxV = Math.max(...vals)
  const range = (maxV - minV) || 1
  const dagNr = p => Date.parse(`${p.dag}T12:00:00Z`) / 86400000
  const d0 = dagNr(punkter[0]), dSpan = (dagNr(punkter[punkter.length - 1]) - d0) || 1
  const x = i => PL + ((dagNr(punkter[i]) - d0) / dSpan) * (W - PL - PR)
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
        <g key={p.dag} data-punkt={p.dag} data-e1rm={p.e1rm} onClick={() => onVaelg(i)} style={{ cursor: 'pointer' }}>
          <circle cx={x(i)} cy={y(p.e1rm)} r="16" fill="transparent" />
          <circle cx={x(i)} cy={y(p.e1rm)} r={i === valgt ? 5.5 : 2.5}
            fill={i === valgt ? '#edeae2' : '#c8923a'} stroke={i === valgt ? '#c8923a' : 'none'} strokeWidth="2" />
        </g>
      ))}
      <text x={x(0)} y={fy} textAnchor="start" fontSize="14" fill="#a8a498" fontFamily={mono}>
        {forste.e1rm} kg
      </text>
      <text x={x(punkter.length - 1)} y={ly} textAnchor="end" fill="#edeae2" fontFamily={mono}>
        <tspan fontSize="15">{sidste.e1rm} kg</tspan>
        <tspan fontSize="14" fill="#a8a498"> {sidste.weight}×{sidste.reps}</tspan>
      </text>
      <text x={PL} y={H - 6} textAnchor="start" fontSize="13" fill="#a8a498" fontFamily={mono}>{kortDato(forste.dag)}</text>
      <text x={W - PR} y={H - 6} textAnchor="end" fontSize="13" fill="#a8a498" fontFamily={mono}>{kortDato(sidste.dag)}</text>
    </svg>
  )
}

// ORDRE 439 · blok 1: "12. sep".
const MDR = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
function kortDato(iso) {
  const d = new Date(/^\d{4}-\d\d-\d\d$/.test(iso) ? `${iso}T12:00:00` : iso)
  return Number.isNaN(d.getTime()) ? '' : `${d.getDate()}. ${MDR[d.getMonth()]}`
}
const kgTal = (n) => String(n).replace('.', ',')
// Sættypen er en egenskab ved sættet, ikke et nyt øvelsesnavn: "topsæt", "backoff" eller bare "sæt".
const saetTypeOrd = (raaNavn) => { const l = exerciseSetView(raaNavn).label; return l === 'Top' ? 'topsæt' : l === 'Backoff' ? 'backoff' : 'sæt' }

// Rekorderne (nyeste først) med dato. Samme regel som fejringen i Dagens pas
// (rekorder.js); ugens sæt tages fra exerciseLogs, så et sæt logget uden net
// står her med det samme og kun én gang, også når det senere er sendt.
function RekordRaekker({ rekorder, attr }) {
  return (
    <div {...{ [attr]: rekorder.length }} style={{ display: 'flex', flexDirection: 'column' }}>
      {rekorder.map((r, i) => (
        <div key={`${r.navn}-${r.dato}-${i}`} data-rekord={r.type} style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', padding: '0.5rem 0', borderBottom: i < rekorder.length - 1 ? '1px solid rgba(237,234,226,0.05)' : 'none' }}>
          <span style={{ fontFamily: mono, fontSize: '0.66rem', color: '#a8a498', width: '3.6rem', flexShrink: 0 }}>{kortDato(r.dato)}</span>
          <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
            <span style={{ display: 'block', fontSize: '0.88rem', color: '#edeae2' }}>
              {r.type === 'e1rm' ? `${r.navn} e1RM ${r.e1rm} kg` : `${r.navn} ${kgTal(r.weight)} kg × ${r.reps}`}
            </span>
            <span style={{ display: 'block', fontFamily: mono, fontSize: '0.66rem', color: '#a8a498', marginTop: '0.1rem' }}>
              {r.type === 'e1rm'
                ? `+${r.plus} kg · ${kgTal(r.weight)} kg × ${r.reps}`
                : `${r.plus === 1 ? '1 rep' : `${r.plus} reps`} mere end før på ${kgTal(r.weight)} kg`}
            </span>
          </span>
        </div>
      ))}
    </div>
  )
}

// Ordre 1475: en række pr. hovedløft (squat, bænkpres, dødløft, sumo) med bedste værdi og dato;
// løftets tidligere rekorder ligger bag et tryk. Varianter og assistance nederst (Marcs dom 6. okt).
function HovedRaekke({ h, sidst }) {
  const [aaben, setAaben] = useState(false)
  const r = h.bedst
  const flere = h.historik.length > 1
  return (
    <div data-rekord-hoved={h.key} style={{ padding: '0.5rem 0', borderBottom: sidst ? 'none' : '1px solid rgba(237,234,226,0.05)' }}>
      <div data-rekord={r.type} style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem' }}>
        <span style={{ fontFamily: mono, fontSize: '0.66rem', color: '#a8a498', width: '3.6rem', flexShrink: 0 }}>{kortDato(r.dato)}</span>
        <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
          <span style={{ display: 'block', fontSize: '0.88rem', color: '#edeae2' }}>
            {r.type === 'e1rm' ? `${h.navn} e1RM ${r.e1rm} kg` : `${h.navn} ${kgTal(r.weight)} kg × ${r.reps}`}
          </span>
          <span style={{ display: 'block', fontFamily: mono, fontSize: '0.66rem', color: '#a8a498', marginTop: '0.1rem' }}>
            {r.type === 'e1rm' ? `nået første gang med ${kgTal(r.weight)} kg × ${r.reps}` : `${r.plus === 1 ? '1 rep' : `${r.plus} reps`} mere end før på ${kgTal(r.weight)} kg`}
          </span>
        </span>
        {flere && (
          <button type="button" data-rekord-historik-knap={h.key} aria-expanded={aaben} onClick={() => setAaben(v => !v)}
            style={{ background: 'none', border: '1px solid rgba(237,234,226,0.15)', color: '#a8a59c', fontFamily: mono, fontSize: '0.66rem', padding: '0.3rem 0.5rem', cursor: 'pointer', minHeight: 32 }}>
            {aaben ? 'Skjul' : `Historik (${h.historik.length})`}
          </button>
        )}
      </div>
      {flere && aaben && (
        <div style={{ marginTop: '0.4rem', paddingLeft: '0.5rem', borderLeft: '1px solid rgba(237,234,226,0.1)' }}>
          <RekordRaekker rekorder={h.historik} attr="data-rekord-historik" />
        </div>
      )}
    </div>
  )
}

function RekordListe({ rekorder }) {
  if (rekorder.length === 0) {
    return <div style={{ fontSize: '0.8rem', color: '#a8a498', fontStyle: 'italic' }}>Ingen rekorder endnu. Slår du dit bedste sæt på en øvelse, står det her.</div>
  }
  const { hoved, andre } = grupperRekorder(rekorder)
  return (
    <>
      {hoved.length > 0
        ? <div data-rekord-liste={hoved.length} style={{ display: 'flex', flexDirection: 'column' }}>{hoved.map((h, i) => <HovedRaekke key={h.key} h={h} sidst={i === hoved.length - 1} />)}</div>
        : <div style={{ fontSize: '0.8rem', color: '#a8a498', fontStyle: 'italic' }}>Ingen rekorder på de fire hovedløft endnu.</div>}
      {andre.length > 0 && (
        <div data-rekord-varianter style={{ marginTop: '1rem' }}>
          <div style={{ fontFamily: mono, fontSize: '0.66rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#a8a498', marginBottom: '0.25rem' }}>Varianter og assistance</div>
          <RekordRaekker rekorder={andre} attr="data-rekord-varianter-liste" />
        </div>
      )}
    </>
  )
}

export default function FremgangTab({ fremgangLogs, fremgangLoading, allWeeks, exerciseLogs, currentWeek }) {
  const alleNavne = useMemo(() => [...new Map([...navneFraProgram(allWeeks), ...navneFraLogs(fremgangLogs)].map(n => [exerciseSetView(n).key, n])).values()], [allWeeks, fremgangLogs])
  const navneMedLogs = useMemo(() => navneFraLogs(fremgangLogs), [fremgangLogs])
  const grupper = useMemo(() => grupperOevelsesnavne(alleNavne), [alleNavne])
  const andreSorteret = useMemo(() => [...grupper.andre].sort((a, b) => a.localeCompare(b, 'da')), [grupper.andre])

  // Standardvalget skal helst vise en RIGTIG kurve med det samme — foretræk
  // derfor en øvelse med logs (start med hovedløftene, samme rækkefølge som
  // knapperne), og falder kun tilbage til en ulogget øvelse hvis intet er
  // logget endnu overhovedet.
  const foersteValg = useMemo(() => {
    // Ordre 1475: fanen aabner paa det hovedloeft atleten loggede senest (efter en baenkdag staar baenkkurven,
    // ikke squat), hvis det har logs; ellers som foer.
    const senest = (fremgangLogs || []).reduce((b, l) => (l.exercises?.name && (!b || String(l.logged_at) > String(b.logged_at)) ? l : b), null)
    if (senest && hovedloeftFamilie(senest.exercises.name)) {
      const k = exerciseSetView(senest.exercises.name).key
      const navn = alleNavne.find(n => exerciseSetView(n).key === k)
      if (navn) return navn
    }
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
  }, [grupper, andreSorteret, navneMedLogs, fremgangLogs, alleNavne])

  const [valgtOevelse, setValgtOevelse] = useState(foersteValg)
  // Første valg afhænger af data der ankommer asynkront (fremgangLogs hentes
  // først når fanen åbnes) — sæt det, når det skifter fra "intet" til "noget",
  // uden at overskrive et bevidst valg atleten allerede har foretaget.
  const oevelse = valgtOevelse && alleNavne.includes(valgtOevelse) ? valgtOevelse : foersteValg

  const punkter = useMemo(() => {
    if (!oevelse) return []
    const logsForOevelse = (fremgangLogs || []).filter(l => exerciseSetView(l.exercises?.name).key === exerciseSetView(oevelse).key)
    return bestHeavySetPerDay(logsForOevelse)
  }, [fremgangLogs, oevelse])

  // Ordre 1451: tryk på et punkt viser hvilket sæt det er (standard: det nyeste).
  const [valgtPunkt, setValgtPunkt] = useState(null)
  const valgtIdx = valgtPunkt && valgtPunkt.oevelse === oevelse && valgtPunkt.idx < punkter.length ? valgtPunkt.idx : punkter.length - 1
  const valgtSaet = punkter[valgtIdx]

  const harLogs = useMemo(() => !!oevelse && (fremgangLogs || []).some(l => exerciseSetView(l.exercises?.name).key === exerciseSetView(oevelse).key), [fremgangLogs, oevelse])

  const rekorder = useMemo(() => {
    if (!fremgangLogs) return null
    // Ordre 1421: rekorder bygges som kurven kun af tunge saet (raa navn tjekkes foer det foldes).
    return rekordListe([...tidligereSaet(fremgangLogs, currentWeek), ...ugensSaet(exerciseLogs, currentWeek, allWeeks)]
      .filter(s => erTungtSaet(s.navn, s.reps ?? s.reps_completed))
      .map(s => ({ ...s, navn: exerciseSetView(s.navn).name }))).reverse()
  }, [fremgangLogs, exerciseLogs, currentWeek, allWeeks])

  return (
    <>
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ fontFamily: mono, fontSize: '0.66rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#a8a498', marginBottom: '0.5rem' }}>Fremgang</div>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.8rem', fontWeight: 400, color: '#edeae2', lineHeight: 1.1 }}>Bliver du stærkere?</h1>
      </div>

      <div style={s.card}>
        {fremgangLoading ? (
          <div style={{ fontSize: '0.8rem', color: '#a8a498', fontStyle: 'italic' }}>Henter…</div>
        ) : alleNavne.length === 0 ? (
          <div style={{ fontSize: '0.8rem', color: '#a8a498', fontStyle: 'italic' }}>Ingen logninger endnu.</div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.85rem', flexWrap: 'wrap' }}>
              {HOVEDLOEFT_FAMILIER.map(familie => {
                const navnEnFamilie = grupper[familie.key]
                if (navnEnFamilie.length === 0) return null
                const hovednavn = hovednavnForFamilie(familie, navnEnFamilie)
                const aktiv = navnEnFamilie.includes(oevelse)
                return (
                  <button key={familie.key} onClick={() => setValgtOevelse(hovednavn)} style={{ ...(aktiv ? s.btnPrimary : { ...s.btnGhost, color: '#c4c0b4' }), fontSize: '0.68rem', minHeight: '44px' }}>
                    {familie.label}
                  </button>
                )
              })}
            </div>

            {andreSorteret.length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ ...s.fieldLabel, color: '#a8a498', fontSize: '0.66rem' }}>Andre øvelser</div>
                <select value={andreSorteret.includes(oevelse) ? oevelse : ''} onChange={e => e.target.value && setValgtOevelse(e.target.value)} style={s.fieldInput}>
                  <option value="" disabled>Vælg øvelse…</option>
                  {andreSorteret.map(navn => <option key={navn} value={navn}>{navn}</option>)}
                </select>
              </div>
            )}

            <div style={{ borderTop: '1px solid rgba(237,234,226,0.07)', paddingTop: '1rem' }}>
              <div style={{ fontSize: '0.72rem', color: '#c8b98a', marginBottom: '0.6rem' }}>{oevelse}</div>
              {punkter.length === 0 ? (
                <div style={{ fontSize: '0.8rem', color: '#a8a498', fontStyle: 'italic' }}>{harLogs ? 'Kun lette sæt logget endnu (backoff, teknik eller volumen), så der er intet tungt sæt at tegne en kurve af.' : 'Ingen logninger endnu.'}</div>
              ) : punkter.length === 1 ? (
                <div style={{ fontSize: '0.8rem', color: '#a8a498' }}>
                  {punkter[0].weight} kg × {punkter[0].reps} (e1RM {punkter[0].e1rm} kg) — for få tunge dage endnu til en kurve.
                </div>
              ) : (
                <>
                  <div data-fremgang-linje style={{ fontSize: '0.95rem', color: '#edeae2', marginBottom: '0.7rem', lineHeight: 1.35 }}>
                    {fremgangLinje(oevelse, punkter)}
                  </div>
                  <FremgangGraf punkter={punkter} valgt={valgtIdx} onVaelg={idx => setValgtPunkt({ oevelse, idx })} />
                  {valgtSaet && (
                    <div data-punkt-forklaring style={{ fontFamily: mono, fontSize: '0.7rem', color: '#c8b98a', marginTop: '0.5rem', lineHeight: 1.5 }}>
                      {kortDato(valgtSaet.dag)}: {kgTal(valgtSaet.weight)} kg × {valgtSaet.reps} ({saetTypeOrd(valgtSaet.navn)}) giver e1RM {valgtSaet.e1rm} kg. Tryk på et punkt for at se dets sæt.
                    </div>
                  )}
                  <div style={{ fontSize: '0.66rem', color: '#a8a498', marginTop: '0.85rem', lineHeight: 1.5 }}>
                    Ét punkt pr. træningsdag: dagens højeste e1RM (Epley: vægt × (1 + reps/30)), kun fra tunge sæt på højst 8 reps. Backoff, teknik-singler og volumensæt tæller ikke med, så lette sæt aldrig trækker kurven ned.
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {rekorder && (
        <div style={s.card}>
          <div style={{ ...s.cardLabel, fontSize: '0.66rem' }}>Dine rekorder</div>
          <RekordListe rekorder={rekorder} />
          <div style={{ fontSize: '0.66rem', color: '#a8a498', marginTop: '0.85rem', lineHeight: 1.5 }}>
            Rekorder tæller kun tunge sæt (højst 8 reps, ikke backoff, teknik eller volumen).
          </div>
        </div>
      )}
    </>
  )
}
