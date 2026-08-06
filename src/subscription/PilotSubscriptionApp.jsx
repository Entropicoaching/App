import { useCallback, useEffect, useRef, useState } from 'react'
import { color, font, s } from './theme.js'
import { Button, Card, Label, Meta, TopBar } from './ui.jsx'
import MemberJourney from './screens/MemberJourney.jsx'
import Landing from './screens/Landing.jsx'
import Onboarding from './screens/Onboarding.jsx'
import { PILOT_FREE_SETUP, PILOT_GUIDE, PILOT_LANDING, PILOT_PRICING } from './featureFlags.js'
import { enqueuePilotSession, loadPilotOutbox, loadPilotSessions, savePilotSessions } from './pilotCache.js'
import {
  completeMySetupForTier,
  loadPilotState,
  memberJourneySessionToPilotSession,
  setupFailureDiagnostic,
  syncOneSession,
  syncPilotOutbox,
} from './pilotRepository.js'
import { PROGRAM_MATCH_INPUT_SCHEMA_VERSION } from './templateMatcher.js'
import { isEmbeddedSocialBrowser, isTransientAccessClockError, isTransientNetworkError, retryTransientAccessClock } from './access.js'

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
  if (error?.setupFailureReason === 'CLOCK' || isTransientAccessClockError(error)) {
    return new Error('Login-serveren er et \u00f8jeblik bagud. Dine valg er gemt; vent et \u00f8jeblik og pr\u00f8v igen.')
  }
  if (error?.setupFailureReason === 'NETWORK' || isTransientNetworkError(error)) {
    return new Error('Browseren afbr\u00f8d forbindelsen. Dine valg er gemt her; pr\u00f8v igen. Hvis det forts\u00e6tter i Instagram, skal login \u00e5bnes i Safari.')
  }
  if (error?.setupFailureReason === 'ACTIVE_PROGRAM' || value.includes('allerede et aktivt program')) {
    return new Error('Der findes allerede et aktivt program. Hent medlemsforsiden igen.')
  }
  if (error?.setupFailureReason === 'MEMBERSHIP' || value.includes('medlemskab') || value.includes('member')) {
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
  // CT-033: forsiden vises én gang pr. session, ikke som en væg man skal
  // forbi hver gang. Uden PILOT_LANDING bruges den aldrig.
  const [forbiForside, setForbiForside] = useState(false)
  // Guiden aabnes fra forsiden. Uden PILOT_GUIDE bruges den aldrig.
  const [visGuide, setVisGuide] = useState(false)

  const reload = useCallback(async ({ quiet = false } = {}) => {
    const requestId = ++requestSequence.current
    if (!quiet) setState(current => ({ ...current, status: 'loading', error: null }))
    try {
      let remote = await retryTransientAccessClock(() => loadPilotState(client, user))
      // Outboxen gælder alle med et aktivt program, ikke kun members. Da
      // gratis-brugere fik deres egen opsætning, fik de også pas at
      // synkronisere — og en tier-låst outbox ville tabe dem tavst.
      if (remote.assignment) {
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
  // CT-033: forsiden bygges ind hos Mitch bag et SLUKKET flag. Med
  // PILOT_LANDING === false er linjen herunder uden virkning, og gratis-
  // brugeren ser præcis det samme som før. Flaget tændes kun af Marc, og kun
  // efter at han selv har set adfærden.
  if (state.access.tier === 'free' && PILOT_LANDING && !forbiForside) {
    return <div style={s.wrap}>
      <TopBar title="Entropi" right={<Meta>Gratis</Meta>} />
      <Landing
        indlejret
        harProfil
        entitlement="free"
        visPris={PILOT_PRICING}
        onStart={() => {
          setForbiForside(true)
          if (PILOT_GUIDE && !PILOT_FREE_SETUP) setVisGuide(true)
        }}
      />
    </div>
  }

  // ── Gratis-sporet: to veje, og den nye er slukket ───────────────────────
  //
  // Med PILOT_FREE_SETUP TÆNDT går gratis-brugere gennem MemberJourney som
  // alle andre: rigtig opsætning, rigtigt program, rigtig træningslog.
  // Serverfunktionen `sub_complete_my_free_setup_v1` afviser alt der ikke er
  // free, så adskillelsen ligger i serveren frem for i to skærme.
  //
  // Med flaget SLUKKET er adfærden præcis som før: en kosmetisk guide der
  // skriver intet, og en FreeProgramme-skærm der kun kan vise programmet.
  //
  // Flaget er slukket med vilje. CT-033: Marc ser adfærden før nogen anden.
  if (!PILOT_FREE_SETUP) {
    // Guiden SKRIVER INTET — hverken til Supabase eller lokalt. Den viser
    // hvilket program svarene peger på, og fører tilbage til det startprogram
    // serveren allerede har tildelt.
    if (state.access.tier === 'free' && PILOT_GUIDE && visGuide) {
      return <Onboarding
        springNavn
        slutKnap="Tilbage til mit program"
        slutNote="Det her er kun et overblik. Dit nuværende program er uændret, og intet er gemt."
        onCreate={() => setVisGuide(false)}
      />
    }
    if (state.access.tier === 'free') return <FreeProgramme program={state.program} onRetry={reload} onLogout={logout} />
  }

  const completeSetup = async input => {
    try {
      await completeMySetupForTier(client, input, state.access.tier)
      const refreshed = await reload({ quiet: true })
      if (!refreshed?.assignment) throw new Error('assignment-not-readable')
      return refreshed.assignment
    } catch (error) {
      const friendly = friendlySetupError(error)
      const diagnostic = setupFailureDiagnostic(input.requestId, error)
      // A transport error can contain private request data, so it must not be retained as `cause`.
      // eslint-disable-next-line preserve-caught-error
      throw new Error(`${friendly.message} Ref. ${diagnostic.label}.`)
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

  const embeddedSetupWarning = !state.assignment && isEmbeddedSocialBrowser(globalThis.navigator?.userAgent)
    ? <div style={{ ...s.page, paddingBottom: 0 }}>
      <Card style={{ borderColor: color.accentBorder }}>
        <Label>Åbn i Safari eller Chrome</Label>
        <p style={{ ...s.body, color: color.text, margin: '0.55rem 0 0' }}>Instagram og Facebook kan afbryde det sidste trin i programoprettelsen. Bed Marc om et nyt personligt login-link, og åbn det i din normale browser, før du sætter programmet op.</p>
      </Card>
    </div>
    : null

  return <div style={s.wrap}>
    <TopBar title="Entropi" right={syncStatus} />
    {embeddedSetupWarning}
    <MemberJourney
      userId={user.id}
      assignment={state.assignment}
      program={state.program}
      historySessions={state.sessions}
      initialMatchInput={memberSeed(state.member)}
      member={state.member}
      onCompleteSetup={completeSetup}
      onPersistSession={persistSession}
      onLogout={logout}
      onRetry={() => reload({ quiet: true })}
    />
  </div>
}
