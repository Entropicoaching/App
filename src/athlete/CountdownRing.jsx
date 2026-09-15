// Cirkulær nedtællings-ring til guide-timere (opvarmning + mobilisering, og
// ExerciseTimer i AthleteView.jsx's PROGRAM-fane). Ringen tømmes som tiden
// løber; bliver grøn med flueben når sættet er færdigt. Udskilt i sin egen
// fil (ordre 232 · commit 2), da react-refresh kun tillader komponent-
// eksporter i en JSX-fil — se athleteShared.js for stilarterne (`s`).
export default function CountdownRing({ total, remaining, done }) {
  const r = 52, C = 2 * Math.PI * r
  const frac = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0
  return (
    <div style={{ position: 'relative', width: 128, height: 128 }}>
      <svg width="128" height="128" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="64" cy="64" r={r} fill="none" stroke="rgba(237,234,226,0.08)" strokeWidth="6" />
        {done
          ? <circle cx="64" cy="64" r={r} fill="none" stroke="#6cba6c" strokeWidth="6" />
          : <circle cx="64" cy="64" r={r} fill="none" stroke="#c8923a" strokeWidth="6" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - frac)} style={{ transition: 'stroke-dashoffset 1s linear' }} />}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        {done
          ? <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '2.6rem', color: '#6cba6c', lineHeight: 1 }}>✓</span>
          : <>
              <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '2.4rem', color: '#edeae2', lineHeight: 1 }}>{remaining}</span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.12em', color: '#7a7770', textTransform: 'uppercase', marginTop: '0.2rem' }}>sek</span>
            </>}
      </div>
    </div>
  )
}
