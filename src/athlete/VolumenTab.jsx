// Volumen-fanen (atletens egen volumen pr. muskelgruppe) — ordre 259, commit 1.
// Stå på skuldre af src/dashboard/VolumenKort.jsx (coachens kort, ordre
// 177/185/210): samme regnestykke (src/volume/beregn.js) og samme
// muskelkort (src/volume/muskelkort.js).
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
// Kun gennemførte sæt, kun den viste (kalender-)uge (ordre 259's "Hvorfor":
// atleten skal se hvor ARBEJDET landede, ikke planen) — ingen "planlagt"-
// sammenligning her, det er en coach-fane (VolumenKort.jsx's "denne uge:
// gennemført/planlagt") som kræver `weeks`, ikke bedt om i denne ordre.
//
// Data ejes af AthleteView.jsx (volumeLogs/volumeLoading, hentet når fanen
// åbnes — se dens fetchVolumeLogs) og gives ned som props, samme mønster
// som de øvrige lazy-loadede faner (ordre 232).
import { beregnVolumenPrUge } from '../volume/beregn.js'
import { MUSKELGRUPPER } from '../volume/muskelkort.js'
import { s } from '../athleteShared'

const mono = "'IBM Plex Mono', monospace"

function raekkerFraVolumeLogs(volumeLogs) {
  return (volumeLogs || []).map(log => ({
    oevelseNavn: log.exercises?.name,
    loggetDato: log.logged_at,
    skipped: log.skipped,
  }))
}

export default function VolumenTab({ volumeLogs, volumeLoading }) {
  const raekker = raekkerFraVolumeLogs(volumeLogs)
  const denneUge = beregnVolumenPrUge(raekker, { antalUger: 1 })[0]
  const grupperDenneUge = Object.keys(MUSKELGRUPPER).filter(g => (denneUge?.grupper[g]?.ialt || 0) > 0)
  const harUkendte = (denneUge?.ukendteSaet || 0) > 0

  return (
    <>
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ fontFamily: mono, fontSize: '0.56rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#4a4844', marginBottom: '0.5rem' }}>Volumen</div>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.8rem', fontWeight: 400, color: '#edeae2', lineHeight: 1.1 }}>Din volumen.</h1>
      </div>

      <div style={s.card}>
        <div style={s.cardLabel}>Volumen pr. muskelgruppe, denne uge</div>
        <div style={{ fontSize: '0.72rem', color: '#7a7770', lineHeight: 1.5, marginBottom: '1rem' }}>
          Sæt er ikke belastning. Tallene tæller dine gennemførte sæt, vægtet efter hvad øvelsen belaster.
          Beregnet ud fra standard-øvelseskort.
        </div>

        {volumeLoading ? (
          <div style={{ fontSize: '0.8rem', color: '#4a4844', fontStyle: 'italic' }}>Henter…</div>
        ) : grupperDenneUge.length === 0 && !harUkendte ? (
          <div style={{ fontSize: '0.8rem', color: '#4a4844', fontStyle: 'italic' }}>
            Ingen sæt gennemført denne uge endnu.
          </div>
        ) : (
          <>
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
            {harUkendte && (
              <div style={{ fontSize: '0.68rem', color: '#e0a555', marginTop: '0.7rem' }}>
                {denneUge.ukendteSaet} sæt denne uge er på øvelser der ikke er kortlagt endnu, og tæller ikke med ovenfor.
              </div>
            )}
            <div style={{ fontSize: '0.56rem', color: '#4a4844', marginTop: '0.85rem', lineHeight: 1.5 }}>
              Direkte sæt / i alt (vægtet efter hvad øvelsen belaster).
            </div>
          </>
        )}
      </div>
    </>
  )
}
