// ORDRE 268 · commit 1 — "atleten kan se om ugen blev som planlagt". Stå på
// skuldre af src/dashboard/VolumenKort.jsx (ordre 210, coachens "planlagt
// mod gennemført"-beregning) og src/athlete/VolumenTab.jsx (ordre 259, samme
// kort-form/farver). Regnestykket bor i ./ugeStatus.js — denne fil er ren
// visning.
//
// FORSKEL fra 210: enheden er sæt og tonnage, ikke muskelgrupper — det
// atleten selv kan aflæse uden at kende ordet "muskelgruppe". Grøn/grå,
// aldrig rødt: en dag uden planlagt træning er ikke en fejl, og en delvist
// logget dag er ikke et karakterblad, kun et gab.
import { beregnUgeDage } from './ugeStatus.js'
import { s } from '../athleteShared'

const mono = "'IBM Plex Mono', monospace"
const WEEKDAYS_SHORT = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn']

function formatKg(v) {
  if (v == null) return '–'
  return `${Math.round(v)}kg`
}

function fmtDateShort(d) {
  return d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })
}

function DagRaekke({ dag }) {
  const { weekday, date, harSession, titler, planlagtSaet, gennemfoertSaet, planlagtTonnage, gennemfoertTonnage, fuldtLogget } = dag
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
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
          <div style={{ fontSize: '0.74rem', color: '#c8b98a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{titler.join(' · ')}</div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <span style={{ fontFamily: mono, fontSize: '0.66rem', color: farve }}>{gennemfoertSaet}/{planlagtSaet} sæt</span>
            <span style={{ fontFamily: mono, fontSize: '0.66rem', color: farve }}>{formatKg(gennemfoertTonnage)} / {formatKg(planlagtTonnage)}</span>
          </div>
        </div>
      )}
      {harSession && fuldtLogget && <span style={{ color: '#6cba6c', fontSize: '0.8rem', flexShrink: 0 }}>✓</span>}
    </div>
  )
}

/**
 * @param {object} props
 * @param {object|null} props.week Aktiv programuge (AthleteView.jsx's currentWeek).
 * @param {Date|null} props.weekStart Mandag i ugen (weekStartDate).
 * @param {Array} props.exerciseLogs Denne uges logs (allerede hentet af AthleteView.jsx).
 */
export default function UgensStatusKort({ week, weekStart, exerciseLogs }) {
  if (!week) return null

  const { dage, flexSessioner } = beregnUgeDage(week, weekStart, exerciseLogs)
  const ingenPlanlagtOverhovedet = dage.every(d => !d.harSession) && flexSessioner === 0
  if (ingenPlanlagtOverhovedet) return null

  return (
    <div style={s.card}>
      <div style={s.cardLabel}>Ugen som planlagt</div>
      <div style={{ fontSize: '0.72rem', color: '#7a7770', lineHeight: 1.5, marginBottom: '1rem' }}>
        Gennemført mod planlagt — sæt og tonnage. Manglende dage er ikke en fejl, kun et gab.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {dage.map(dag => <DagRaekke key={dag.weekday} dag={dag} />)}
      </div>
      {flexSessioner > 0 && (
        <div style={{ fontFamily: mono, fontSize: '0.5rem', letterSpacing: '0.06em', color: '#4a4844', marginTop: '0.6rem' }}>
          + {flexSessioner} fleksibel{flexSessioner > 1 ? 'le' : ''} session{flexSessioner > 1 ? 'er' : ''} uden fast dag, ikke vist ovenfor
        </div>
      )}
    </div>
  )
}
