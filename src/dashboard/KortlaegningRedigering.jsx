// ORDRE 185 (14. sep), commit 3: "en lille redigeringsvej for kortlægningen"
// (ordrens egen ordlyd) — Marc kan rette, tilføje eller fjerne en øvelses
// muskelgrupper uden at åbne kildekoden. Gemmes via src/volume/rettelser.js
// (localStorage — se dens egen kommentar for hvorfor og hvad grænsen er).
//
// To lister at vælge fra: "ukendte" (øvelser der i dag falder til "Ukendt
// øvelse" i kortet — se VolumenKort.jsx's ukendteOevelseNavne-udregning) og
// "kendte" (alt muskelkort.js allerede kortlægger, plus Marcs egne
// rettelser). Et frit navnefelt findes også, for øvelser der endnu ikke er
// dukket op i nogen logget/planlagt uge.
//
// ORDRE 209 (15. sep), commit 3: gem/fjern går nu gennem rettelser.js's
// async, bagende-agnostiske API (Supabase hvis tabellen findes, ellers
// stadig localStorage) — se rettelser.js's egen kommentar. `lagerType`
// (fra VolumenKort.jsx, som allerede har slået det op til hentRettelser)
// viser coachen hvor rettelsen rent faktisk lander, med samme ordlyd som
// docs/VOLUMEN.md.

import { useState } from 'react'
import { MUSKELGRUPPER, PRIMÆR, MEDVIRKENDE, kendteOevelser, slaaOevelseOp, normaliserOevelsesnavn } from '../volume/muskelkort.js'
import { gemRettelse, fjernRettelse } from '../volume/rettelser.js'
import { supabase } from '../supabase'
import { s } from '../dashboardShared'

const ANDEL_MULIGHEDER = [
  { value: PRIMÆR, label: 'Primær (1,0)' },
  { value: MEDVIRKENDE, label: 'Medvirkende (0,5)' },
]

function tomRaekke() {
  return { gruppe: Object.keys(MUSKELGRUPPER)[0], andel: PRIMÆR }
}

function raekkerFraOpslag(grupper) {
  return grupper.length ? grupper.map(g => ({ gruppe: g.gruppe, andel: g.andel })) : [tomRaekke()]
}

