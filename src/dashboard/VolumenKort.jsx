// ORDRE 177 (13. sep), commit 3: kortet på coachens atletside der viser
// hvor ugens træningsvolumen lander pr. muskelgruppe — Marcs egen ordlyd:
// "20 sæt quads ugentlig". Lille og tydeligt, ingen graf-bibliotek, ingen ny
// afhængighed (ordrens egen grænse) — en almindelig tabel, samme
// "IBM Plex Mono, mørk baggrund"-stil som resten af Dashboard.jsx (se
// dashboardShared.js's `s`).
//
// ORDRE 185 (14. sep), commit 1: tilføjer "denne uge: gennemført/planlagt"
// øverst i kortet — se DenneUgePlanlagtModGennemfoert nedenfor. Kræver nu
// `weeks` (Dashboard.jsx's fetchWeeks-form) ud over athleteLogs.
// ORDRE 185, commit 2: tilføjer VolumenGraf — søjler for udviklingen over
// otte uger, se src/dashboard/VolumenGraf.jsx for selve tegningen.
// ORDRE 185, commit 3: "Ret kortlægning"-knappen (se KortlaegningRedigering.jsx)
// — Marcs egne rettelser hentes her og gives videre til beregn.js/planlagt.js,
// så tallene på kortet afspejler dem med det samme.
//
// Ren visning: al regning sker i src/volume/beregn.js + src/volume/planlagt.js,
// alt kortlægningsarbejde i src/volume/muskelkort.js. Denne fil oversætter kun
// Dashboard.jsx's egen athleteLogs-form (fetchAthleteLogs' indlejrede
// exercises-relation) til de flade rækker beregn.js forventer.
//
// ORDRE 209 (15. sep), commit 3: hentRettelser er nu async (Supabase-bagende
// hvis tabellen findes, ellers stadig localStorage — se rettelser.js). Kortet
// henter rettelser + lagertype i én useEffect (afhænger af coachId, som
// Dashboard.jsx sender ned fra sin session) i stedet for useState's
// synkrone initializer, og geninlæser begge ved onRettelserAendret.
// ORDRE 210 (15. sep), commit 2: "planlagt mod gennemført, hele forløbet" —
// beregnPlanlagtPrUge (generaliseret fra beregnPlanlagtDenneUge, nu ugerne
// har datoer efter ordre 204) + VolumenGrafForloeb til at tegne det.
import { useEffect, useState } from 'react'
import { beregnVolumenPrUge } from '../volume/beregn.js'
import { beregnPlanlagtDenneUge, beregnPlanlagtPrUge } from '../volume/planlagt.js'
import { MUSKELGRUPPER, slaaOevelseOp } from '../volume/muskelkort.js'
import { hentRettelser, hentLagerType } from '../volume/rettelser.js'
import { supabase } from '../supabase'
import { s } from '../dashboardShared'
import VolumenGraf from './VolumenGraf'
import VolumenGrafForloeb from './VolumenGrafForloeb'
import KortlaegningRedigering from './KortlaegningRedigering'

// Ordrens egen ramme: "fire til seks uger bagud" — seks valgt som den mest
// oplysende ende af det spænd, notér-og-fortsæt (ordren beder om at vælge
// selv, ikke spørge).
const ANTAL_UGER = 6

// Ordrens egen ramme for udviklingsgrafen: "seks til otte uger bagud" —
// otte valgt af samme grund som seks blev valgt ovenfor: den mest
// oplysende ende af spændet.
const GRAF_UGER = 8

function raekkerFraAthleteLogs(athleteLogs) {
  return (athleteLogs || []).map(log => ({
    oevelseNavn: log.exercises?.name,
    loggetDato: log.logged_at,
    skipped: log.skipped,
  }))
}

const cellStyle = {
  padding: '0.3rem 0.6rem', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.62rem',
  color: '#edeae2', whiteSpace: 'nowrap', textAlign: 'right',
}
const labelCellStyle = {
  padding: '0.3rem 0.9rem 0.3rem 0', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.62rem',
  color: '#c8b98a', whiteSpace: 'nowrap',
}
const headCellStyle = { ...cellStyle, color: '#7a7770', fontSize: '0.5rem', letterSpacing: '0.06em', textTransform: 'uppercase' }

/** "2026-W37" -> "U37", til en smal kolonneoverskrift. */
function ugeLabel(ugenoegle) {
  return ugenoegle.replace(/^\d{4}-W/, 'U')
}

