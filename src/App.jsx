import { useState, useEffect, useRef } from 'react'
import { supabase, withRetry, isPasswordRecoveryUrl } from './supabase'
import Auth from './Auth'
import SetNewPassword from './SetNewPassword'
import ErrorBoundary from './ErrorBoundary'
import { purgeVideoCoachDraftQueues } from './videoCoachSubmission'
import LazyBoundary from './LazyBoundary'
import { readCachedRole, writeCachedRole } from './roleCache'

// Lazy-load de to store views, så atleter ikke downloader coach-dashboardet (og
// omvendt). Halverer det første bundt der skal hentes på mobil. Indlæses via
// LazyBoundary (ordre 163 · del 2): egen fejlgrænse pr. view, så en fejl i
// den ene ikke rammer den anden (og en stale chunk-reference efter en deploy
// prøver igen med back-off før den falder tilbage til ét helside-genload).
const dashboardFactory = () => import('./Dashboard')
const athleteViewFactory = () => import('./AthleteView')

// ORDRE 201 — kæden foran Dashboard/AthleteView var ren sekventiel:
// rolleopslaget (profiles?select=role) ventede på hoved-bundtet, og KUN
// DEREFTER startede den rigtige chunks download — se docs/RAPPORT-193.md's
// waterfall (fase 2→3, ~2,1s ekstra ventetid). Et forsøg på at hente BEGGE
// chunks spekulativt (parallelt med rolleopslaget) blev afprøvet og
// FRAVALGT — se docs/VALG-201.md: under den throttlede mobilprofils
// begrænsede båndbredde konkurrerer de to chunks om samme rør, og den
// FAKTISK nødvendige chunk bliver MÅLBART langsommere, ikke hurtigere.
// I stedet: husk rollen lokalt fra sidste succesfulde opslag for DENNE
// bruger, og render den gættede visning UDEN at vente på netværket — kun
// ét chunk-kald, ingen konkurrence. Det ægte opslag kører stadig i
// baggrunden og retter sig selv (setRole) hvis gættet var forkert (fx
// rollen blev ændret server-side siden sidst) — se resolveRole nedenfor.
// readCachedRole/writeCachedRole flyttet til ./roleCache.js i ordre 233
// (commit 1), uændret format — se dér for hvorfor (genbrugt af index.html's
// forudindlæsnings-script via vite.config.js).

// Ordre 163 · del 4 (billig gevinst): et skelet i stedet for ren mørk tekst.
// Appens tema er næsten sort (#141410) i alle indlæsningstilstande — ren
// tekst i lav kontrast på en flere sekunder lang koldstart (se Del 1's mål:
// 5,4s FCP på en langsom profil) læses let som "sort skærm", selvom appen
// reelt arbejder. Et pulserende skelet giver synlig struktur med det samme.
const skeletonBar = (width, height = '0.9rem') => (
  <div style={{ width, height, background: 'rgba(237,234,226,0.06)', animation: 'entropi-skel-pulse 1.4s ease-in-out infinite' }} />
)

