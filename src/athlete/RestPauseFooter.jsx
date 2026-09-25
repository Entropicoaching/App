// Pauselinjen nederst paa forsiden — flyttet uaendret ud af AthleteView.jsx
// (ordre 373). Se kommentaren nedenfor for moenstret (verify:athlete-rest-timer-drift).
import { useState, useEffect } from 'react'
import { remainingSeconds } from '../restTimer'
import { clearRestPause } from '../restPause'

// ORDRE 263 · commit 2 — pausen der starter af sig selv når et sæt logges
// (se logSet). Samme tidsstempel-baserede mønster som ProgramTab.jsx's
// ExerciseTimer (remainingSeconds, genberegning ved visibilitychange, ALDRIG
// "s => s - 1" pr. tick, se verify:athlete-rest-timer-drift) — kun
// starttidspunkt + varighed er sandheden, så pausen ikke driver eller
// springer hvis skærmen slukkes eller fanen lukkes midt i den (restPause.js
// persisterer dem, uafhængigt af om komponentet selv overlever).
//
// ORDRE 280 · commit 3 — flyttet ud af DagensPasCard og fastgjort nederst på
// skærmen (over bundnavigationen): en rolig linje, ikke et stort ur, der
// bliver ved med at være synlig når man ruller væk fra kortet, og siger
// hvilket sæt der er næste — uden at stjæle plads fra "Godkendt"-knappen i
// kortet (helt separat element, egen position).
function RestPauseFooter({ athleteId, pause, onClear, nextLabel }) {
  const [liveSeconds, setLiveSeconds] = useState(() => remainingSeconds(pause.durationSeconds, pause.startedAt))

  useEffect(() => {
    const recompute = () => setLiveSeconds(remainingSeconds(pause.durationSeconds, pause.startedAt))
    recompute()
    const id = setInterval(recompute, 250)
    const onVisible = () => { if (document.visibilityState === 'visible') recompute() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVisible) }
  }, [pause.startedAt, pause.durationSeconds])

  const done = liveSeconds <= 0
  const frac = pause.durationSeconds > 0 ? Math.max(0, Math.min(1, liveSeconds / pause.durationSeconds)) : 0
  return (
    <div style={{ position: 'fixed', left: 0, right: 0, bottom: '54px', zIndex: 90, background: '#141410', borderTop: `1px solid ${done ? 'rgba(108,186,108,0.25)' : 'rgba(200,146,58,0.2)'}` }}>
      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '0.4rem 1rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: done ? '#6cba6c' : '#c8923a', whiteSpace: 'nowrap' }}>
          {done ? 'Pause slut' : 'Pause'}{pause.label ? ` · ${pause.label}` : ''}
        </span>
        <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '1rem', color: '#edeae2', lineHeight: 1, whiteSpace: 'nowrap' }}>{done ? '✓' : `${liveSeconds}s`}</span>
        {nextLabel && (
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.54rem', color: '#7a7770', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
            {nextLabel}
          </span>
        )}
        <button
          type="button"
          aria-label="Skjul pausetimer"
          onClick={() => { clearRestPause(athleteId); onClear() }}
          style={{ background: 'none', border: 'none', color: '#4a4844', cursor: 'pointer', fontSize: '0.75rem', minWidth: '32px', minHeight: '32px', flexShrink: 0 }}
        >✕</button>
      </div>
      {!done && (
        <div style={{ height: '2px', background: 'rgba(237,234,226,0.08)' }}>
          <div style={{ height: '100%', width: `${frac * 100}%`, background: '#c8923a', transition: 'width 1s linear' }} />
        </div>
      )}
    </div>
  )
}

export default RestPauseFooter
