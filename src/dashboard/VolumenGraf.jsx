// ORDRE 185 (14. sep), commit 2: udviklingen over tid pr. muskelgruppe —
// "seks til otte uger bagud" (ordrens egen ramme), otte valgt som den mest
// oplysende ende af spændet (samme princip ordre 177 brugte for sit eget
// "fire til seks uger"-valg, se VolumenKort.jsx). Ingen graf-bibliotek,
// ingen ny afhængighed — søjler bygget af almindelige <div>'er, højde sat
// med inline style (ordrens egen tilladte "ren HTML og CSS"-vej).
//
// Skalering er PR. GRUPPE, ikke fælles: knæ-strækkeres og bicepsens tal
// ligger typisk i vidt forskellige størrelsesordener, og en fælles skala
// ville gøre alt undtagen den største gruppe usynligt. Hver søjlerække
// viser derfor kun DEN gruppes egen udvikling over de otte uger — ikke et
// sammenligneligt tal mellem grupper (det stod allerede tabellen for).
//
// Layout: ét grid-felt pr. muskelgruppe (label, søjler, seneste tal),
// auto-fill så det folder til én kolonne på en telefon ved 390px og flere
// kolonner på coachens skærm, uden vandret scroll (ingen fast bredde nogen
// steder — alt er flex/grid-procentbaseret).

import { MUSKELGRUPPER } from '../volume/muskelkort.js'

const mono = "'IBM Plex Mono', monospace"

/** "2026-W37" -> "U37", samme forkortelse som VolumenKort.jsx's tabel. */
function ugeKortLabel(ugenoegle) {
  return ugenoegle.replace(/^\d{4}-W/, 'U')
}

function formatTal(v) {
  return Number.isInteger(v) ? String(v) : v.toFixed(1).replace('.', ',')
}

function MuskelSoejler({ gruppe, label, ugerKronologisk }) {
  const vaerdier = ugerKronologisk.map(u => u.grupper[gruppe]?.ialt || 0)
  const maxVal = Math.max(...vaerdier, 0)
  const sidste = vaerdier[vaerdier.length - 1]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.35rem', gap: '0.5rem' }}>
        <span style={{ fontSize: '0.64rem', color: '#c8b98a', lineHeight: 1.25 }}>{label}</span>
        <span style={{ fontFamily: mono, fontSize: '0.58rem', color: '#edeae2', whiteSpace: 'nowrap' }}>{formatTal(sidste)}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '28px' }}>
        {ugerKronologisk.map((u, i) => {
          const v = vaerdier[i]
          // Minimumshøjde på 6% for et ikke-nul tal, så en lille uge ikke bliver
          // usynlig ved siden af en stor — 0 forbliver 0% (ingen søjle).
          const hoejde = maxVal > 0 ? Math.max((v / maxVal) * 100, v > 0 ? 6 : 0) : 0
          const sidsteSoejle = i === ugerKronologisk.length - 1
          return (
            <div
              key={u.uge}
              title={`${ugeKortLabel(u.uge)}: ${formatTal(v)}`}
              style={{
                flex: 1, minWidth: 0, height: `${hoejde}%`,
                background: sidsteSoejle ? '#c8923a' : 'rgba(200,146,58,0.35)',
              }}
            />
          )
        })}
      </div>
    </div>
  )
}

/**
 * @param {Array<{ uge: string, grupper: Record<string, { ialt: number }> }>} uger
 *   Samme facon som beregnVolumenPrUge's returværdi — NYESTE FØRST (funktionens
 *   egen konvention). Denne komponent vender selv rækkefølgen om til
 *   kronologisk (ældste først), så søjlerne læses venstre-mod-højre som en
 *   tidslinje.
 * @param {string[]} grupper Muskelgruppe-nøgler der skal have en række.
 */
export default function VolumenGraf({ uger, grupper }) {
  if (!grupper.length) return null
  const ugerKronologisk = [...uger].reverse()

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '1rem 1.5rem' }}>
      {grupper.map(g => (
        <MuskelSoejler key={g} gruppe={g} label={MUSKELGRUPPER[g]} ugerKronologisk={ugerKronologisk} />
      ))}
    </div>
  )
}
