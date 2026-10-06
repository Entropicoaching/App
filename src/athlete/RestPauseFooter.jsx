// Pauselinjen nederst paa forsiden — flyttet uaendret ud af AthleteView.jsx
// (ordre 373). Se kommentaren nedenfor for moenstret (verify:athlete-rest-timer-drift).
import { useState, useEffect } from 'react'
import { remainingSeconds } from '../restTimer'
import { clearRestPause } from '../restPause'
import CountdownRing from './CountdownRing'

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
//
// ORDRE 1402 — Marcs dom (6. okt): hvile-timeren skal være en pop-up man kan
// klikke ind på, ligesom mobilitetsøvelserne i opvarmningen. Linjen nederst er
// uændret og nu en knap; et tryk åbner pop-up'en med samme CountdownRing som
// opvarmningen. Timerlogikken (liveSeconds ovenfor) er uændret og deles af
// linjen og pop-up'en — ingen ekstra interval, ingen ny tidskilde.
function RestPauseFooter({ athleteId, pause, onClear, nextLabel }) {
  const [open, setOpen] = useState(false)
  const [liveSeconds, setLiveSeconds] = useState(() => remainingSeconds(pause.durationSeconds, pause.startedAt))

  useEffect(() => {
    const recompute = () => setLiveSeconds(remainingSeconds(pause.durationSeconds, pause.startedAt))
    recompute()
    const id = setInterval(recompute, 250)
    const onVisible = () => { if (document.visibilityState === 'visible') recompute() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVisible) }
  }, [pause.startedAt, pause.durationSeconds])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const done = liveSeconds <= 0
  const clear = () => { clearRestPause(athleteId); setOpen(false); onClear() }
  const frac = pause.durationSeconds > 0 ? Math.max(0, Math.min(1, liveSeconds / pause.durationSeconds)) : 0
  return (
    <div style={{ position: 'fixed', left: 0, right: 0, bottom: '54px', zIndex: 90, background: '#141410', borderTop: `1px solid ${done ? 'rgba(108,186,108,0.25)' : 'rgba(200,146,58,0.2)'}` }}>
      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '0.4rem 1rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        <button
          type="button"
          aria-label="Åbn pausetimer"
          data-testid="rest-pause-open"
          onClick={() => setOpen(true)}
          style={{ background: 'none', border: 'none', padding: 0, margin: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.6rem', flex: 1, minWidth: 0, minHeight: '44px', textAlign: 'left' }}
        >
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: done ? '#6cba6c' : '#c8923a', whiteSpace: 'nowrap' }}>
          {done ? 'Pause slut' : 'Pause'}{pause.label ? ` · ${pause.label}` : ''}
        </span>
        <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '1rem', color: '#edeae2', lineHeight: 1, whiteSpace: 'nowrap' }}>{done ? '✓' : `${liveSeconds}s`}</span>
        {nextLabel && (
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.54rem', color: '#7a7770', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
            {nextLabel}
          </span>
        )}
        </button>
        <button
          type="button"
          aria-label="Skjul pausetimer"
          onClick={clear}
          style={{ background: 'none', border: 'none', color: '#4a4844', cursor: 'pointer', fontSize: '0.75rem', minWidth: '32px', minHeight: '32px', flexShrink: 0 }}
        >✕</button>
      </div>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Pausetimer"
          data-testid="rest-pause-popup"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(10,10,8,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
        >
          <div style={{ background: '#1c1c18', border: '1px solid rgba(237,234,226,0.07)', padding: '1.75rem', width: '100%', maxWidth: '360px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: done ? '#6cba6c' : '#c8923a' }}>{done ? 'Pause slut' : 'Pause'}</div>
            {pause.label && <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.4rem', fontWeight: 400, color: '#edeae2', margin: 0, textAlign: 'center', lineHeight: 1.2 }}>{pause.label}</h2>}
            <CountdownRing total={pause.durationSeconds} remaining={liveSeconds} done={done} />
            {nextLabel && <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', color: '#b8b4a8', textAlign: 'center', lineHeight: 1.5 }}>{nextLabel}</div>}
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', justifyContent: 'center' }}>
              <button type="button" data-testid="rest-pause-close" onClick={() => setOpen(false)} style={{ background: 'none', border: '1px solid rgba(237,234,226,0.2)', color: '#edeae2', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', padding: '0.5rem 1.25rem', minHeight: '44px', cursor: 'pointer' }}>Luk</button>
              <button type="button" onClick={clear} style={{ background: 'none', border: '1px solid rgba(237,234,226,0.1)', color: '#7a7770', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', padding: '0.5rem 1.25rem', minHeight: '44px', cursor: 'pointer' }}>Skjul pausen</button>
            </div>
          </div>
        </div>
      )}
      {!done && (
        <div style={{ height: '2px', background: 'rgba(237,234,226,0.08)' }}>
          <div style={{ height: '100%', width: `${frac * 100}%`, background: '#c8923a', transition: 'width 1s linear' }} />
        </div>
      )}
    </div>
  )
}

export default RestPauseFooter
