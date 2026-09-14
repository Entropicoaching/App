// ORDRE 177 (13. sep), commit 3: kortet på coachens atletside der viser
// hvor ugens træningsvolumen lander pr. muskelgruppe — Marcs egen ordlyd:
// "20 sæt quads ugentlig". Lille og tydeligt, ingen graf-bibliotek, ingen ny
// afhængighed (ordrens egen grænse) — en almindelig tabel, samme
// "IBM Plex Mono, mørk baggrund"-stil som resten af Dashboard.jsx (se
// dashboardShared.js's `s`).
//
// Ren visning: al regning sker i src/volume/beregn.js, alt kortlægnings-
// arbejde i src/volume/muskelkort.js. Denne fil oversætter kun
// Dashboard.jsx's egen athleteLogs-form (fetchAthleteLogs' indlejrede
// exercises-relation) til de flade rækker beregn.js forventer.
import { beregnVolumenPrUge } from '../volume/beregn.js'
import { MUSKELGRUPPER } from '../volume/muskelkort.js'
import { s } from '../dashboardShared'

// Ordrens egen ramme: "fire til seks uger bagud" — seks valgt som den mest
// oplysende ende af det spænd, notér-og-fortsæt (ordren beder om at vælge
// selv, ikke spørge).
const ANTAL_UGER = 6

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

export default function VolumenKort({ athleteLogs }) {
  const uger = beregnVolumenPrUge(raekkerFraAthleteLogs(athleteLogs), { antalUger: ANTAL_UGER })

  // Kun grupper der reelt har haft sæt i vinduet — resten ville kun være
  // rækker af nuller. En gruppe der aldrig optræder her er ikke "0 sæt",
  // den er ikke ramt af noget appen genkender endnu (se docs/VOLUMEN.md).
  const grupperMedData = Object.keys(MUSKELGRUPPER).filter(g => uger.some(u => (u.grupper[g]?.ialt || 0) > 0))
  const harUkendte = uger.some(u => u.ukendteSaet > 0)

  return (
    <div style={{ ...s.card, marginTop: '1.5rem' }}>
      <div style={s.cardLabel}>Volumen pr. muskelgruppe</div>
      <div style={{ fontSize: '0.72rem', color: '#7a7770', lineHeight: 1.5, marginBottom: '1rem' }}>
        Sæt er ikke belastning. Tallene tæller gennemførte sæt, vægtet efter hvad øvelsen belaster.
      </div>
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
        </>
      )}
    </div>
  )
}
