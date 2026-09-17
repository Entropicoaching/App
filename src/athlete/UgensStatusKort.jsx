// ORDRE 268 — "atleten kan se om ugen blev som planlagt". Stå på skuldre af
// src/dashboard/VolumenKort.jsx + VolumenGrafForloeb.jsx (ordre 210, coachens
// "planlagt mod gennemført"-visning og -beregning) og src/athlete/VolumenTab.jsx
// (ordre 259, samme kort-form/farver/toggle-mønster: "Denne uge" / et andet
// vindue). Regnestykket bor i ./ugeStatus.js — denne fil er ren visning.
//
// FORSKEL fra 210: enheden er sæt og tonnage, ikke muskelgrupper — det
// atleten selv kan aflæse uden at kende ordet "muskelgruppe". Grøn/grå, aldrig
// rødt: en dag uden planlagt træning er ikke en fejl, og en delvist logget
// dag er ikke et karakterblad, kun et gab.
//
// commit 2: "Hele forløbet" tegner samme kontur+solid-søjle-teknik som
// VolumenGrafForloeb (ordre 210 commit 2) — men coachens fil importerer
// MUSKELGRUPPER direkte til sine labels og kan derfor ikke genbruges uændret
// til to rækker ("Sæt", "Tonnage"); teknikken er kopieret, IKKE coachens fil
// rørt eller importeret (ordrens egen grænse: "coachens visninger røres ikke").
//
// ORDRE 276 · blok 1 — de tilstande der ikke er den pæne: 360px bredde
// (ingen vandret rulning, ingen afskåret tekst), tom uge (siger hvad man
// gør, ikke at noget mangler), halv uge, forløb uden dateret plan, og et
// tal der er vokset til fem cifre. Ingen ny beregning — kun visningen.
// "Lange forløbs-/øvelsesnavne" gælder ikke DENNE fil: den viser hverken
// sessionstitler (fjernet i ordre 268 commit 3, se DagRaekke's egen
// kommentar) eller øvelsesnavne noget sted, kun ugedag/dato/tal.
import { useState } from 'react'
import { beregnUgeDage, beregnForloebUger } from './ugeStatus.js'
import { s } from '../athleteShared'

const mono = "'IBM Plex Mono', monospace"
const WEEKDAYS_SHORT = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn']

function formatKg(v) {
  if (v == null) return '–'
  return `${Math.round(v)}kg`
}

function ugeKortLabel(ugenoegle) {
  return ugenoegle.replace(/^\d{4}-W/, 'U')
}

function fmtDateShort(d) {
  return d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })
}

function DagRaekke({ dag }) {
  // Ingen sessionstitel vist her med vilje: en session hedder ofte det
  // samme i "Mit program"-kortet længere nede, og et par af de eksisterende
  // e2e-specs (atlet.spec.mjs/fejl.spec.mjs) klikker sig frem via
  // page.getByText(titel) UDEN exact:true — et duplikat af samme tekst her
  // gør den lokator flertydig og vælter dem. Set/tonnage-tallene er selve
  // pointen med rækken; titlen er ikke nødvendig for at læse den.
  const { weekday, date, harSession, planlagtSaet, gennemfoertSaet, planlagtTonnage, gennemfoertTonnage, fuldtLogget } = dag
  const farve = !harSession ? '#4a4844' : fuldtLogget ? '#6cba6c' : '#a9a69e'
  const baggrund = harSession && fuldtLogget ? 'rgba(108,186,108,0.05)' : 'transparent'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.45rem 0.3rem', background: baggrund, borderBottom: '1px solid rgba(237,234,226,0.05)' }}>
      <div style={{ width: '3.2rem', flexShrink: 0 }}>
        <div style={{ fontFamily: mono, fontSize: '0.58rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#7a7770' }}>{WEEKDAYS_SHORT[weekday]}</div>
        {date && <div style={{ fontFamily: mono, fontSize: '0.5rem', color: '#4a4844' }}>{fmtDateShort(date)}</div>}
      </div>
      {!harSession ? (
        <div style={{ fontSize: '0.72rem', color: '#4a4844', fontStyle: 'italic' }}>Ingen træning planlagt</div>
      ) : (
        // Stablet lodret (ikke side om side): et femcifret tonnage-tal
        // ("12345kg / 12345kg") skal have plads til at stå fuldt ud på en
        // 360px-skærm, uden at klemmes sammen med sæt-tallet eller klippes.
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
          <span style={{ fontFamily: mono, fontSize: '0.66rem', color: farve, wordBreak: 'break-word' }}>{gennemfoertSaet}/{planlagtSaet} sæt</span>
          <span style={{ fontFamily: mono, fontSize: '0.66rem', color: farve, wordBreak: 'break-word' }}>{formatKg(gennemfoertTonnage)} / {formatKg(planlagtTonnage)}</span>
        </div>
      )}
      {harSession && fuldtLogget && <span style={{ color: '#6cba6c', fontSize: '0.8rem', flexShrink: 0 }}>✓</span>}
    </div>
  )
}