const loaderScreen = (
  <div style={{
    minHeight: '100vh', background: '#141410', display: 'flex', flexDirection: 'column',
  }}>
    <style>{'@keyframes entropi-skel-pulse { 0%, 100% { opacity: 0.35 } 50% { opacity: 0.7 } }'}</style>
    <div style={{ height: 52, borderBottom: '1px solid rgba(237,234,226,0.07)', display: 'flex', alignItems: 'center', padding: '0 1.5rem' }}>
      {skeletonBar('90px', '1rem')}
    </div>
    <div style={{ maxWidth: 680, width: '100%', margin: '0 auto', padding: '1.5rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {skeletonBar('55%', '1.6rem')}
      <div style={{ height: '0.5rem' }} />
      {skeletonBar('100%', '4.5rem')}
      {skeletonBar('100%', '4.5rem')}
      {skeletonBar('70%', '4.5rem')}
    </div>
  </div>
)

const errorScreen = (onRetry) => (
  <div style={{
    minHeight: '100vh', background: '#141410', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: '1rem',
    fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem',
    letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7a7770',
  }}>
    <div>Kunne ikke indlæse.</div>
    <button onClick={onRetry} style={{
      background: 'transparent', border: '1px solid #4a4844', color: '#c8923a',
      fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.12em',
      textTransform: 'uppercase', padding: '0.6rem 1.2rem', cursor: 'pointer', borderRadius: 2,
    }}>Prøv igen</button>
  </div>
)

function App() {
  const [session, setSession] = useState(null)
  const [role, setRole] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [previewMode, setPreviewMode] = useState(false)
  const [coachAthleteId, setCoachAthleteId] = useState(null)
  // Sand fra åbning til atleten har sat en ny adgangskode via "glemt adgangskode"-
  // linket. Initieres synkront fra URL'en (se isPasswordRecoveryUrl), så vi aldrig
  // først når at vise den almindelige rolle-baserede visning et splitsekund.
  const [passwordRecovery, setPasswordRecovery] = useState(isPasswordRecoveryUrl)
  // Hvilken bruger-id vi allerede har slået rollen op for. Bruges til at undgå
  // gentagne opslag ved token-refresh (og dermed unødig flimmer/race).
  const resolvedFor = useRef(null)
  // Hvilken bruger-id der har et resolveRole-kald I GANG lige nu (til forskel
  // fra resolvedFor, som først sættes når kaldet er FÆRDIGT). Uden denne vagt
  // kalder både supabase.auth.getSession().then(...) nedenfor OG
  // onAuthStateChange's egen første (INITIAL_SESSION-)fyring resolveRole for
  // SAMME bruger-id samtidig ved hver koldstart — resolvedFor er på det
  // tidspunkt stadig null for begge, så ingen af de to eksisterende tjek
  // fanger racet. Resultatet, målt i ordre 173: profiles?select=role sendes
  // (med sin egen CORS-preflight) to gange for hver eneste app-åbning.
  const resolvingFor = useRef(null)
  // Holder den seneste resolveRole, så "Prøv igen"-knappen kan kalde den.
  const resolveRef = useRef(null)

  useEffect(() => {
    let cancelled = false

    // Slår brugerens rolle op robust. Degraderer ALDRIG en coach til athlete på
    // en transient fejl, og efterlader aldrig appen hængende i "Indlæser...".
    // hadGuess: true når et cachet gæt (se readCachedRole ovenfor) allerede
    // viser en visning — en transient fejl her skal IKKE rive den fungerende,
    // gættede visning ned (kun genvist for en helt frisk bruger uden gæt,
    // hvor "Prøv igen"-skærmen er den eneste ærlige mulighed).
    async function resolveRole(userId, email, { hadGuess = false } = {}) {
      if (resolvingFor.current === userId) return
      resolvingFor.current = userId
      try {
        if (!hadGuess) setLoadError(false)
        // withRetry venter på at token er hæftet på klienten før kaldet → undgår
        // cold-start hvor RLS svarer som anonym (0 rækker uden fejl).
        const { data, error } = await withRetry(() =>
          supabase.from('profiles').select('role').eq('id', userId).maybeSingle()
        )
        if (cancelled) return
        if (error) {
          // Reel fejl efter retries: vis retry frem for at gætte rollen forkert —
          // MEDMINDRE et cachet gæt allerede viser en fungerende visning; den
          // skal ikke rives ned af en forbigående fejl i bekræftelsen.
          if (!hadGuess) { setLoadError(true); setLoading(false) }
          return
        }
        if (data) {
          resolvedFor.current = userId
          writeCachedRole(userId, data.role || 'athlete')
          setRole(data.role || 'athlete')
          setLoading(false)
          return
        }
        // Ingen række OG ingen fejl → genuint ny bruger (DB-triggeren burde have
        // lavet profilen; vær defensiv). Opret som athlete uden at fejle på en
        // eksisterende række, og læs rollen igen frem for at antage 'athlete'.
        await supabase.from('profiles')
          .upsert({ id: userId, role: 'athlete', email }, { onConflict: 'id', ignoreDuplicates: true })
        const { data: after } = await withRetry(() =>
          supabase.from('profiles').select('role').eq('id', userId).maybeSingle()
        )
        if (cancelled) return
        resolvedFor.current = userId
        writeCachedRole(userId, after?.role || 'athlete')
        setRole(after?.role || 'athlete')
        setLoading(false)
      } finally {
        if (resolvingFor.current === userId) resolvingFor.current = null
      }
    }
    resolveRef.current = resolveRole

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return
      setSession(session)
      if (session) {
        // Vis det cachede gæt MED DET SAMME (ingen ventetid på netværket) —
        // ægte opslag kører stadig, se resolveRole's hadGuess-parameter.
        const cachedRole = readCachedRole(session.user.id)
        const hadGuess = !!cachedRole
        if (hadGuess) { setRole(cachedRole); setLoading(false) }
        resolveRole(session.user.id, session.user.email, { hadGuess })
      } else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return
      const previousUserId = resolvedFor.current
      if (!session || (previousUserId && previousUserId !== session.user.id)) {
        purgeVideoCoachDraftQueues()
      }
      setSession(session)
      if (!session) { resolvedFor.current = null; setRole(null); setLoading(false); return }
      // Spring opslag over hvis vi allerede kender rollen for denne bruger
      // (fx ved token-refresh). Udskyd desuden DB-kaldet UD af callbacken med
      // setTimeout(0) — at await'e supabase inde i onAuthStateChange kan låse
      // klientens auth-mutex og give intermitterende stall.
      if (resolvedFor.current === session.user.id) return
      setLoading(true)
      setTimeout(() => { if (!cancelled) resolveRole(session.user.id, session.user.email) }, 0)
    })

    // Sidste sikkerhedsnet: efterlad aldrig brugeren i "Indlæser..." for evigt.
    const safety = setTimeout(() => {
      if (cancelled) return
      setLoading(prev => { if (prev) setLoadError(true); return false })
    }, 12000)

    return () => { cancelled = true; subscription.unsubscribe(); clearTimeout(safety) }
  }, [])

  // Vises FØR loading/session-grenene nedenfor: recovery-sessionen etableres i
  // baggrunden af useEffect'en ovenfor (samme getSession/onAuthStateChange som
  // altid), "ready" er blot om den er landet endnu. Rolleopslag kører også i
  // baggrunden imens — når atleten er færdig, er appen typisk allerede klar.
  if (passwordRecovery) {
    return <SetNewPassword ready={!!session} onDone={() => {
      window.history.replaceState(null, '', window.location.pathname)
      setPasswordRecovery(false)
    }} />
  }

  if (loading) return loaderScreen

  // eslint-disable-next-line react-hooks/refs -- resolveRef læses kun inde i retry-callbacken (event handler), ikke under render
  if (loadError) return errorScreen(() => {
    setLoadError(false)
    setLoading(true)
    if (session) resolveRef.current?.(session.user.id, session.user.email)
    else window.location.reload()
  })

  if (!session) return <Auth />

  let viewEl
  if (role === 'coach') {
    viewEl = previewMode
      ? <LazyBoundary factory={athleteViewFactory} label="Atletvisning" loading={loaderScreen}
          componentProps={{ session, role, coachAthleteId, onExitPreview: () => { setPreviewMode(false); setCoachAthleteId(null) } }} />
      : <LazyBoundary factory={dashboardFactory} label="Dashboard" loading={loaderScreen}
          componentProps={{ session, onPreviewAthlete: (athleteId) => { setCoachAthleteId(athleteId || null); setPreviewMode(true) } }} />
  } else {
    // Coach-rolle hentes fra profiles.role og caches pr. bruger-id (se
    // resolveRole/resolvedFor ovenfor) — ændres rollen server-side til 'coach'
    // mens en fane stadig har den gamle sesion åben, opdager appen det først
    // ved en fuld genindlæsning. onRecheckRole giver et sted i UI'en (uden
    // login/logout) hvor det kan tjekkes igen med det samme: den kalder den
    // samme resolveRole, som ved et 'coach'-svar automatisk skifter denne
    // gren over til Dashboard via almindelig React-genrendering.
    viewEl = <LazyBoundary factory={athleteViewFactory} label="Atletvisning" loading={loaderScreen}
      componentProps={{ session, role, onRecheckRole: () => resolveRef.current?.(session.user.id, session.user.email) }} />
  }
  return <ErrorBoundary>{viewEl}</ErrorBoundary>
}

export default App
