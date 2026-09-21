// Fremgang-fanen (ordre 284, blok 1) — "er squatten rent faktisk blevet
// stærkere siden marts", for ÉN øvelse ad gangen: tungeste sæt pr. uge og
// det beregnede énrepetitionsmaksimum. Al regnelogik bor i
// ../exerciseProgress.js — denne fil er kun visning + hvilken øvelse der er
// valgt, samme arbejdsdeling som VolumenTab.jsx (regning i
// src/volume/beregn.js).
//
// Data ejes af AthleteView.jsx (fremgangLogs/fremgangLoading, al historik,
// hentet når fanen åbnes — se dens fetchFremgangLogs), samme mønster som de
// øvrige lazy-loadede faner.
import { useMemo, useState } from 'react'
import { heaviestSetPerWeek } from '../exerciseProgress.js'
import { s } from '../athleteShared'

const mono = "'IBM Plex Mono', monospace"

function navneFraLogs(logs) {
  const set = new Set()
  for (const log of logs || []) {
    const navn = log.exercises?.name
    if (navn) set.add(navn)
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'da'))
}

// Linjegraf over ugentligt bedste e1RM — samme visuelle sprog som
// AthleteView.jsx's E1RMChart/ReadinessSparkline (én linje, ingen akser med
// tal ud over start/slut), men for ÉN øvelse og med vægt×reps synlig pr.
// punkt (ordrens "tungeste sæt pr. uge", ikke kun det udregnede tal).
function FremgangGraf({ punkter }) {
  if (punkter.length < 2) return null
  const W = 400, H = 170, PL = 8, PR = 46, PT = 14, PB = 20
  const vals = punkter.map(p => p.e1rm)
  const minV = Math.min(...vals), maxV = Math.max(...vals)
  const range = (maxV - minV) || 1
  const x = i => PL + (i / (punkter.length - 1)) * (W - PL - PR)
  const y = v => PT + (1 - (v - minV) / range) * (H - PT - PB)
  const pts = punkter.map((p, i) => `${x(i).toFixed(1)},${y(p.e1rm).toFixed(1)}`).join(' ')
  const sidste = punkter[punkter.length - 1]
  const forsteUge = punkter[0].uge.slice(5)
  const sidsteUge = sidste.uge.slice(5)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <line x1={PL} y1={H - PB} x2={W - PR} y2={H - PB} stroke="rgba(237,234,226,0.08)" strokeWidth="1" />
      <polyline points={pts} fill="none" stroke="#c8923a" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
      {punkter.map((p, i) => (
        <circle key={p.uge} cx={x(i)} cy={y(p.e1rm)} r={i === punkter.length - 1 ? 3.5 : 2}
          fill={i === punkter.length - 1 ? '#edeae2' : '#c8923a'} />
      ))}
      <text x={x(punkter.length - 1) + 6} y={y(sidste.e1rm) - 5} fontSize="8" fill="#edeae2" fontFamily={mono}>
        {sidste.e1rm} kg e1RM
      </text>
      <text x={x(punkter.length - 1) + 6} y={y(sidste.e1rm) + 8} fontSize="7" fill="#7a7770" fontFamily={mono}>
        {sidste.weight}×{sidste.reps}
      </text>
      <text x={PL} y={H - 4} textAnchor="start" fontSize="7" fill="#4a4844" fontFamily={mono}>{forsteUge}</text>
      <text x={x(punkter.length - 1)} y={H - 4} textAnchor="end" fontSize="7" fill="#4a4844" fontFamily={mono}>{sidsteUge}</text>
    </svg>
  )
}

export default function FremgangTab({ fremgangLogs, fremgangLoading }) {
  const alleNavne = useMemo(() => navneFraLogs(fremgangLogs), [fremgangLogs])
  const [valgtOevelse, setValgtOevelse] = useState(null)
  const oevelse = valgtOevelse && alleNavne.includes(valgtOevelse) ? valgtOevelse : alleNavne[0] || null

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
            <div style={{ marginBottom: '1rem' }}>
              <div style={s.fieldLabel}>Øvelse</div>
              <select value={oevelse || ''} onChange={e => setValgtOevelse(e.target.value)} style={s.fieldInput}>
                {alleNavne.map(navn => <option key={navn} value={navn}>{navn}</option>)}
              </select>
            </div>

            <div style={{ borderTop: '1px solid rgba(237,234,226,0.07)', paddingTop: '1rem' }}>
              {punkter.length === 0 ? (
                <div style={{ fontSize: '0.8rem', color: '#4a4844', fontStyle: 'italic' }}>Ingen logninger endnu.</div>
              ) : punkter.length === 1 ? (
                <div style={{ fontSize: '0.8rem', color: '#7a7770' }}>
                  {punkter[0].weight} kg × {punkter[0].reps} (e1RM {punkter[0].e1rm} kg) — for få uger endnu til en kurve.
                </div>
              ) : (
                <>
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
