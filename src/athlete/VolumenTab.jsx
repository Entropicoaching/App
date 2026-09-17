// Volumen-fanen (atletens egen volumen pr. muskelgruppe) — ordre 259.
// Stå på skuldre af src/dashboard/VolumenKort.jsx (coachens kort, ordre
// 177/185/210): samme regnestykke (src/volume/beregn.js), samme
// muskelkort (src/volume/muskelkort.js) og (commit 2) samme søjle-graf
// (src/dashboard/VolumenGraf.jsx, genbrugt uændret — den tager kun
// {uger, grupper}, ingen coach-specifik data).
//
// FORSKEL fra coachens kort (ordrens egen grænse): Marcs egne
// kortlægningsrettelser (exercise_muscle_overrides, src/volume/rettelser.js)
// slås IKKE op her — atleten har ikke læseadgang til dem, og en ny
// RLS-politik der åbnede for det kræver Marcs eget ja (uden for denne
// ordre). `slaaOevelseOp` uden et `rettelser`-argument falder automatisk
// tilbage til BASIS-kortet (indbygget + genereret), se muskelkort.js's
// egen dokumentation — ingen særlig kode nødvendig for at opnå det, blot
// at lade parameteren være udeladt.
//
// Kun gennemførte sæt (ordre 259's "Hvorfor": atleten skal se hvor
// ARBEJDET landede, ikke planen) — ingen "planlagt"-sammenligning her,
// det er en coach-fane (VolumenKort.jsx's "denne uge: gennemført/planlagt"
// og "planlagt mod gennemført, hele forløbet") som kræver `weeks`, ikke
// bedt om i denne ordre.
//
// Data ejes af AthleteView.jsx (volumeLogs/volumeLoading, hentet når fanen
// åbnes — se dens fetchVolumeLogs) og gives ned som props, samme mønster
// som de øvrige lazy-loadede faner (ordre 232).
import { useState } from 'react'
import { beregnVolumenPrUge } from '../volume/beregn.js'
import { MUSKELGRUPPER } from '../volume/muskelkort.js'
import VolumenGraf from '../dashboard/VolumenGraf'
import { s } from '../athleteShared'

// ORDRE 259 · commit 2: "seneste 4 uger" (ordrens egen ramme) — AthleteView.jsx's
// fetchVolumeLogs henter en uges margin ekstra (5 uger) til ugegrænser.
const ANTAL_UGER_TREND = 4

const mono = "'IBM Plex Mono', monospace"

function raekkerFraVolumeLogs(volumeLogs) {
  return (volumeLogs || []).map(log => ({
    oevelseNavn: log.exercises?.name,
    loggetDato: log.logged_at,
    skipped: log.skipped,
  }))
}

export default function VolumenTab({ volumeLogs, volumeLoading }) {
  const [visning, setVisning] = useState('uge')

  const raekker = raekkerFraVolumeLogs(volumeLogs)
  const uger = beregnVolumenPrUge(raekker, { antalUger: ANTAL_UGER_TREND })
  const denneUge = uger[0]
  const grupperDenneUge = Object.keys(MUSKELGRUPPER).filter(g => (denneUge?.grupper[g]?.ialt || 0) > 0)
  const grupperTrend = Object.keys(MUSKELGRUPPER).filter(g => uger.some(u => (u.grupper[g]?.ialt || 0) > 0))
  const harUkendteDenneUge = (denneUge?.ukendteSaet || 0) > 0
  const harUkendteTrend = uger.some(u => u.ukendteSaet > 0)
  const ingenDataOverhovedet = grupperTrend.length === 0 && !harUkendteTrend

  return (
    <>
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ fontFamily: mono, fontSize: '0.56rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#4a4844', marginBottom: '0.5rem' }}>Volumen</div>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.8rem', fontWeight: 400, color: '#edeae2', lineHeight: 1.1 }}>Din volumen.</h1>
      </div>

      <div style={s.card}>
        <div style={s.cardLabel}>Volumen pr. muskelgruppe</div>
        <div style={{ fontSize: '0.72rem', color: '#7a7770', lineHeight: 1.5, marginBottom: '1rem' }}>
          Sæt er ikke belastning. Tallene tæller dine gennemførte sæt, vægtet efter hvad øvelsen belaster.
          Beregnet ud fra standard-øvelseskort.
        </div>

        {volumeLoading ? (
          <div style={{ fontSize: '0.8rem', color: '#4a4844', fontStyle: 'italic' }}>Henter…</div>
        ) : ingenDataOverhovedet ? (
          <div style={{ fontSize: '0.8rem', color: '#4a4844', fontStyle: 'italic' }}>
            Ingen gennemførte sæt de seneste {ANTAL_UGER_TREND} uger endnu.
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <button onClick={() => setVisning('uge')} style={visning === 'uge' ? s.btnPrimary : s.btnGhost}>
                Denne uge
              </button>
              <button onClick={() => setVisning('trend')} style={visning === 'trend' ? s.btnPrimary : s.btnGhost}>
                Seneste {ANTAL_UGER_TREND} uger
              </button>
            </div>

            {visning === 'uge' ? (
              <>
                {grupperDenneUge.length === 0 ? (
                  <div style={{ fontSize: '0.8rem', color: '#4a4844', fontStyle: 'italic' }}>
                    Ingen sæt gennemført denne uge endnu.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {grupperDenneUge.map(g => {
                      const tal = denneUge.grupper[g] || { direkte: 0, ialt: 0 }
                      return (
                        <div key={g} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                          <span style={{ color: '#c8b98a' }}>{MUSKELGRUPPER[g]}</span>
                          <span style={{ fontFamily: mono, color: '#edeae2' }}>{tal.direkte}/{tal.ialt}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
                {harUkendteDenneUge && (
                  <div style={{ fontSize: '0.68rem', color: '#e0a555', marginTop: '0.7rem' }}>
                    {denneUge.ukendteSaet} sæt denne uge er på øvelser der ikke er kortlagt endnu, og tæller ikke med ovenfor.
                  </div>
                )}
                <div style={{ fontSize: '0.56rem', color: '#4a4844', marginTop: '0.85rem', lineHeight: 1.5 }}>
                  Direkte sæt / i alt (vægtet efter hvad øvelsen belaster).
                </div>
              </>
            ) : (
              <>
                {grupperTrend.length === 0 ? (
                  <div style={{ fontSize: '0.8rem', color: '#4a4844', fontStyle: 'italic' }}>
                    Ingen sæt gennemført de seneste {ANTAL_UGER_TREND} uger endnu.
                  </div>
                ) : (
                  <>
                    <VolumenGraf uger={uger} grupper={grupperTrend} />
                    <div style={{ fontSize: '0.56rem', color: '#4a4844', marginTop: '0.9rem', lineHeight: 1.5 }}>
                      Hver række skalerer efter sin egen gruppe — søjlernes højde kan ikke
                      sammenlignes på tværs af grupper, kun uge for uge inden for samme række.
                      Tallet til højre er seneste uges "i alt".
                    </div>
                  </>
                )}
                {harUkendteTrend && (
                  <div style={{ fontSize: '0.68rem', color: '#e0a555', marginTop: '0.7rem' }}>
                    Nogle sæt er på øvelser der ikke er kortlagt endnu, og tæller ikke med ovenfor.
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </>
  )
}
