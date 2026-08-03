import { useCallback, useEffect, useRef, useState } from 'react'
import { color, font, s } from './theme.js'
import { Button, Card, Label, Meta, TopBar } from './ui.jsx'
import MemberJourney from './screens/MemberJourney.jsx'
import { enqueuePilotSession, loadPilotOutbox, loadPilotSessions, savePilotSessions } from './pilotCache.js'
import {
  completeMyProgramSetup,
  loadPilotState,
  memberJourneySessionToPilotSession,
  syncOneSession,
  syncPilotOutbox,
} from './pilotRepository.js'
import { PROGRAM_MATCH_INPUT_SCHEMA_VERSION } from './templateMatcher.js'
import { isTransientAccessClockError, retryTransientAccessClock } from './access.js'

function PageMessage({ label, title, children, retry, logout }) {
  return <div style={s.wrap}>
    <TopBar title="Entropi" />
    <div style={{ ...s.page, paddingTop: '2rem' }}>
      <Label>{label}</Label>
      <h1 style={s.h1}>{title}</h1>
      <p style={{ ...s.body, marginBottom: '1.5rem' }}>{children}</p>
      {retry && <Button onClick={retry}>Prøv igen</Button>}
      {logout && <Button variant="ghost" onClick={logout} style={{ marginTop: retry ? '0.65rem' : 0 }}>Log ud</Button>}
    </div>
  </div>
}

function memberSeed(member) {
  if (!member) return null
  return {
    schemaVersion: PROGRAM_MATCH_INPUT_SCHEMA_VERSION,
    goal: member.goal || '',
    level: member.level || '',
    daysPerWeek: member.days_per_week || null,
    equipment: member.equipment || '',
    squatStyle: member.squat_style || '',
    deadliftStyle: member.deadlift_style || '',
    updatedAt: member.program_setup_completed_at || member.onboarded_at || null,
  }
}

function friendlyLoadError(error) {
  const value = String(error?.message || '').toLowerCase()
  if (value.includes('fetch') || value.includes('network') || value.includes('offline')) {
    return 'Der er ikke forbindelse til dit medlemskab. Kontrollér nettet og prøv igen.'
  }
  if (isTransientAccessClockError(error)) {
    return 'Login-serveren er et \u00f8jeblik bagud. Vent et \u00f8jeblik og pr\u00f8v igen \u2014 du beh\u00f8ver ikke et nyt link.'
  }
  if (value.includes('session') || value.includes('jwt') || value.includes('auth')) {
    return 'Login-sessionen kunne ikke bruges. Log ud, og åbn et nyt login-link.'
  }
  return 'Dit medlemskab og program kunne ikke læses. Prøv igen om et øjeblik.'
}

function friendlySetupError(error) {
  const value = String(error?.message || '').toLowerCase()
  if (value.includes('allerede et aktivt program')) {
    return new Error('Der findes allerede et aktivt program. Hent medlemsforsiden igen.')
  }
  if (value.includes('medlemskab') || value.includes('member')) {
    return new Error('Din medlemsadgang kunne ikke bekræftes. Programmet blev ikke oprettet.')
  }
  if (value.includes('fetch') || value.includes('network') || value.includes('offline')) {
    return new Error('Forbindelsen blev afbrudt. Dine valg er gemt på enheden; prøv igen med samme opsætning.')
  }
  return new Error('Uge-1-programmet kunne ikke oprettes sikkert. Dine valg er gemt, så du kan prøve igen.')
}

function FreeProgramme({ program, onRetry, onLogout }) {
  if (!program) return <PageMessage label="Gratis adgang" title="Startprogrammet kunne ikke åbnes." retry={onRetry} logout={onLogout}>
    Startprogrammet kunne ikke hentes. Ingen medlemsdata blev åbnet.
  </PageMessage>

  return <div style={s.wrap}>
    <TopBar title="Entropi" right={<Meta>Gratis</Meta>} />
    <main style={s.page}>
      <Label>Gratis startprogram</Label>
      <h1 style={s.h1}>{program.name}</h1>
      <p style={{ ...s.body, marginBottom: '1rem' }}>{program.summary || program.tagline || 'To faste styrkepas, som ikke ændrer sig ud fra dine data.'}</p>
      <Card style={{ borderColor: color.lineStrong }}>
        <Label tone="muted">Som medlem får du</Label>
        <ul style={{ ...s.body, color: color.text, margin: '0.55rem 0 0', paddingLeft: '1.15rem' }}><li>Et program efter dine svar</li><li>Logning af hvert sæt</li><li>En ugentlig vurdering</li><li>Synlig progression fra uge til uge</li><li>Din egen træningshistorik</li></ul>
      </Card>
      {(program.sessions || []).map((session, index) => <Card key={session.id || index}>
        <Label tone="muted">Pas {index + 1}</Label>
        <h2 style={{ ...s.h2, marginBottom: '0.55rem' }}>{session.name || session.label || `Pas ${index + 1}`}</h2>
        {(session.exercises || session.movements || []).map(exercise => <div key={exercise.id || exercise.exerciseId} style={{ borderTop: `1px solid ${color.line}`, padding: '0.65rem 0' }}>
          <div style={{ color: color.text }}>{exercise.name || exercise.exerciseName}</div>
          <Meta style={{ marginTop: '0.2rem' }}>{exercise.sets || exercise.prescription?.sets} sæt × {exercise.reps || exercise.prescription?.reps} · RPE {exercise.targetRpe || exercise.prescription?.targetRpe}</Meta>
        </div>)}
      </Card>)}
      <Button variant="ghost" onClick={onLogout}>Log ud</Button>
    </main>
  </div>
}