// Distinkte øvelsesnavne fra både loggen og programmet, der (med de aktuelle
// rettelser) stadig falder til "ukendt" — fødes ind i KortlaegningRedigering
// som den klikbare "kortlæg denne"-liste.
function ukendteNavneFra(raekker, weeks, rettelser) {
  const navne = new Set()
  for (const r of raekker) if (r.oevelseNavn) navne.add(r.oevelseNavn)
  for (const uge of weeks || []) {
    for (const sess of uge.sessions || []) {
      for (const ex of sess.exercises || []) if (ex.name) navne.add(ex.name)
    }
  }
  return [...navne].filter(navn => !slaaOevelseOp(navn, rettelser).kendt)
}

// Ét tal pr. gruppe fra beregn.js/planlagt.js ("i alt", vægtet) side om side.
// planlagtUge.ugePlaceret===false betyder programugen for "nu" ikke har en
// kalenderdato sat (weeks.start_date) — da er "planlagt" ukendt, ikke 0, så
// den vises som "–", aldrig som et tal der ligner et rigtigt 0.
function DenneUgePlanlagtModGennemfoert({ gennemfoertUge, planlagtUge }) {
  const grupperMedData = Object.keys(MUSKELGRUPPER).filter(g =>
    (gennemfoertUge?.grupper[g]?.ialt || 0) > 0 || (planlagtUge.grupper[g]?.ialt || 0) > 0)
  if (grupperMedData.length === 0 && !planlagtUge.ugePlaceret) return null

  return (
    <div style={{ marginBottom: '1.25rem', paddingBottom: '1.25rem', borderBottom: '1px solid rgba(237,234,226,0.07)' }}>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7a7770', marginBottom: '0.5rem' }}>
        Denne uge: gennemført / planlagt
      </div>
      {grupperMedData.length === 0 ? (
        <div style={{ fontSize: '0.78rem', color: '#4a4844', fontStyle: 'italic' }}>Ingen sæt gennemført eller planlagt denne uge endnu.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          {grupperMedData.map(g => {
            const gennemfoert = gennemfoertUge?.grupper[g]?.ialt || 0
            const planlagtTal = planlagtUge.ugePlaceret ? (planlagtUge.grupper[g]?.ialt || 0) : null
            return (
              <div key={g} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem' }}>
                <span style={{ color: '#c8b98a' }}>{MUSKELGRUPPER[g]}</span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: '#edeae2' }}>
                  {gennemfoert} / {planlagtTal === null ? '–' : planlagtTal}
                </span>
              </div>
            )
          })}
        </div>
      )}
      <div style={{ fontSize: '0.56rem', color: '#4a4844', marginTop: '0.6rem', lineHeight: 1.5 }}>
        {planlagtUge.ugePlaceret
          ? 'Forskellen kan skyldes at sæt endnu ikke er gennemført, at ugen er ændret undervejs, eller at sæt er sprunget over.'
          : 'Denne programuge har ikke en kalenderdato endnu (sat via kalender-tidslinjen) — "planlagt" kan derfor ikke vises.'}
      </div>
    </div>
  )
}

