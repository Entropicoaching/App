// ORDRE 210 (15. sep), commit 2: planlagt mod gennemført over HELE forløbet
// (ikke kun "denne uge", som ordre 185 var begrænset til, dengang uger ikke
// havde datoer — se src/volume/planlagt.js's beregnPlanlagtPrUge). Stå på
// skuldre af VolumenGraf.jsx (185): samme teknik (almindelige <div>'er,
// ingen graf-bibliotek, skalering PR. GRUPPE, ikke fælles), udvidet til at
// vise to tal pr. søjle i stedet for ét: planlagt som en tynd kontur (kun
// kant, gennemsigtig baggrund) BAGVED en solidt farvet gennemført-søjle,
// begge bundjusteret i samme kolonne. Gabet mellem konturens top og den
// solide søjles top ER pointen — det er præcis det gab "hvad grafen siger"
// (commit 3, VolumenKort.jsx) sætter tal på.
//
// `uger` kommer allerede kronologisk (ældste først) fra beregnPlanlagtPrUge
// — til forskel fra VolumenGraf, som får nyeste-først og selv vender den om.
// Ingen fast bredde eller min-bredde pr. søjle (kun `flex:1, minWidth:0`),
// så et langt forløb (mange uger) klemmer søjlerne tyndere i stedet for at
// udløse vandret scroll — samme grænse ordren selv sætter ("ingen vandret
// scroll").

import { MUSKELGRUPPER } from '../volume/muskelkort.js'

const mono = "'IBM Plex Mono', monospace"

/** "2026-W37" -> "U37", samme forkortelse som VolumenKort.jsx/VolumenGraf.jsx. */
function ugeKortLabel(ugenoegle) {
  return ugenoegle.replace(/^\d{4}-W/, 'U')
}

function formatTal(v) {
  return Number.isInteger(v) ? String(v) : v.toFixed(1).replace('.', ',')
}

function MuskelSoejlerForloeb({ gruppe, label, uger }) {
  const planlagtVaerdier = uger.map(u => u.planlagt.grupper[gruppe]?.ialt || 0)
  const gennemfoertVaerdier = uger.map(u => u.gennemfoert.grupper[gruppe]?.ialt || 0)
  const maxVal = Math.max(...planlagtVaerdier, ...gennemfoertVaerdier, 0)
  const sidstePlanlagt = planlagtVaerdier[planlagtVaerdier.length - 1]
  const sidsteGennemfoert = gennemfoertVaerdier[gennemfoertVaerdier.length - 1]

  // Samme minimumshøjde-regel som VolumenGraf.jsx: 6% for et ikke-nul tal,
  // så en lille værdi ikke bliver usynlig ved siden af en stor.
  function hoejde(v) {
    return maxVal > 0 ? Math.max((v / maxVal) * 100, v > 0 ? 6 : 0) : 0
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.35rem', gap: '0.5rem' }}>
        <span style={{ fontSize: '0.64rem', color: '#c8b98a', lineHeight: 1.25 }}>{label}</span>
        <span style={{ fontFamily: mono, fontSize: '0.58rem', color: '#edeae2', whiteSpace: 'nowrap' }}>
          {formatTal(sidsteGennemfoert)} / {formatTal(sidstePlanlagt)}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '28px' }}>
        {uger.map((u, i) => {
          const vPlanlagt = planlagtVaerdier[i]
          const vGennemfoert = gennemfoertVaerdier[i]
          return (
            <div
              key={u.uge}
              title={`${ugeKortLabel(u.uge)}: ${formatTal(vGennemfoert)} gennemført / ${formatTal(vPlanlagt)} planlagt`}
              style={{ flex: 1, minWidth: 0, height: '100%', position: 'relative' }}
            >
              {/* Planlagt: tynd kontur bagved. */}
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                height: `${hoejde(vPlanlagt)}%`,
                border: '1px solid rgba(200,146,58,0.55)', boxSizing: 'border-box',
              }} />
              {/* Gennemført: solid søjle foran. */}
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                height: `${hoejde(vGennemfoert)}%`,
                background: '#c8923a',
              }} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * @param {Array<{ uge: string, planlagt: { grupper: Record<string, { ialt: number }> }, gennemfoert: { grupper: Record<string, { ialt: number }> } }>} uger
 *   Samme facon som beregnPlanlagtPrUge's `uger` — ældste først.
 * @param {string[]} grupper Muskelgruppe-nøgler der skal have en række.
 */
export default function VolumenGrafForloeb({ uger, grupper }) {
  if (!grupper.length || !uger.length) return null

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '1rem 1.5rem' }}>
      {grupper.map(g => (
        <MuskelSoejlerForloeb key={g} gruppe={g} label={MUSKELGRUPPER[g]} uger={uger} />
      ))}
    </div>
  )
}