function ForloebSoejler({ label, planlagtVaerdier, gennemfoertVaerdier, uger, formatVaerdi }) {
  const maxVal = Math.max(...planlagtVaerdier, ...gennemfoertVaerdier, 0)
  const sidstePlanlagt = planlagtVaerdier[planlagtVaerdier.length - 1]
  const sidsteGennemfoert = gennemfoertVaerdier[gennemfoertVaerdier.length - 1]
  function hoejde(v) {
    return maxVal > 0 ? Math.max((v / maxVal) * 100, v > 0 ? 6 : 0) : 0
  }
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.35rem', gap: '0.5rem' }}>
        <span style={{ fontSize: '0.66rem', color: '#c8b98a' }}>{label}</span>
        <span style={{ fontFamily: mono, fontSize: '0.6rem', color: '#edeae2', whiteSpace: 'nowrap' }}>
          {formatVaerdi(sidsteGennemfoert)} / {formatVaerdi(sidstePlanlagt)}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '32px' }}>
        {uger.map((uge, i) => {
          const vPlanlagt = planlagtVaerdier[i]
          const vGennemfoert = gennemfoertVaerdier[i]
          return (
            <div key={uge} title={`${ugeKortLabel(uge)}: ${formatVaerdi(vGennemfoert)} gennemført / ${formatVaerdi(vPlanlagt)} planlagt`}
              style={{ flex: 1, minWidth: 0, height: '100%', position: 'relative' }}>
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${hoejde(vPlanlagt)}%`, border: '1px solid rgba(200,146,58,0.55)', boxSizing: 'border-box' }} />
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${hoejde(vGennemfoert)}%`, background: '#c8923a' }} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ForloebVisning({ uger, ugerUdenDato }) {
  if (!uger.length) {
    return <div style={{ fontSize: '0.8rem', color: '#4a4844', fontStyle: 'italic' }}>Ingen daterede programuger endnu.</div>
  }
  const ugeNoegler = uger.map(u => u.uge)
  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <ForloebSoejler label="Sæt" uger={ugeNoegler}
          planlagtVaerdier={uger.map(u => u.planlagt.saet)}
          gennemfoertVaerdier={uger.map(u => u.gennemfoert.saet)}
          formatVaerdi={v => `${Math.round(v)}`} />
        <ForloebSoejler label="Tonnage" uger={ugeNoegler}
          planlagtVaerdier={uger.map(u => u.planlagt.tonnage ?? 0)}
          gennemfoertVaerdier={uger.map(u => u.gennemfoert.tonnage)}
          formatVaerdi={formatKg} />
      </div>
      <div style={{ fontSize: '0.56rem', color: '#4a4844', marginTop: '0.9rem', lineHeight: 1.5 }}>
        Tynd kontur = planlagt, solid søjle = gennemført, pr. uge. Tallet til højre er seneste uges gennemført/planlagt.
      </div>
      {ugerUdenDato > 0 && (
        <div style={{ fontSize: '0.6rem', color: '#e0a555', marginTop: '0.6rem' }}>
          Uger uden dato: {ugerUdenDato} (indgår ikke ovenfor)
        </div>
      )}
    </>
  )
}

/**
 * @param {object} props
 * @param {object|null} props.week Aktiv programuge (AthleteView.jsx's currentWeek).
 * @param {Date|null} props.weekStart Mandag i ugen (weekStartDate).
 * @param {Array} props.exerciseLogs Denne uges logs (allerede hentet af AthleteView.jsx).
 * @param {Array} props.allWeeks Hele programmet (til "hele forløbet").
 * @param {Array|null} props.forloebLogs Logs til "hele forløbet" — null før første hentning.
 * @param {boolean} props.forloebLoading
 * @param {() => void} props.onAabnForloeb Kaldes når visningen skifter til "hele forløbet" (lazy-hentning).
 */
export default function UgensStatusKort({ week, weekStart, exerciseLogs, allWeeks, forloebLogs, forloebLoading, onAabnForloeb }) {
  const [visning, setVisning] = useState('uge')

  if (!week) return null

  const { dage, flexSessioner } = beregnUgeDage(week, weekStart, exerciseLogs)
  // ORDRE 276 · blok 1: en tom uge (intet planlagt endnu) skal sige det med
  // ord, ikke bare forsvinde — kortet forsvandt tidligere helt her, hvilket
  // på en tom telefonskærm let kan læses som "noget er gået i stykker" i
  // stedet for "her er der ikke noget endnu".
  const ingenPlanlagtOverhovedet = dage.every(d => !d.harSession) && flexSessioner === 0
  // Intet logget endnu denne uge (typisk mandag morgen, før første sæt) —
  // dagene viser stadig 0/X grå, men en kort linje gør det eksplicit at
  // "0" her betyder "endnu ikke", ikke "mislykkedes".
  const intetLoggetEndnu = ingenPlanlagtOverhovedet ? false : dage.every(d => d.gennemfoertSaet === 0)

  const forloeb = forloebLogs ? beregnForloebUger(allWeeks, forloebLogs) : null

  return (
    <div style={s.card}>
      <div style={s.cardLabel}>Ugen som planlagt</div>
      <div style={{ fontSize: '0.72rem', color: '#7a7770', lineHeight: 1.5, marginBottom: '1rem' }}>
        Gennemført mod planlagt — sæt og tonnage. Manglende dage er ikke en fejl, kun et gab.
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.1rem' }}>
        <button onClick={() => setVisning('uge')} style={visning === 'uge' ? s.btnPrimary : s.btnGhost}>Denne uge</button>
        <button
          onClick={() => { setVisning('forloeb'); if (!forloebLogs && !forloebLoading) onAabnForloeb() }}
          style={visning === 'forloeb' ? s.btnPrimary : s.btnGhost}
        >Hele forløbet</button>
      </div>

      {visning === 'uge' ? (
        ingenPlanlagtOverhovedet ? (
          <div style={{ fontSize: '0.8rem', color: '#4a4844', fontStyle: 'italic' }}>
            Ingen træning planlagt denne uge endnu.
          </div>
        ) : (
          <>
            {intetLoggetEndnu && (
              <div style={{ fontSize: '0.68rem', color: '#7a7770', fontStyle: 'italic', marginBottom: '0.6rem' }}>
                Ingen sæt logget i ugen endnu — kom i gang i Dagens pas.
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {dage.map(dag => <DagRaekke key={dag.weekday} dag={dag} />)}
            </div>
            {flexSessioner > 0 && (
              <div style={{ fontFamily: mono, fontSize: '0.5rem', letterSpacing: '0.06em', color: '#4a4844', marginTop: '0.6rem' }}>
                + {flexSessioner} fleksibel{flexSessioner > 1 ? 'le' : ''} session{flexSessioner > 1 ? 'er' : ''} uden fast dag, ikke vist ovenfor
              </div>
            )}
          </>
        )
      ) : forloebLoading || !forloeb ? (
        <div style={{ fontSize: '0.8rem', color: '#4a4844', fontStyle: 'italic' }}>Henter…</div>
      ) : (
        <ForloebVisning uger={forloeb.uger} ugerUdenDato={forloeb.ugerUdenDato} />
      )}
    </div>
  )
}