export default function VolumenKort({ athleteLogs, weeks, coachId }) {
  const [rettelser, setRettelser] = useState(new Map())
  const [lagerType, setLagerType] = useState('lokalt')

  async function genindlaesRettelser() {
    const [nyeRettelser, nyLagerType] = await Promise.all([
      hentRettelser({ client: supabase, coachId }),
      hentLagerType({ client: supabase, coachId }),
    ])
    setRettelser(nyeRettelser)
    setLagerType(nyLagerType)
  }

  // IIFE + aktiv-flag i stedet for at kalde genindlaesRettelser direkte: undgår
  // at sætte state efter unmount (fx coachen skifter atlet midt i opslaget).
  useEffect(() => {
    let aktiv = true
    ;(async () => {
      const [nyeRettelser, nyLagerType] = await Promise.all([
        hentRettelser({ client: supabase, coachId }),
        hentLagerType({ client: supabase, coachId }),
      ])
      if (aktiv) { setRettelser(nyeRettelser); setLagerType(nyLagerType) }
    })()
    return () => { aktiv = false }
  }, [coachId])

  const raekker = raekkerFraAthleteLogs(athleteLogs)
  const uger = beregnVolumenPrUge(raekker, { antalUger: ANTAL_UGER, rettelser })
  const ugerGraf = beregnVolumenPrUge(raekker, { antalUger: GRAF_UGER, rettelser })
  const planlagtDenneUge = beregnPlanlagtDenneUge(weeks || [], { rettelser })
  const planlagtForloeb = beregnPlanlagtPrUge(weeks || [], raekker, { rettelser })
  const ukendteOevelseNavne = ukendteNavneFra(raekker, weeks, rettelser)

  // Kun grupper der reelt har haft sæt i vinduet — resten ville kun være
  // rækker af nuller. En gruppe der aldrig optræder her er ikke "0 sæt",
  // den er ikke ramt af noget appen genkender endnu (se docs/VOLUMEN.md).
  const grupperMedData = Object.keys(MUSKELGRUPPER).filter(g => uger.some(u => (u.grupper[g]?.ialt || 0) > 0))
  const grupperMedDataGraf = Object.keys(MUSKELGRUPPER).filter(g => ugerGraf.some(u => (u.grupper[g]?.ialt || 0) > 0))
  const grupperMedDataForloeb = Object.keys(MUSKELGRUPPER).filter(g =>
    planlagtForloeb.uger.some(u => (u.planlagt.grupper[g]?.ialt || 0) > 0 || (u.gennemfoert.grupper[g]?.ialt || 0) > 0))
  const harUkendte = uger.some(u => u.ukendteSaet > 0)

  return (
    <div style={{ ...s.card, marginTop: '1.5rem' }}>
      <div style={s.cardLabel}>
        Volumen pr. muskelgruppe
        <KortlaegningRedigering rettelser={rettelser} ukendteOevelseNavne={ukendteOevelseNavne}
          lagerType={lagerType} coachId={coachId} onRettelserAendret={genindlaesRettelser} />
      </div>
      <div style={{ fontSize: '0.72rem', color: '#7a7770', lineHeight: 1.5, marginBottom: '1rem' }}>
        Sæt er ikke belastning. Tallene tæller gennemførte sæt, vægtet efter hvad øvelsen belaster.
      </div>
      <DenneUgePlanlagtModGennemfoert gennemfoertUge={uger[0]} planlagtUge={planlagtDenneUge} />
      {grupperMedData.length === 0 && !harUkendte ? (
        <div style={{ fontSize: '0.8rem', color: '#4a4844', fontStyle: 'italic' }}>
          Ingen loggede sæt de seneste {ANTAL_UGER} uger endnu.
        </div>
      ) : (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ ...headCellStyle, textAlign: 'left' }}>Muskelgruppe</th>
                  {uger.map(u => <th key={u.uge} style={headCellStyle}>{ugeLabel(u.uge)}</th>)}
                </tr>
              </thead>
              <tbody>
                {grupperMedData.map(g => (
                  <tr key={g}>
                    <td style={labelCellStyle}>{MUSKELGRUPPER[g]}</td>
                    {uger.map(u => {
                      const tal = u.grupper[g] || { direkte: 0, ialt: 0 }
                      return <td key={u.uge} style={cellStyle}>{tal.direkte}/{tal.ialt}</td>
                    })}
                  </tr>
                ))}
                {harUkendte && (
                  <tr>
                    <td style={{ ...labelCellStyle, color: '#e0a555' }}>Ukendt øvelse</td>
                    {uger.map(u => <td key={u.uge} style={{ ...cellStyle, color: '#e0a555' }}>{u.ukendteSaet}</td>)}
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: '0.56rem', color: '#4a4844', marginTop: '0.85rem', lineHeight: 1.5 }}>
            Hver celle: direkte sæt / i alt (vægtet efter hvad øvelsen belaster). Nyeste uge til venstre.
          </div>
          {grupperMedDataGraf.length > 0 && (
            <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(237,234,226,0.07)' }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7a7770', marginBottom: '0.9rem' }}>
                Udvikling, seneste {GRAF_UGER} uger
              </div>
              <VolumenGraf uger={ugerGraf} grupper={grupperMedDataGraf} />
              <div style={{ fontSize: '0.56rem', color: '#4a4844', marginTop: '0.9rem', lineHeight: 1.5 }}>
                Hver række skalerer efter sin egen gruppe — søjlernes højde kan ikke
                sammenlignes på tværs af grupper, kun uge for uge inden for samme række.
                Tallet til højre er seneste uges "i alt".
              </div>
            </div>
          )}
          {grupperMedDataForloeb.length > 0 && (
            <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(237,234,226,0.07)' }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7a7770', marginBottom: '0.9rem' }}>
                Planlagt mod gennemført, hele forløbet
              </div>
              <VolumenGrafForloeb uger={planlagtForloeb.uger} grupper={grupperMedDataForloeb} />
              <div style={{ fontSize: '0.56rem', color: '#4a4844', marginTop: '0.9rem', lineHeight: 1.5 }}>
                Tynd kontur = planlagt, solid søjle = gennemført, pr. uge. Skalering er
                pr. gruppe, som ovenfor. Tallet til højre er seneste uges gennemført/planlagt.
              </div>
              {planlagtForloeb.ugerUdenDato > 0 && (
                <div style={{ fontSize: '0.6rem', color: '#e0a555', marginTop: '0.6rem' }}>
                  Uger uden dato: {planlagtForloeb.ugerUdenDato} (Sæt datoer)
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
