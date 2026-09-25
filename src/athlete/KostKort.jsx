// Kost-kortene: KostCompact (forsidens slanke kost-linje) og ProgressBars
// (kalorie-/proteinkortene i Kost-fanen) — JSX'en flyttet uaendret ud af
// AthleteView.jsx (ordre 373). Tallene regnes stadig i kostHandlinger.js.
import { s } from '../athleteShared'

function KostCompact({
  athlete, kcalPct, proteinPct, setTab, totKcal, totProtein,
}) {
  return (
    <div
      onClick={() => setTab('kost')}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(200,146,58,0.3)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(237,234,226,0.07)'}
      style={{ ...s.card, cursor: 'pointer', padding: '0.7rem 1rem', marginBottom: '1.5rem' }}
    >
      {(totKcal > 0 || totProtein > 0) ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <span style={{ ...s.cardLabel, marginBottom: 0, flexShrink: 0 }}>Kost i dag</span>
          {[
            { val: totKcal, target: athlete.kcal_target, unit: 'kcal', pct: kcalPct, color: '#c8923a' },
            { val: totProtein, target: athlete.protein_target, unit: 'g protein', pct: proteinPct, color: '#6cba6c' },
          ].map(({ val, target, unit, pct, color }) => (
            <span key={unit} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.62rem', color: '#edeae2', whiteSpace: 'nowrap' }}>
                {val}<span style={{ color: '#7a7770' }}> / {target || '?'} {unit}</span>
              </span>
              <span style={{ width: 44, height: 3, background: '#242420', borderRadius: 2, flexShrink: 0 }}>
                <span style={{ display: 'block', width: `${Math.min(pct, 100)}%`, height: 3, background: color, borderRadius: 2 }} />
              </span>
            </span>
          ))}
          <span style={{ marginLeft: 'auto', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.55rem', color: '#4a4844' }}>→</span>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ ...s.cardLabel, marginBottom: 0 }}>Kost</span>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', color: '#4a4844', letterSpacing: '0.05em' }}>
            Ingen måltider logget i dag
          </span>
          <span style={{ marginLeft: 'auto', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.55rem', color: '#4a4844' }}>→</span>
        </div>
      )}
    </div>
  )
}

function ProgressBars({
  athlete, kcalPct, proteinPct, totKcal, totProtein,
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
      {[
        { label: 'Kalorier', val: totKcal, target: athlete.kcal_target, unit: 'kcal', pct: kcalPct, color: '#c8923a' },
        { label: 'Protein', val: totProtein, target: athlete.protein_target, unit: 'g', pct: proteinPct, color: '#6cba6c' },
      ].map(({ label, val, target, unit, pct, color }) => (
        <div key={label} style={s.card}>
          <div style={s.cardLabel}>{label}</div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.3rem', color: '#edeae2', lineHeight: 1, marginBottom: '0.6rem' }}>
            {val} <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '0.8rem', color: '#7a7770', fontWeight: 300 }}>/ {target || '?'} {unit}</span>
          </div>
          <div style={{ height: '3px', background: '#242420', borderRadius: '2px' }}>
            <div style={{ height: '3px', width: pct + '%', background: color, borderRadius: '2px', transition: 'width 0.4s ease' }} />
          </div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', color: '#4a4844', marginTop: '0.35rem' }}>{pct}%</div>
        </div>
      ))}
    </div>
  )
}

export { KostCompact, ProgressBars }