export default function KortlaegningRedigering({ rettelser, ukendteOevelseNavne, onRettelserAendret, lagerType, coachId }) {
  const [aaben, setAaben] = useState(false)
  const [valgtNavn, setValgtNavn] = useState('')
  const [nytNavn, setNytNavn] = useState('')
  const [raekker, setRaekker] = useState([])
  const [fejl, setFejl] = useState(null)
  const [gemmer, setGemmer] = useState(false)

  const kendteNavne = kendteOevelser()
  const rettedeNavne = [...rettelser.values()].map(r => r.oevelseNavn)
  const alleKendteVisning = [...new Set([...kendteNavne, ...rettedeNavne])].sort((a, b) => a.localeCompare(b, 'da'))
  const ukendteVisning = [...new Set(ukendteOevelseNavne || [])].sort((a, b) => a.localeCompare(b, 'da'))

  function vaelgNavn(navn) {
    if (!navn) return
    setFejl(null)
    setValgtNavn(navn)
    setNytNavn('')
    setRaekker(raekkerFraOpslag(slaaOevelseOp(navn, rettelser).grupper))
  }

  function luk() {
    setAaben(false)
    setValgtNavn('')
    setNytNavn('')
    setFejl(null)
  }

  function opdaterRaekke(i, felt, vaerdi) {
    setRaekker(prev => prev.map((r, j) => (j === i ? { ...r, [felt]: vaerdi } : r)))
  }

  function fjernRaekke(i) {
    setRaekker(prev => prev.filter((_, j) => j !== i))
  }

  async function gem() {
    setGemmer(true)
    const ok = await gemRettelse({ oevelseNavn: valgtNavn, grupper: raekker }, { client: supabase, coachId })
    setGemmer(false)
    if (!ok) { setFejl('Kunne ikke gemme — mindst én gruppe skal være valgt.'); return }
    onRettelserAendret?.()
    luk()
  }

  async function fjern() {
    setGemmer(true)
    await fjernRettelse(valgtNavn, { client: supabase, coachId })
    setGemmer(false)
    onRettelserAendret?.()
    luk()
  }

  const harRettelseForValgt = valgtNavn ? rettelser.has(normaliserOevelsesnavn(valgtNavn)) : false
  const oprindeligtSkoen = valgtNavn ? slaaOevelseOp(valgtNavn) : null // uden rettelser — modellens eget skøn

  if (!aaben) {
    return <button style={s.btnGhost} onClick={() => setAaben(true)}>Ret kortlægning</button>
  }

  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && luk()}>
      <div style={{ ...s.modal, maxWidth: '520px', maxHeight: '88vh', overflowY: 'auto' }}>
        <div style={s.modalTitle}>Ret kortlægning</div>
        <div style={{ fontSize: '0.6rem', color: '#7a7770', marginBottom: '1.1rem', lineHeight: 1.5 }}>
          {lagerType === 'supabase'
            ? 'Gemmes på din konto — synkroniseret på alle dine enheder.'
            : 'Gemmes på denne enhed — ikke synkroniseret til dine andre enheder.'}
        </div>

        {!valgtNavn ? (
          <>
            {ukendteVisning.length > 0 && (
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={s.fieldLabel}>Ukendte øvelser — klik for at kortlægge</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {ukendteVisning.map(navn => (
                    <button key={navn} style={s.btnSm} onClick={() => vaelgNavn(navn)}>{navn}</button>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginBottom: '1rem' }}>
              <div style={s.fieldLabel}>Kendt øvelse</div>
              <select style={s.fieldSelect} value="" onChange={e => vaelgNavn(e.target.value)}>
                <option value="" disabled>Vælg en øvelse…</option>
                {alleKendteVisning.map(navn => <option key={navn} value={navn}>{navn}</option>)}
              </select>
            </div>

            <div>
              <div style={s.fieldLabel}>Eller skriv et nyt øvelsesnavn</div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input style={s.fieldInput} type="text" value={nytNavn} onChange={e => setNytNavn(e.target.value)}
                  placeholder="f.eks. Zercher squat" />
                <button style={s.btnGhost} disabled={!nytNavn.trim()} onClick={() => vaelgNavn(nytNavn.trim())}>Brug</button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button style={s.btnGhost} onClick={luk}>Luk</button>
            </div>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
              <span style={{ fontSize: '1rem', color: '#edeae2' }}>{valgtNavn}</span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '0.15rem 0.4rem', color: harRettelseForValgt ? '#c8923a' : '#7a7770', border: `1px solid ${harRettelseForValgt ? 'rgba(200,146,58,0.4)' : 'rgba(237,234,226,0.13)'}` }}>
                {harRettelseForValgt ? 'Sat af Marc' : 'Oprindeligt skøn'}
              </span>
            </div>
            {oprindeligtSkoen.kendt && harRettelseForValgt && (
              <div style={{ fontSize: '0.62rem', color: '#4a4844', marginBottom: '1rem' }}>
                Oprindeligt skøn: {oprindeligtSkoen.grupper.map(g => `${MUSKELGRUPPER[g.gruppe]} (${g.andel === PRIMÆR ? 'primær' : 'medvirkende'})`).join(', ')}
              </div>
            )}
            {!oprindeligtSkoen.kendt && (
              <div style={{ fontSize: '0.62rem', color: '#4a4844', marginBottom: '1rem' }}>
                Modellen kendte ikke denne øvelse før nu.
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem' }}>
              {raekker.map((r, i) => (
                <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <select style={{ ...s.fieldSelect, flex: 2 }} value={r.gruppe} onChange={e => opdaterRaekke(i, 'gruppe', e.target.value)}>
                    {Object.entries(MUSKELGRUPPER).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                  </select>
                  <select style={{ ...s.fieldSelect, flex: 1 }} value={r.andel} onChange={e => opdaterRaekke(i, 'andel', Number(e.target.value))}>
                    {ANDEL_MULIGHEDER.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <button style={{ ...s.btnDanger, padding: '0.4rem 0.6rem' }} onClick={() => fjernRaekke(i)} disabled={raekker.length <= 1} aria-label="Fjern gruppe">×</button>
                </div>
              ))}
            </div>
            <button style={s.btnSm} onClick={() => setRaekker(prev => [...prev, tomRaekke()])}>+ Tilføj gruppe</button>

            {fejl && <div style={{ fontSize: '0.72rem', color: '#e05555', marginTop: '0.75rem' }}>{fejl}</div>}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem' }}>
              <div>
                {harRettelseForValgt && <button style={s.btnDanger} onClick={fjern} disabled={gemmer}>Fjern rettelse</button>}
              </div>
              <div style={{ display: 'flex', gap: '0.6rem' }}>
                <button style={s.btnGhost} onClick={() => setValgtNavn('')} disabled={gemmer}>Tilbage</button>
                <button style={s.btnPrimary} onClick={gem} disabled={gemmer}>{gemmer ? 'Gemmer…' : 'Gem'}</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