export default function PilotSubscriptionApp({ client, session, logout }) {
  const user = session.user
  const requestSequence = useRef(0)
  const [state, setState] = useState({ status: 'loading' })

  const reload = useCallback(async ({ quiet = false } = {}) => {
    const requestId = ++requestSequence.current
    if (!quiet) setState(current => ({ ...current, status: 'loading', error: null }))
    try {
      let remote = await retryTransientAccessClock(() => loadPilotState(client, user))
      if (remote.access.tier === 'member' && remote.assignment) {
        const queuedSessions = loadPilotOutbox(user.id)
        if (queuedSessions.length) {
          await syncPilotOutbox(client, user.id, remote.assignment)
          remote = await retryTransientAccessClock(() => loadPilotState(client, user))
        }
      }
      if (requestId !== requestSequence.current) return null
      setState({ status: 'ready', ...remote })
      return remote
    } catch (error) {
      if (requestId !== requestSequence.current) return null
      setState({ status: 'error', error: friendlyLoadError(error) })
      return null
    }
  }, [client, user])

  useEffect(() => {
    queueMicrotask(() => reload())
    return () => { requestSequence.current += 1 }
  }, [reload])

  useEffect(() => {
    const retry = () => {
      if (state.status === 'ready' && state.assignment && loadPilotOutbox(user.id).length) reload({ quiet: true })
    }
    window.addEventListener('online', retry)
    return () => window.removeEventListener('online', retry)
  }, [reload, state.assignment, state.status, user.id])

  if (state.status === 'loading') return <PageMessage label="Medlemskonto" title="Henter dit program…">Vi finder dit program og den seneste træningslog.</PageMessage>
  if (state.status === 'error') return <PageMessage label="Medlemskonto" title="Vi kan ikke åbne din træning endnu." retry={reload} logout={logout}>{state.error}</PageMessage>
  if (state.access.tier === 'free') return <FreeProgramme program={state.program} onRetry={reload} onLogout={logout} />

  const completeSetup = async input => {
    try {
      await completeMyProgramSetup(client, input)
      const refreshed = await reload({ quiet: true })
      if (!refreshed?.assignment) throw new Error('assignment-not-readable')
      return refreshed.assignment
    } catch (error) {
      throw friendlySetupError(error)
    }
  }
  const persistSession = async entry => {
    const pilotSession = memberJourneySessionToPilotSession(state.assignment, entry)
    if (pilotSession.localOnly) {
      const sessions = loadPilotSessions(user.id).filter(item => item.clientId !== pilotSession.clientId)
      if (!savePilotSessions(user.id, [...sessions, { ...pilotSession, syncStatus: 'local-only', syncError: null }])) {
        throw new Error('Passet kunne ikke gemmes sikkert på denne enhed.')
      }
      setState(current => ({
        ...current,
        sessions: loadPilotSessions(user.id),
        syncRevision: (current.syncRevision || 0) + 1,
      }))
      return { ok: true, localOnly: true }
    }
    enqueuePilotSession(user.id, pilotSession)
    setState(current => ({
      ...current,
      sessions: loadPilotSessions(user.id),
      syncRevision: (current.syncRevision || 0) + 1,
    }))
    const result = await syncOneSession(client, user.id, state.assignment, pilotSession)
    setState(current => ({
      ...current,
      sessions: loadPilotSessions(user.id),
      syncRevision: (current.syncRevision || 0) + 1,
    }))
    return result
  }

  const queuedSessions = loadPilotOutbox(user.id)
  const hasLocalOnlySession = state.sessions.some(item => item.syncStatus === 'local-only')
  const syncFailed = queuedSessions.some(item => item.syncStatus === 'failed')
  const syncText = syncFailed
    ? 'Kunne ikke synkronisere · prøv igen'
    : queuedSessions.length
      ? 'Gemt på denne enhed · synkroniserer'
      : hasLocalOnlySession
        ? 'Gemt på denne enhed'
        : 'Gemt'
  const syncStatus = syncFailed
    ? <button
      type="button"
      data-entropi-focus
      aria-label="Kunne ikke synkronisere. Prøv igen"
      onClick={() => reload({ quiet: true })}
      style={{
        minHeight: '44px',
        maxWidth: '16rem',
        padding: '0.35rem 0',
        background: 'transparent',
        border: 'none',
        color: color.muted,
        fontFamily: font.mono,
        fontSize: '0.62rem',
        lineHeight: 1.35,
        textAlign: 'right',
        cursor: 'pointer',
      }}
    >{syncText}</button>
    : <Meta aria-live="polite" style={{ color: queuedSessions.length || hasLocalOnlySession ? color.muted : color.good }}>{syncText}</Meta>

  return <div style={s.wrap}>
    <TopBar title="Entropi" right={syncStatus} />
    <MemberJourney
      userId={user.id}
      assignment={state.assignment}
      program={state.program}
      historySessions={state.sessions}
      initialMatchInput={memberSeed(state.member)}
      onCompleteSetup={completeSetup}
      onPersistSession={persistSession}
      onLogout={logout}
      onRetry={() => reload({ quiet: true })}
    />
  </div>
}
